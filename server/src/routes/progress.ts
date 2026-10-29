/**
 * Fortschritt-Sync
 *
 * GET  /api/progress  - Fortschritt des angemeldeten Nutzers laden
 * PUT  /api/progress  - Fortschritt speichern (Bulk-Sync, inkl. einmaliger Uebernahme lokaler Daten)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from '../db.js'
import {
  validateSession,
  SESSION_COOKIE_NAME,
} from '../session.js'

// Bekannte Lektionen und ihre Schrittzahl (generiert von tools/gen-lesson-steps.mjs)
const LESSON_STEPS: Record<string, { exercise_steps: number; total_steps: number }> =
  createRequire(import.meta.url)(join(dirname(fileURLToPath(import.meta.url)), '..', 'lesson-steps.json'))

/** Höchstens so viele Versuche je Schritt werden gespeichert (mehr ändert am Status nichts) */
const MAX_ATTEMPTS = 10_000

const lessonIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/)

const progressItemSchema = z.object({
  lesson_id: lessonIdSchema,
  step: z.number().int().min(0).max(255),
  done: z.boolean(),
  attempts: z.number().int().min(0),
  updated_at: z.number().int().min(0),
})

/** Gehört der Schritt zu einer echten Lektion? Unbekanntes wird still übersprungen (alte lokale Daten). */
function knownStep(lessonId: string, step: number): boolean {
  const l = LESSON_STEPS[lessonId]
  return l !== undefined && step < l.total_steps
}

/** Letzte Abfrage: im Browser mit dem öffentlichen Schlüssel der Lehrkraft verschlüsselt (K4). */
const attemptItemSchema = z.object({
  lesson_id: lessonIdSchema,
  step: z.number().int().min(0).max(255),
  /** Abfrage und Fehlermeldung verschlüsselt (Format h1.…), leer wenn keine Lehrkraft-Schlüssel vorliegen */
  sealed: z.string().regex(/^(h1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+)?$/).max(30_000),
  has_error: z.boolean(),
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
      'SELECT lesson_id, step, has_error, updated_at FROM last_attempt WHERE user_id = ?'
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
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
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
      INSERT INTO last_attempt (user_id, lesson_id, step, query, error_msg, sealed, has_error, updated_at)
      VALUES (?, ?, ?, '', '', ?, ?, ?)
      ON CONFLICT(user_id, lesson_id, step) DO UPDATE SET
        sealed = excluded.sealed,
        has_error = excluded.has_error,
        updated_at = excluded.updated_at
    `)

    const nowTs = Math.floor(Date.now() / 1000)

    db.transaction(() => {
      for (const item of progress) {
        if (!knownStep(item.lesson_id, item.step)) continue
        upsertProgress.run(
          session.user_id,
          item.lesson_id,
          item.step,
          item.done ? 1 : 0,
          Math.min(item.attempts, MAX_ATTEMPTS),
          // Zeitstempel aus dem Browser höchstens "jetzt" (falsche Uhren, Daten aus der Zukunft)
          Math.min(item.updated_at, nowTs)
        )
      }
      for (const attempt of last_attempts ?? []) {
        if (!knownStep(attempt.lesson_id, attempt.step)) continue
        upsertAttempt.run(
          session.user_id,
          attempt.lesson_id,
          attempt.step,
          attempt.sealed,
          attempt.has_error ? 1 : 0,
          nowTs
        )
      }
    })()

    return reply.send({ ok: true })
  })
}

export default progressRoutes
