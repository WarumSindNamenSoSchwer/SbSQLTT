/**
 * Klassen-Login für Schüler (docs/KLASSEN-LOGIN.md, Vorgaben K1, K4, K10).
 *
 * Der Server sieht nie Namen oder Passwörter von Schülern. Der Browser leitet aus
 * Klassen-Salz, Name und Passwort einen Schlüssel ab (Argon2id) und schickt ihn als `key`.
 * Gespeichert wird nur SHA-256(key) als users.login_hash.
 *
 *   GET  /api/class-login/lookup?code=...   Klasse finden: Name, Lehrkraft, Salz, öffentlicher Schlüssel
 *   POST /api/class-login/join              { code, key, enc_name }        Beitreten (neuer Schüler)
 *   POST /api/class-login/login             { code, key, enc_name? }       Anmelden
 *   POST /api/class-login/reset             { code, reset_code, key, enc_name }  Neues Passwort mit Einmal-Code
 *   POST /api/student/rekey                 { old_key, new_key, enc_name } Passwort oder Name ändern
 *   POST /api/student/leave                 Aus der Klasse austreten (löscht alle Daten)
 *
 * Anmeldeschutz (nur im Arbeitsspeicher, IP nur als flüchtiges HMAC-Kennzeichen, siehe ratelimit.ts):
 * - Fehlversuche zählen je Gerät UND Klasse. Fremde Fehlversuche sperren also nicht die ganze Klasse.
 * - Zusätzlich eine hohe Obergrenze je Klasse über alle Geräte (bremst verteiltes Raten).
 * - Unbekannte Klassencodes zählen je Gerät. Ein Gerät, das Codes durchprobiert, wird gebremst,
 *   alle anderen merken nichts.
 * - Beitritte je Gerät begrenzt (eine Klasse mit 30 Schülern an einem Schul-NAT passt hinein).
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import type { Db } from '../db.js'
import { sha256hex } from '../db.js'
import { RateLimiter, clientKey } from '../plugins/ratelimit.js'
import {
  createSession,
  validateSession,
  deleteAllSessions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '../session.js'
import { todayUtc } from '../password.js'

/** Abgeleiteter Schlüssel: 32 Byte als Hex */
const keySchema = z.string().regex(/^[0-9a-f]{64}$/)
/** Verschlüsselter Name (Format h1.…, nur der Browser der Lehrkraft kann ihn öffnen) */
const sealedSchema = z.string().regex(/^h1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/).max(2000)
const codeSchema = z.string().min(3).max(64)

export function normalizeClassCode(code: string): string {
  return code.normalize('NFC').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
}

interface ClassRow {
  id: number
  name: string
  class_salt: string
  teacher_id: number
  archived: number
}

function findClass(db: Db, code: string): (ClassRow & { teacher_name: string; public_key: string | null }) | undefined {
  return db.prepare(
    `SELECT c.id, c.name, c.class_salt, c.teacher_id, c.archived, u.display_name AS teacher_name, u.public_key
     FROM classes c JOIN users u ON u.id = c.teacher_id
     WHERE c.join_code = ? AND c.archived = 0`
  ).get(normalizeClassCode(code)) as (ClassRow & { teacher_name: string; public_key: string | null }) | undefined
}

function studentIdFromHash(db: Db, classId: number, loginHash: string): number | undefined {
  const row = db.prepare(
    `SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE u.login_hash = ? AND u.role = 'student' AND m.class_id = ?`
  ).get(loginHash, classId) as { id: number } | undefined
  return row?.id
}

function startSession(db: Db, reply: FastifyReply, userId: number) {
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), userId)
  const token = createSession(db, userId)
  reply.setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
}

export interface ClassLoginOptions {
  db: Db
}

