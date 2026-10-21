/**
 * Klassen-Routen
 *
 * POST /api/classes/join - Klasse per Code beitreten (K4)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db.js'
import { validateSession, SESSION_COOKIE_NAME } from '../session.js'

const joinClassSchema = z.object({
  code: z.string().min(1).max(32),
})

export interface ClassesPluginOptions {
  db: Db
}

const classesRoutes: FastifyPluginAsync<ClassesPluginOptions> = async (fastify, opts) => {
  const { db } = opts

  // POST /api/classes/join
  fastify.post('/classes/join', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const session = validateSession(db, token)
    if (!session) return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })

    const parsed = joinClassSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    }
    const { code } = parsed.data

    const cls = db.prepare(
      "SELECT id, name FROM classes WHERE join_code = ? AND archived = 0"
    ).get(code) as { id: number; name: string } | undefined

    if (!cls) {
      return reply.code(404).send({ fehler: 'Klasse nicht gefunden oder Code abgelaufen.' })
    }

    // Idempotent: INSERT OR IGNORE
    db.prepare(
      'INSERT OR IGNORE INTO memberships (class_id, user_id) VALUES (?, ?)'
    ).run(cls.id, session.user_id)

    return reply.send({ ok: true, class_name: cls.name })
  })
}

export default classesRoutes
