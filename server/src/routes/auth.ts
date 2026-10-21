/**
 * Auth-Routen: Register, Login, Logout, GET/PATCH/DELETE me
 *
 * Alle schreibenden Endpunkte sind durch den CSRF-Origin-Check geschuetzt (app.ts).
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db.js'
import type { MailSender } from '../mail.js'
import type { RateLimiters } from '../plugins/ratelimit.js'
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
// Zod-Schemas nach K1 und K2
// ---------------------------------------------------------------------------

const registerStudentSchema = z.object({
  role: z.literal('student'),
  username: z.string().min(2).max(32),
  display_name: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
  email: z.string().email().optional(),
  /** Optionaler Klassencode beim Registrieren (K4) */
  class_code: z.string().optional(),
})

const registerTeacherSchema = z.object({
  role: z.literal('teacher'),
  username: z.string().min(2).max(32),
  display_name: z.string().min(1).max(64),
  /** K2: Pflichtfeld bei Lehrkraft */
  name: z.string().min(1).max(128),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  school: z.string().max(128).optional(),
  terms_accepted: z.literal(true),
})

const registerSchema = z.discriminatedUnion('role', [
  registerStudentSchema,
  registerTeacherSchema,
])

const loginSchema = z.object({
  /** Benutzername oder E-Mail-Adresse */
  login: z.string().min(1).max(256),
  password: z.string().min(1).max(128),
})

const patchMeSchema = z.object({
  display_name: z.string().min(1).max(64).optional(),
  /** Neuer Benutzername: nur mit aktuellem Passwort erlaubt (K3) */
  username: z.string().min(2).max(32).optional(),
  current_password: z.string().optional(),
})

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(8).max(128),
})

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
    'SELECT id, username, display_name, email, name, school, role, password_hash, created_day, last_login_at, must_change_password FROM users WHERE email = ?'
  ).get(email) as UserRow | undefined
}