const classLoginRoutes: FastifyPluginAsync<ClassLoginOptions> = async (fastify, opts) => {
  const { db } = opts
  const MIN = 60 * 1000
  // Je Gerät und Klasse: 40 Fehlversuche in 15 Minuten. Schulnetze teilen oft eine Adresse,
  // 30 Schüler mit je einem Tippfehler passen deshalb noch hinein.
  const failClient = new RateLimiter(40, 15 * MIN)
  // Je Klasse über alle Geräte: 300 Fehlversuche in 15 Minuten (verteiltes Raten)
  const failClass = new RateLimiter(300, 15 * MIN)
  // Unbekannte Klassencodes je Gerät: 60 in 15 Minuten (eine Klasse mit Tippfehlern am selben
  // Schul-Router passt hinein, systematisches Durchprobieren nicht)
  const unknownCodeLimit = new RateLimiter(60, 15 * MIN)
  // Beitritte je Gerät: 120 je Stunde (mehrere Klassen nacheinander am selben Schul-Router)
  const joinLimit = new RateLimiter(120, 60 * MIN)

  const TOO_MANY = { fehler: 'Zu viele Versuche von diesem Gerät. Bitte warte ein paar Minuten und versuche es dann noch einmal.' }

  function tooManyFailures(classId: number, client: string): boolean {
    return failClient.blocked(`${client}:${classId}`) || failClass.blocked(`class:${classId}`)
  }
  function countFailure(classId: number, client: string): void {
    failClient.hit(`${client}:${classId}`)
    failClass.hit(`class:${classId}`)
  }
  /** Sucht die Klasse und zählt unbekannte Codes je Gerät. */
  function classOrCount(code: string, client: string) {
    const cls = findClass(db, code)
    if (!cls) unknownCodeLimit.hit(client)
    return cls
  }

  // -------------------------------------------------------------------------
  // GET /api/class-login/lookup?code=...
  // -------------------------------------------------------------------------
  fastify.get('/class-login/lookup', async (req, reply) => {
    const code = (req.query as { code?: unknown }).code
    if (typeof code !== 'string' || !codeSchema.safeParse(code).success) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    const client = clientKey(req)
    // Nur Geräte, die viele falsche Codes probiert haben, werden gebremst
    if (unknownCodeLimit.blocked(client)) return reply.code(429).send(TOO_MANY)
    const cls = classOrCount(code, client)
    if (!cls || !cls.public_key) {
      return reply.code(404).send({ fehler: 'Klasse nicht gefunden. Bitte prüfe den Klassencode.' })
    }
    return reply.send({
      class_name: cls.name,
      teacher_name: cls.teacher_name,
      class_salt: cls.class_salt,
      public_key: cls.public_key,
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/class-login/join
  // -------------------------------------------------------------------------
  const joinSchema = z.object({ code: codeSchema, key: keySchema, enc_name: sealedSchema })

  fastify.post('/class-login/join', async (req, reply) => {
    const parsed = joinSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    const client = clientKey(req)
    if (unknownCodeLimit.blocked(client) || joinLimit.blocked(client)) return reply.code(429).send(TOO_MANY)
    const cls = classOrCount(parsed.data.code, client)
    if (!cls) return reply.code(404).send({ fehler: 'Klasse nicht gefunden. Bitte prüfe den Klassencode.' })
    if (tooManyFailures(cls.id, client)) return reply.code(429).send(TOO_MANY)

    const loginHash = sha256hex(parsed.data.key)
    if (db.prepare('SELECT 1 FROM users WHERE login_hash = ?').get(loginHash)) {
      // Gleicher Name und gleiches Passwort in derselben Klasse. Zählt wie ein Fehlversuch,
      // damit diese Antwort nicht beliebig oft zum Ausprobieren dienen kann.
      countFailure(cls.id, client)
      return reply.code(409).send({ fehler: 'Bitte wähle ein anderes Passwort.', code: 'taken' })
    }
    joinLimit.hit(client)

    const userId = db.transaction(() => {
      const placeholder = `s_${randomBytes(12).toString('hex')}`
      const res = db.prepare(
        `INSERT INTO users (username, display_name, role, password_hash, created_day, login_hash, enc_name)
         VALUES (?, '', 'student', '', ?, ?, ?)`
      ).run(placeholder, todayUtc(), loginHash, parsed.data.enc_name)
      const id = res.lastInsertRowid as number
      db.prepare('INSERT INTO memberships (class_id, user_id) VALUES (?, ?)').run(cls.id, id)
      return id
    })()

    startSession(db, reply, userId)
    return reply.code(201).send({ ok: true, class_name: cls.name })
  })

  // -------------------------------------------------------------------------
  // POST /api/class-login/login
  // -------------------------------------------------------------------------
  const loginSchema = z.object({ code: codeSchema, key: keySchema, enc_name: sealedSchema.optional() })

  fastify.post('/class-login/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    const client = clientKey(req)
    if (unknownCodeLimit.blocked(client)) return reply.code(429).send(TOO_MANY)
    const cls = classOrCount(parsed.data.code, client)
    if (!cls) return reply.code(401).send({ fehler: 'Klassencode, Name oder Passwort falsch.' })
    if (tooManyFailures(cls.id, client)) return reply.code(429).send(TOO_MANY)

    const userId = studentIdFromHash(db, cls.id, sha256hex(parsed.data.key))
    if (!userId) {
      countFailure(cls.id, client)
      return reply.code(401).send({ fehler: 'Klassencode, Name oder Passwort falsch.' })
    }
    // Hat die Lehrkraft ein neues Schlüsselpaar (Passwort vergessen, kein Code), schreibt der
    // Browser den Namen hier neu für den aktuellen öffentlichen Schlüssel.
    if (parsed.data.enc_name) {
      db.prepare('UPDATE users SET enc_name = ? WHERE id = ?').run(parsed.data.enc_name, userId)
    }
    startSession(db, reply, userId)
    return reply.send({ ok: true, class_name: cls.name })
  })

  // -------------------------------------------------------------------------
  // POST /api/class-login/reset  (Einmal-Code der Lehrkraft)
  // -------------------------------------------------------------------------
  const resetSchema = z.object({ code: codeSchema, reset_code: z.string().min(4).max(32), key: keySchema, enc_name: sealedSchema })

  fastify.post('/class-login/reset', async (req, reply) => {
    const parsed = resetSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    const client = clientKey(req)
    if (unknownCodeLimit.blocked(client)) return reply.code(429).send(TOO_MANY)
    const cls = classOrCount(parsed.data.code, client)
    if (!cls) return reply.code(400).send({ fehler: 'Code ungültig oder abgelaufen.' })
    if (tooManyFailures(cls.id, client)) return reply.code(429).send(TOO_MANY)

    const now = Math.floor(Date.now() / 1000)
    const row = db.prepare(
      'SELECT user_id FROM student_reset_codes WHERE code_hash = ? AND class_id = ? AND expires_at > ?'
    ).get(sha256hex(parsed.data.reset_code.trim().toUpperCase()), cls.id, now) as { user_id: number } | undefined
    if (!row) {
      countFailure(cls.id, client)
      return reply.code(400).send({ fehler: 'Code ungültig oder abgelaufen.' })
    }

    const loginHash = sha256hex(parsed.data.key)
    const other = db.prepare('SELECT id FROM users WHERE login_hash = ?').get(loginHash) as { id: number } | undefined
    if (other && other.id !== row.user_id) {
      return reply.code(409).send({ fehler: 'Bitte wähle ein anderes Passwort.', code: 'taken' })
    }

    db.transaction(() => {
      db.prepare('UPDATE users SET login_hash = ?, enc_name = ? WHERE id = ?').run(loginHash, parsed.data.enc_name, row.user_id)
      db.prepare('DELETE FROM student_reset_codes WHERE user_id = ?').run(row.user_id)
      deleteAllSessions(db, row.user_id)
    })()

    startSession(db, reply, row.user_id)
    return reply.send({ ok: true, class_name: cls.name })
  })

  // -------------------------------------------------------------------------
  // Angemeldeter Schüler: Name oder Passwort ändern, austreten
  // -------------------------------------------------------------------------
  function requireStudent(req: { cookies: Record<string, string | undefined> }, reply: FastifyReply) {
    const token = req.cookies[SESSION_COOKIE_NAME]
    const session = token ? validateSession(db, token) : null
    if (!session) {
      reply.code(401).send({ fehler: 'Nicht angemeldet.' })
      return null
    }
    const row = db.prepare(
      `SELECT u.id, u.login_hash, m.class_id FROM users u JOIN memberships m ON m.user_id = u.id
       WHERE u.id = ? AND u.role = 'student'`
    ).get(session.user_id) as { id: number; login_hash: string; class_id: number } | undefined
    if (!row) {
      reply.code(403).send({ fehler: 'Nur für Schüler.' })
      return null
    }
    return { ...row, session_hash: session.id_hash }
  }

  const rekeySchema = z.object({ old_key: keySchema, new_key: keySchema, enc_name: sealedSchema })

  fastify.post('/student/rekey', async (req, reply) => {
    const me = requireStudent(req, reply)
    if (!me) return
    const parsed = rekeySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    const client = clientKey(req)
    if (tooManyFailures(me.class_id, client)) return reply.code(429).send(TOO_MANY)
    if (sha256hex(parsed.data.old_key) !== me.login_hash) {
      countFailure(me.class_id, client)
      return reply.code(403).send({ fehler: 'Aktuelles Passwort falsch.' })
    }
    const newHash = sha256hex(parsed.data.new_key)
    const other = db.prepare('SELECT id FROM users WHERE login_hash = ?').get(newHash) as { id: number } | undefined
    if (other && other.id !== me.id) return reply.code(409).send({ fehler: 'Bitte wähle ein anderes Passwort.', code: 'taken' })

    db.transaction(() => {
      db.prepare('UPDATE users SET login_hash = ?, enc_name = ? WHERE id = ?').run(newHash, parsed.data.enc_name, me.id)
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').run(me.id, me.session_hash)
    })()
    return reply.send({ ok: true })
  })

  fastify.post('/student/leave', async (req, reply) => {
    const me = requireStudent(req, reply)
    if (!me) return
    // K8: Schüler und alle Daten löschen (Fortschritt, letzte Abfrage, Sitzungen per CASCADE)
    db.prepare('DELETE FROM users WHERE id = ?').run(me.id)
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
    return reply.send({ ok: true })
  })
}

export default classLoginRoutes
