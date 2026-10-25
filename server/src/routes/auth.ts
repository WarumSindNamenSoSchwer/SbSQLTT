/**
 * Auth-Routen für Lehrkräfte: Register, Login, Logout, GET/PATCH/DELETE me, Passwort ändern.
 * Schüler melden sich über den Klassen-Login an (routes/class-login.ts), GET /me und
 * Logout gelten für beide.
 *
 * Alle schreibenden Endpunkte sind durch den CSRF-Origin-Check geschützt (app.ts).
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db.js'
import type { MailSender } from '../mail.js'
import type { RateLimiters } from '../plugins/ratelimit.js'
import { sendVerificationMail } from './email-verify.js'
import {
  hashPassword,
  verifyPassword,
  normalizeUsername,
  todayUtc,
} from '../password.js'
import {
  createSession,
  validateSession,
  deleteSession,
  deleteAllSessions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '../session.js'

// ---------------------------------------------------------------------------
// Zod-Schemas (K2)
// ---------------------------------------------------------------------------

/** Verpackter privater Schlüssel (Format v1.salt.iv.ct, siehe src/lib/tabula/crypto.ts) */
const wrappedSchema = z.string().regex(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/).max(8000)
const keyBundleSchema = z.object({
  /** Öffentlicher Schlüssel (SPKI, Base64) */
  public_key: z.string().regex(/^[A-Za-z0-9+/=]+$/).min(100).max(2000),
  wrapped_by_password: wrappedSchema,
  wrapped_by_recovery: wrappedSchema,
})

const registerTeacherSchema = z.object({
  role: z.literal('teacher').optional(),
  username: z.string().min(2).max(254).optional(),
  display_name: z.string().min(1).max(64),
  /** K2: Pflichtfeld bei Lehrkraft */
  name: z.string().min(1).max(128),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  school: z.string().max(128).optional(),
  terms_accepted: z.literal(true),
  /** Schlüsselpaar aus dem Browser (K2) */
  keys: keyBundleSchema,
})

const loginSchema = z.object({
  /** E-Mail-Adresse der Lehrkraft */
  login: z.string().min(1).max(256),
  password: z.string().min(1).max(128),
})

const patchMeSchema = z.object({
  display_name: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(128).optional(),
  school: z.string().max(128).nullable().optional(),
})

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(8).max(128),
  /** Privater Schlüssel, im Browser neu mit dem neuen Passwort verpackt */
  wrapped_by_password: wrappedSchema,
})

const recoverySchema = z.object({
  /** Neues Schlüsselpaar (Lehrkraft hat nach Passwort-Reset ohne Code neu begonnen) oder neu verpackter Schlüssel */
  keys: keyBundleSchema,
})

/** E-Mail-Adressen groß/klein-unabhängig vergleichen */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function findUserByUsername(db: Db, username: string) {
  return db.prepare(
    'SELECT id, username, display_name, email, name, school, role, password_hash, created_day, last_login_at, must_change_password FROM users WHERE username = ?'
  ).get(username) as UserRow | undefined
}

function findUserByEmail(db: Db, email: string) {
  return db.prepare(
    "SELECT id, username, display_name, email, name, school, role, password_hash, created_day, last_login_at, must_change_password FROM users WHERE email = ? AND role = 'teacher'"
  ).get(normalizeEmail(email)) as UserRow | undefined
}

function findUserById(db: Db, id: number) {
  return db.prepare(
    `SELECT id, username, display_name, email, name, school, role, created_day, last_login_at, must_change_password,
            email_verified_at, public_key, wrapped_key_pw, wrapped_key_recovery
     FROM users WHERE id = ?`
  ).get(id) as PublicUserRow | undefined
}

interface UserRow {
  id: number
  username: string
  display_name: string
  email: string | null
  name: string | null
  school: string | null
  role: 'student' | 'teacher'
  password_hash: string
  created_day: string
  last_login_at: number | null
  must_change_password: number
}

interface PublicUserRow {
  id: number
  username: string
  display_name: string
  email: string | null
  name: string | null
  school: string | null
  role: 'student' | 'teacher'
  created_day: string
  last_login_at: number | null
  must_change_password: number
  email_verified_at: number | null
  public_key: string | null
  wrapped_key_pw: string | null
  wrapped_key_recovery: string | null
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface AuthPluginOptions {
  db: Db
  mail: MailSender
  limits: RateLimiters
  /** Basis-URL fuer Links in Systemmails */
  siteUrl?: string
}

const authRoutes: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  const { db, limits, mail } = opts
  const siteUrl = opts.siteUrl ?? 'https://www.tabulasql.de'

  function currentSession(req: { cookies: Record<string, string | undefined> }) {
    const token = req.cookies[SESSION_COOKIE_NAME]
    return token ? validateSession(db, token) : null
  }