function findUserById(db: Db, id: number) {
  return db.prepare(
    'SELECT id, username, display_name, email, name, school, role, created_day, last_login_at, must_change_password FROM users WHERE id = ?'
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
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface AuthPluginOptions {
  db: Db
  mail: MailSender
  limits: RateLimiters
}

const authRoutes: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  const { db, limits } = opts

  // POST /api/register
  fastify.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }
    const data = parsed.data
    const username = normalizeUsername(data.username)

    // Rate-Limit pro Benutzername
    if (!limits.register.check(username)) {
      return reply.code(429).send({ fehler: 'Zu viele Versuche. Bitte warte kurz.' })
    }

    // Benutzername bereits vergeben?
    const existing = findUserByUsername(db, username)
    if (existing) {
      return reply.code(409).send({ fehler: 'Benutzername bereits vergeben.' })
    }

    // E-Mail bereits vergeben?
    if (data.email) {
      const emailUser = findUserByEmail(db, data.email)
      if (emailUser) {
        return reply.code(409).send({ fehler: 'E-Mail-Adresse bereits registriert.' })
      }
    }

    const createdDay = todayUtc()
    const passwordHash = await hashPassword(data.password, username, createdDay)

    let newUserId: number
    if (data.role === 'teacher') {
      const result = db.prepare(
        `INSERT INTO users (username, display_name, email, name, school, role, password_hash, created_day, terms_accepted_at)
         VALUES (?, ?, ?, ?, ?, 'teacher', ?, ?, ?)`
      ).run(username, data.display_name, data.email, data.name, data.school ?? null, passwordHash, createdDay, Math.floor(Date.now() / 1000))
      newUserId = result.lastInsertRowid as number
    } else {
      const result = db.prepare(
        `INSERT INTO users (username, display_name, email, role, password_hash, created_day)
         VALUES (?, ?, ?, 'student', ?, ?)`
      ).run(username, data.display_name, data.email ?? null, passwordHash, createdDay)
      newUserId = result.lastInsertRowid as number

      // Klassencode beim Registrieren verarbeiten (K4)
      if (data.class_code) {
        const cls = db.prepare(
          "SELECT id FROM classes WHERE join_code = ? AND archived = 0"
        ).get(data.class_code) as { id: number } | undefined
        if (cls) {
          db.prepare(
            'INSERT OR IGNORE INTO memberships (class_id, user_id) VALUES (?, ?)'
          ).run(cls.id, newUserId)
        }
      }
    }

    const token = createSession(db, newUserId)
    reply
      .setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
      .code(201)
      .send({ ok: true })
  })

  // POST /api/login
  fastify.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.' })
    }
    const { login: loginInput, password } = parsed.data
    const normalized = normalizeUsername(loginInput)

    // Rate-Limit
    if (!limits.login.check(normalized)) {
      return reply.code(429).send({ fehler: 'Zu viele Versuche. Bitte warte kurz.' })
    }

    // Nutzer per Benutzername oder E-Mail suchen
    let user: UserRow | undefined = findUserByUsername(db, normalized)
    if (!user && loginInput.includes('@')) {
      user = findUserByEmail(db, loginInput)
    }

    if (!user) {
      // Immer gleiche Dauer (constant-time Antwort) - verwendet einen gueltigen PHC-Hash
      // sodass argon2.verify nicht sofort mit Formatfehler abbricht
      await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', password, 'dummy', '2000-01-01')
      return reply.code(401).send({ fehler: 'Benutzername oder Passwort falsch.' })
    }

    const ok = await verifyPassword(user.password_hash, password, user.username, user.created_day)
    if (!ok) {
      return reply.code(401).send({ fehler: 'Benutzername oder Passwort falsch.' })
    }

    // last_login_at aktualisieren
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), user.id)

    const token = createSession(db, user.id)
    reply
      .setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
      .send({ ok: true, must_change_password: user.must_change_password === 1 })
  })

  // POST /api/logout
  fastify.post('/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (token) {
      deleteSession(db, token)
    }
    reply
      .clearCookie(SESSION_COOKIE_NAME, { path: '/' })
      .send({ ok: true })
  })

  // GET /api/me
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

    return reply.send({ user })
  })

  // PATCH /api/me
  fastify.patch('/me', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })

    const session = validateSession(db, token)
    if (!session) return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })

    const parsed = patchMeSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }
    const { display_name, username: newUsername, current_password } = parsed.data

    const user = db.prepare(
      'SELECT id, username, password_hash, created_day FROM users WHERE id = ?'
    ).get(session.user_id) as Pick<UserRow, 'id' | 'username' | 'password_hash' | 'created_day'> | undefined

    if (!user) return reply.code(401).send({ fehler: 'Konto nicht gefunden.' })

    // Benutzername aendern: nur mit aktuellem Passwort (K3)
    if (newUsername !== undefined) {
      if (!current_password) {
        return reply.code(400).send({ fehler: 'Aktuelles Passwort erforderlich zum Aendern des Benutzernamens.' })
      }
      const ok = await verifyPassword(user.password_hash, current_password, user.username, user.created_day)
      if (!ok) {
        return reply.code(403).send({ fehler: 'Aktuelles Passwort falsch.' })
      }
      const normalizedNew = normalizeUsername(newUsername)
      const conflict = findUserByUsername(db, normalizedNew)
      if (conflict && conflict.id !== user.id) {
        return reply.code(409).send({ fehler: 'Benutzername bereits vergeben.' })
      }
      // Neu-Hash mit neuem Benutzernamen (K3)
      const newHash = await hashPassword(current_password, normalizedNew, user.created_day)
      db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(normalizedNew, newHash, user.id)
    }

    if (display_name !== undefined) {
      db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, user.id)
    }

    return reply.send({ ok: true })
  })

  // POST /api/me/password: Passwort aendern (aktuelles Passwort erforderlich).
  // Neuer Hash mit unveraendertem Benutzernamen und Erstellungstag (K3),
  // setzt must_change_password zurueck und beendet alle anderen Sitzungen.
  fastify.post('/me/password', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })

    const session = validateSession(db, token)
    if (!session) return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })

    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Neues Passwort muss mindestens 8 Zeichen haben.' })
    }
    const { current_password, new_password } = parsed.data

    const user = db.prepare(
      'SELECT id, username, password_hash, created_day FROM users WHERE id = ?'
    ).get(session.user_id) as Pick<UserRow, 'id' | 'username' | 'password_hash' | 'created_day'> | undefined
    if (!user) return reply.code(401).send({ fehler: 'Konto nicht gefunden.' })

    const ok = await verifyPassword(user.password_hash, current_password, user.username, user.created_day)
    if (!ok) return reply.code(403).send({ fehler: 'Aktuelles Passwort falsch.' })

    const newHash = await hashPassword(new_password, user.username, user.created_day)
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, user.id)
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').run(user.id, session.id_hash)
    })()

    return reply.send({ ok: true })
  })

  // DELETE /api/me (K8: alles sofort loeschen)
  fastify.delete('/me', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })

    const session = validateSession(db, token)
    if (!session) return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })

    // Alle Sitzungen loeschen
    deleteAllSessions(db, session.user_id)

    // Konto loeschen (ON DELETE CASCADE entfernt: sessions, progress, last_attempt, memberships, password_resets)
    db.prepare('DELETE FROM users WHERE id = ?').run(session.user_id)

    reply
      .clearCookie(SESSION_COOKIE_NAME, { path: '/' })
      .send({ ok: true })
  })
}

export default authRoutes
