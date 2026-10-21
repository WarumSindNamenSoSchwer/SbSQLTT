/**
 * Schueler-Klassen-API
 *
 * GET /api/classes/mine - Eigene Klassen mit Fokus-Lektion und freigeschalteten Lektionen
 *
 * Wird von der Lektionsuebersicht des Schuelers genutzt um:
 *   - Fokus-Banner anzuzeigen ("Deine Klasse arbeitet gerade an: ...")
 *   - Gesperrte Lektionen zu markieren
 */
import type { FastifyPluginAsync } from 'fastify'
import type { Db } from '../db.js'
import { validateSession, SESSION_COOKIE_NAME } from '../session.js'

export interface StudentClassesPluginOptions {
  db: Db
}

const studentClassesRoutes: FastifyPluginAsync<StudentClassesPluginOptions> = async (fastify, opts) => {
  const { db } = opts

  // GET /api/classes/mine
  fastify.get('/mine', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    if (!token) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const session = validateSession(db, token)
    if (!session) return reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })

    // Klassen des Schuelers
    const classes = db.prepare(`
      SELECT c.id, c.name, c.join_code, c.focus_lesson, c.archived
      FROM memberships m
      JOIN classes c ON c.id = m.class_id
      WHERE m.user_id = ?
        AND c.archived = 0
      ORDER BY c.name
    `).all(session.user_id) as {
      id: number
      name: string
      join_code: string
      focus_lesson: string | null
      archived: number
    }[]

    // Lektionseinstellungen je Klasse laden
    const result = classes.map(cls => {
      const lessonSettings = db.prepare(`
        SELECT lesson_id, unlocked, sort_order, is_focus
        FROM lesson_settings
        WHERE class_id = ?
        ORDER BY sort_order
      `).all(cls.id) as {
        lesson_id: string
        unlocked: number
        sort_order: number
        is_focus: number
      }[]

      return {
        id: cls.id,
        name: cls.name,
        focus_lesson: cls.focus_lesson,
        lessons: lessonSettings.map(l => ({
          lesson_id: l.lesson_id,
          unlocked: l.unlocked === 1,
          sort_order: l.sort_order,
          is_focus: l.is_focus === 1,
        })),
      }
    })

    return reply.send({ classes: result })
  })
}

export default studentClassesRoutes
