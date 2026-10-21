/**
 * Fortschritt-Sync
 *
 * GET  /api/progress  - Fortschritt des angemeldeten Nutzers laden
 * PUT  /api/progress  - Fortschritt speichern (Bulk-Sync, inkl. einmaliger Uebernahme lokaler Daten)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db.js'
import {
  validateSession,
  SESSION_COOKIE_NAME,
} from '../session.js'

const progressItemSchema = z.object({
  lesson_id: z.string().min(1).max(64),
  step: z.number().int().min(0),
  done: z.boolean(),
  attempts: z.number().int().min(0),
  updated_at: z.number().int(),
})

const attemptItemSchema = z.object({
  lesson_id: z.string().min(1).max(64),
  step: z.number().int().min(0),
  query: z.string().max(10_000),
  error_msg: z.string().max(2000),
})

const putProgressSchema = z.object({
  progress: z.array(progressItemSchema).max(500),
  last_attempts: z.array(attemptItemSchema).max(200).optional(),
})

export interface ProgressPluginOptions {
  db: Db
}

const progressRoutes: FastifyPluginAsync<ProgressPluginOptions> = async (fastify, opts) => {
  const { db } = opts

  // GET /api/progress
  fastify.get('/progress', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const session = validateSession(db, token)
    if (!session) return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })

    const progress = db.prepare(
      'SELECT lesson_id, step, done, attempts, updated_at FROM progress WHERE user_id = ?'
    ).all(session.user_id)

    const lastAttempts = db.prepare(
      'SELECT lesson_id, step, query, error_msg, updated_at FROM last_attempt WHERE user_id = ?'
    ).all(session.user_id)

    return reply.send({ progress, last_attempts: lastAttempts })
  })

  // PUT /api/progress (Bulk-Sync, inklusive einmaliger Uebernahme lokaler Daten beim ersten Anmelden)
  fastify.put('/progress', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const session = validateSession(db, token)
    if (!session) return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })

    const parsed = putProgressSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }
    const { progress, last_attempts } = parsed.data

    const upsertProgress = db.prepare(`
      INSERT INTO progress (user_id, lesson_id, step, done, attempts, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, lesson_id, step) DO UPDATE SET
        -- erledigt bleibt erledigt (erneutes Ueben setzt eine geloeste Uebung nicht zurueck)
        done     = MAX(done, excluded.done),
        attempts = CASE WHEN excluded.updated_at >= updated_at THEN MAX(attempts, excluded.attempts) ELSE attempts END,
        updated_at = MAX(updated_at, excluded.updated_at)
    `)

    const upsertAttempt = db.prepare(`
      INSERT INTO last_attempt (user_id, lesson_id, step, query, error_msg, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, lesson_id, step) DO UPDATE SET
        query = excluded.query,
        error_msg = excluded.error_msg,
        updated_at = excluded.updated_at
    `)

    const nowTs = Math.floor(Date.now() / 1000)

    db.transaction(() => {
      for (const item of progress) {
        upsertProgress.run(
          session.user_id,
          item.lesson_id,
          item.step,
          item.done ? 1 : 0,
          item.attempts,
          item.updated_at
        )
      }
      for (const attempt of last_attempts ?? []) {
        upsertAttempt.run(
          session.user_id,
          attempt.lesson_id,
          attempt.step,
          attempt.query,
          attempt.error_msg,
          nowTs
        )
      }
    })()

    return reply.send({ ok: true })
  })
}

export default progressRoutes