  // POST /api/register  (nur Lehrkräfte, K2)
  fastify.post('/register', async (req, reply) => {
    const parsed = registerTeacherSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    }
    const data = parsed.data
    const email = normalizeEmail(data.email)
    // Benutzername der Lehrkraft = E-Mail-Adresse (für die Passwort-Bindung K3)
    const username = normalizeUsername(email)

    if (!limits.register.check(username)) {
      return reply.code(429).send({ fehler: 'Zu viele Versuche. Bitte warte kurz.' })
    }
    if (findUserByUsername(db, username) || findUserByEmail(db, email)) {
      return reply.code(409).send({ fehler: 'E-Mail-Adresse bereits registriert.' })
    }

    const createdDay = todayUtc()
    const passwordHash = await hashPassword(data.password, username, createdDay)

    const result = db.prepare(
      `INSERT INTO users (username, display_name, email, name, school, role, password_hash, created_day, terms_accepted_at,
                          public_key, wrapped_key_pw, wrapped_key_recovery)
       VALUES (?, ?, ?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?)`
    ).run(
      username, data.display_name, email, data.name, data.school ?? null, passwordHash, createdDay,
      Math.floor(Date.now() / 1000), data.keys.public_key, data.keys.wrapped_by_password, data.keys.wrapped_by_recovery
    )
    const newUserId = result.lastInsertRowid as number
    // K7: Bestätigungslink an die Lehrkraft (Versandfehler blockieren die Registrierung nicht)
    await sendVerificationMail(db, mail, siteUrl, { id: newUserId, email, display_name: data.display_name })
      .catch(() => fastify.log.warn({ event: 'verify_mail_failed' }))

    const token = createSession(db, newUserId)
    reply
      .setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
      .code(201)
      .send({ ok: true })
  })

  // POST /api/login  (Lehrkräfte, mit E-Mail-Adresse)
  fastify.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    }
    const { login: loginInput, password } = parsed.data
    const key = normalizeEmail(loginInput)

    if (!limits.login.check(key)) {
      return reply.code(429).send({ fehler: 'Zu viele Versuche. Bitte warte kurz.' })
    }

    const user = findUserByEmail(db, key)
    if (!user) {
      // Gleiche Dauer wie bei existierendem Konto (verhindert Aufzählung)
      await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', password, 'dummy', '2000-01-01')
      return reply.code(401).send({ fehler: 'E-Mail-Adresse oder Passwort falsch.' })
    }

    const ok = await verifyPassword(user.password_hash, password, user.username, user.created_day)
    if (!ok) {
      return reply.code(401).send({ fehler: 'E-Mail-Adresse oder Passwort falsch.' })
    }

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), user.id)

    const token = createSession(db, user.id)
    reply
      .setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
      .send({ ok: true })
  })

  // POST /api/logout (Lehrkräfte und Schüler)
  fastify.post('/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (token) {
      deleteSession(db, token)
    }
    reply
      .clearCookie(SESSION_COOKIE_NAME, { path: '/' })
      .send({ ok: true })
  })

  // GET /api/me (Lehrkräfte und Schüler)
  fastify.get('/me', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })

    const session = validateSession(db, token)
    if (!session) {
      reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
      return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })
    }

    const user = findUserById(db, session.user_id)
    if (!user) return reply.code(401).send({ fehler: 'Konto nicht gefunden.' })

    if (user.role === 'student') {
      // Schüler: keine Klardaten. Klasse und Lehrkraft für die Anzeige, öffentlicher Schlüssel
      // der Lehrkraft für das Verschlüsseln von Name und letzter Abfrage.
      const cls = db.prepare(
        `SELECT c.id, c.name, c.join_code, c.class_salt, t.display_name AS teacher_name, t.public_key
         FROM memberships m JOIN classes c ON c.id = m.class_id JOIN users t ON t.id = c.teacher_id
         WHERE m.user_id = ?`
      ).get(user.id) as { id: number; name: string; join_code: string; class_salt: string; teacher_name: string; public_key: string } | undefined
      return reply.send({
        user: {
          id: user.id,
          role: 'student',
          last_login_at: user.last_login_at,
          class: cls ? {
            id: cls.id, name: cls.name, code: cls.join_code, class_salt: cls.class_salt,
            teacher_name: cls.teacher_name, public_key: cls.public_key,
          } : null,
        },
      })
    }

    return reply.send({
      user: {
        id: user.id,
        role: 'teacher',
        display_name: user.display_name,
        email: user.email,
        name: user.name,
        school: user.school,
        created_day: user.created_day,
        last_login_at: user.last_login_at,
        email_verified_at: user.email_verified_at,
        /** Passwort wurde per E-Mail zurückgesetzt: privater Schlüssel muss wiederhergestellt werden */
        needs_key_recovery: user.must_change_password === 1,
        keys: {
          public_key: user.public_key,
          wrapped_by_password: user.wrapped_key_pw,
          wrapped_by_recovery: user.wrapped_key_recovery,
        },
      },
    })
  })

  // PATCH /api/me (Lehrkraft: Anzeigename, Name, Schule)
  fastify.patch('/me', async (req, reply) => {
    const session = currentSession(req)
    if (!session) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const user = findUserById(db, session.user_id)
    if (!user || user.role !== 'teacher') return reply.code(403).send({ fehler: 'Nur für Lehrkräfte.' })

    const parsed = patchMeSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    }
    const { display_name, name, school } = parsed.data
    if (display_name !== undefined) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, user.id)
    if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id)
    if (school !== undefined) db.prepare('UPDATE users SET school = ? WHERE id = ?').run(school || null, user.id)

    return reply.send({ ok: true })
  })

  // POST /api/me/password: Passwort ändern (aktuelles Passwort nötig).
  // Der Browser schickt den privaten Schlüssel neu mit dem neuen Passwort verpackt mit.
  fastify.post('/me/password', async (req, reply) => {
    const session = currentSession(req)
    if (!session) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })

    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Neues Passwort muss mindestens 8 Zeichen haben.' })
    }
    const { current_password, new_password, wrapped_by_password } = parsed.data

    const user = db.prepare(
      "SELECT id, username, password_hash, created_day FROM users WHERE id = ? AND role = 'teacher'"
    ).get(session.user_id) as Pick<UserRow, 'id' | 'username' | 'password_hash' | 'created_day'> | undefined
    if (!user) return reply.code(403).send({ fehler: 'Nur für Lehrkräfte.' })

    const ok = await verifyPassword(user.password_hash, current_password, user.username, user.created_day)
    if (!ok) return reply.code(403).send({ fehler: 'Aktuelles Passwort falsch.' })

    const newHash = await hashPassword(new_password, user.username, user.created_day)
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, wrapped_key_pw = ?, must_change_password = 0 WHERE id = ?')
        .run(newHash, wrapped_by_password, user.id)
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').run(user.id, session.id_hash)
    })()

    return reply.send({ ok: true })
  })

  // POST /api/me/keys: Schlüssel nach Passwort-Reset neu setzen.
  // a) mit Wiederherstellungscode: derselbe Schlüssel, neu mit dem neuen Passwort verpackt
  // b) ohne Code: neues Schlüsselpaar. Verschlüsselte Namen und Abfragen sind dann unlesbar und
  //    werden gelöscht. Schüler schreiben ihren Namen bei der nächsten Anmeldung neu.
  fastify.post('/me/keys', async (req, reply) => {
    const session = currentSession(req)
    if (!session) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const user = findUserById(db, session.user_id)
    if (!user || user.role !== 'teacher') return reply.code(403).send({ fehler: 'Nur für Lehrkräfte.' })

    const parsed = recoverySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    const { keys } = parsed.data
    const newPair = keys.public_key !== user.public_key

    db.transaction(() => {
      db.prepare('UPDATE users SET public_key = ?, wrapped_key_pw = ?, wrapped_key_recovery = ?, must_change_password = 0 WHERE id = ?')
        .run(keys.public_key, keys.wrapped_by_password, keys.wrapped_by_recovery, user.id)
      if (newPair) {
        // Alte Verschlüsselung ist nicht mehr lesbar: verschlüsselte Namen und Abfragen der eigenen Schüler leeren
        db.prepare(
          `UPDATE users SET enc_name = NULL WHERE id IN (
             SELECT m.user_id FROM memberships m JOIN classes c ON c.id = m.class_id WHERE c.teacher_id = ?)`
        ).run(user.id)
        db.prepare(
          `UPDATE last_attempt SET sealed = '' WHERE user_id IN (
             SELECT m.user_id FROM memberships m JOIN classes c ON c.id = m.class_id WHERE c.teacher_id = ?)`
        ).run(user.id)
      }
    })()
    return reply.send({ ok: true, new_pair: newPair })
  })

  // DELETE /api/me (Lehrkraft, K8: Konto mit allen Klassen und deren Schülern sofort löschen)
  fastify.delete('/me', async (req, reply) => {
    const session = currentSession(req)
    if (!session) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const user = findUserById(db, session.user_id)
    if (!user) return reply.code(401).send({ fehler: 'Konto nicht gefunden.' })
    if (user.role !== 'teacher') return reply.code(403).send({ fehler: 'Schüler treten über das Profil aus der Klasse aus.' })

    db.transaction(() => {
      // Schüler der eigenen Klassen löschen (ihre Daten hängen per CASCADE daran)
      db.prepare(
        `DELETE FROM users WHERE role = 'student' AND id IN (
           SELECT m.user_id FROM memberships m JOIN classes c ON c.id = m.class_id WHERE c.teacher_id = ?)`
      ).run(user.id)
      deleteAllSessions(db, user.id)
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
    })()

    reply
      .clearCookie(SESSION_COOKIE_NAME, { path: '/' })
      .send({ ok: true })
  })
}

export default authRoutes
