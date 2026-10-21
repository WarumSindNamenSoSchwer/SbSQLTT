/**
 * Lehrkraft-API unter /api/teacher
 *
 * Sicherheitsregeln:
 * - Nur role=teacher darf diese Endpunkte aufrufen.
 * - Eine Lehrkraft sieht und aendert nur ihre eigenen Klassen.
 *   Fremde Klassen liefern 404 (nicht 403), um Existenz nicht zu verraten (K4).
 * - Keine IP-Adressen in DB (K10).
 * - Keine Abfragetexte in Logs (K3).
 *
 * Beitrittscode-Alphabet (join_code, 6 Zeichen):
 * Ohne verwechselbare Zeichen: kein 0/O, kein 1/I/l.
 * Erlaubt: 23456789ABCDEFGHJKLMNPQRSTUVWXYZ (32 Zeichen, ~5 Bit/Zeichen, 30 Bit gesamt).
 *
 * Haengt-fest-Regel (dokumentiert):
 * Ein Schueler gilt als "haengt fest" an einem Schritt wenn:
 *   - Er >= 3 Versuche ohne Erfolg hat (done=0, attempts >= 3) ODER
 *   - Der letzte Versuch einen Fehler hatte (error_msg != '') UND
 *     der Zeitpunkt des letzten Versuchs > 5 Minuten zurueckliegt.
 * Grundlage: progress.done=0, progress.attempts >= 3 ODER
 *            last_attempt.error_msg != '' UND last_attempt.updated_at < now - 300s.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from '../db.js'
import { validateSession, SESSION_COOKIE_NAME } from '../session.js'
import { hashPassword } from '../password.js'
import { todayUtc, normalizeUsername } from '../password.js'

// ---------------------------------------------------------------------------
// Lektion-Schritt-Zaehler (aus lesson-steps.json, generiert von tools/gen-lesson-steps.mjs)
// ---------------------------------------------------------------------------

const _require = createRequire(import.meta.url)
const _lessonStepsPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'lesson-steps.json')
const LESSON_STEPS: Record<string, { exercise_steps: number; total_steps: number }> = _require(_lessonStepsPath)

/** Liefert die Gesamtzahl der Uebungsschritte fuer eine Lektion (authoritative). */
function lessonExerciseSteps(lessonId: string): number {
  return LESSON_STEPS[lessonId]?.exercise_steps ?? 0
}

// ---------------------------------------------------------------------------
// Beitrittscode-Erzeugung
// ---------------------------------------------------------------------------

/** Alphabet ohne verwechselbare Zeichen (kein 0/O, kein 1/I/l) */
const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const JOIN_CODE_LENGTH = 6

export function generateJoinCode(): string {
  const bytes = randomBytes(JOIN_CODE_LENGTH)
  return Array.from(bytes)
    .map(b => JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length])
    .join('')
}

// ---------------------------------------------------------------------------
// Auth-Hilfsfunktionen
// ---------------------------------------------------------------------------

interface TeacherSession {
  user_id: number
}

/**
 * Prueft Session und Role=teacher.
 * Gibt session-Objekt zurueck oder null (dann hat der Handler bereits geantwortet).
 */
async function requireTeacher(
  db: Db,
  req: { cookies: Record<string, string | undefined> },
  reply: FastifyReply
): Promise<TeacherSession | null> {
  const token = req.cookies[SESSION_COOKIE_NAME]
  if (!token) {
    await reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    return null
  }
  const session = validateSession(db, token)
  if (!session) {
    await reply.code(401).send({ fehler: 'Sitzung abgelaufen.' })
    return null
  }
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.user_id) as { role: string } | undefined
  if (!user || user.role !== 'teacher') {
    await reply.code(403).send({ fehler: 'Zugriff verweigert.' })
    return null
  }
  return { user_id: session.user_id }
}

/**
 * Prueft ob eine Klasse der Lehrkraft gehoert.
 * Gibt class-Row zurueck oder null (sendet 404).
 */
function requireOwnClass(
  db: Db,
  teacherId: number,
  classId: number,
  reply: FastifyReply
): { id: number; name: string; join_code: string; focus_lesson: string | null; archived: number; created_at: number } | null {
  const cls = db.prepare(
    'SELECT id, name, join_code, focus_lesson, archived, created_at FROM classes WHERE id = ? AND teacher_id = ?'
  ).get(classId, teacherId) as { id: number; name: string; join_code: string; focus_lesson: string | null; archived: number; created_at: number } | undefined
  if (!cls) {
    reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    return null
  }
  return cls
}

// ---------------------------------------------------------------------------
// Zod-Schemas
// ---------------------------------------------------------------------------

const createClassSchema = z.object({
  name: z.string().min(1).max(100),
})

const patchClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  archived: z.boolean().optional(),
})

const putLessonsSchema = z.object({
  lessons: z.array(z.object({
    lesson_id: z.string().min(1).max(64),
    unlocked: z.boolean(),
    sort_order: z.number().int().min(0),
    is_focus: z.boolean(),
  })).max(50),
})

const patchStudentSchema = z.object({
  display_name: z.string().min(1).max(64),
})

const passwordResetSchema = z.object({
  new_password: z.string().min(8).max(128),
})

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface TeacherPluginOptions {
  db: Db
}

const teacherRoutes: FastifyPluginAsync<TeacherPluginOptions> = async (fastify, opts) => {
  const { db } = opts

  // -------------------------------------------------------------------------
  // GET /api/teacher/classes - Alle eigenen Klassen
  // -------------------------------------------------------------------------
  fastify.get('/classes', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classes = db.prepare(`
      SELECT
        c.id, c.name, c.join_code, c.focus_lesson, c.archived, c.created_at,
        COUNT(DISTINCT m.user_id) AS student_count,
        SUM(CASE WHEN stuck.user_id IS NOT NULL THEN 1 ELSE 0 END) AS stuck_count
      FROM classes c
      LEFT JOIN memberships m ON m.class_id = c.id
      LEFT JOIN (
        SELECT DISTINCT p.user_id
        FROM progress p
        INNER JOIN memberships mem ON mem.user_id = p.user_id
        WHERE mem.class_id IS NOT NULL
          AND p.done = 0
          AND (
            p.attempts >= 3
            OR EXISTS (
              SELECT 1 FROM last_attempt la
              WHERE la.user_id = p.user_id
                AND la.lesson_id = p.lesson_id
                AND la.step = p.step
                AND la.error_msg != ''
                AND la.updated_at < (unixepoch() - 300)
            )
          )
      ) stuck ON stuck.user_id = m.user_id
      WHERE c.teacher_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all(session.user_id)

    return reply.send({ classes })
  })

  // -------------------------------------------------------------------------
  // POST /api/teacher/classes - Neue Klasse erstellen
  // -------------------------------------------------------------------------
  fastify.post('/classes', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const parsed = createClassSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }

    // Join-Code generieren (Eindeutigkeit sicherstellen)
    let joinCode: string
    let attempts = 0
    do {
      joinCode = generateJoinCode()
      attempts++
      if (attempts > 10) return reply.code(500).send({ fehler: 'Code-Erzeugung fehlgeschlagen.' })
    } while (db.prepare('SELECT id FROM classes WHERE join_code = ?').get(joinCode))

    const result = db.prepare(
      'INSERT INTO classes (teacher_id, name, join_code) VALUES (?, ?, ?)'
    ).run(session.user_id, parsed.data.name, joinCode)

    const newId = result.lastInsertRowid as number
    const cls = db.prepare('SELECT id, name, join_code, focus_lesson, archived, created_at FROM classes WHERE id = ?').get(newId)

    return reply.code(201).send({ ok: true, class: cls })
  })

  // -------------------------------------------------------------------------
  // GET /api/teacher/classes/:id
  // -------------------------------------------------------------------------
  fastify.get('/classes/:id', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const studentCount = (db.prepare('SELECT COUNT(*) as n FROM memberships WHERE class_id = ?').get(classId) as { n: number }).n

    return reply.send({ class: { ...cls, student_count: studentCount } })
  })

  // -------------------------------------------------------------------------
  // PATCH /api/teacher/classes/:id - Name oder archiviert setzen
  // -------------------------------------------------------------------------
  fastify.patch('/classes/:id', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const parsed = patchClassSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }

    const { name, archived } = parsed.data
    if (name !== undefined) {
      db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(name, classId)
    }
    if (archived !== undefined) {
      db.prepare('UPDATE classes SET archived = ? WHERE id = ?').run(archived ? 1 : 0, classId)
    }

    const updated = db.prepare('SELECT id, name, join_code, focus_lesson, archived, created_at FROM classes WHERE id = ?').get(classId)
    return reply.send({ ok: true, class: updated })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/teacher/classes/:id - Klasse loeschen (K8: alle Daten weg)
  // -------------------------------------------------------------------------
  fastify.delete('/classes/:id', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    // K8: Klasse loeschen - alle klassenbezogenen Daten entfernen.
    // Durch ON DELETE CASCADE in memberships, lesson_settings, quiz_rooms werden
    // Mitgliedschaften und Einstellungen automatisch geloescht.
    // Fortschritt und last_attempt der Schueler muessen manuell geloescht werden
    // (sie referenzieren nur user_id, nicht class_id).
    db.transaction(() => {
      // Schüler-IDs der Klasse holen bevor Memberships weg sind
      const members = db.prepare('SELECT user_id FROM memberships WHERE class_id = ?').all(classId) as { user_id: number }[]

      for (const m of members) {
        db.prepare('DELETE FROM progress WHERE user_id = ?').run(m.user_id)
        db.prepare('DELETE FROM last_attempt WHERE user_id = ?').run(m.user_id)
      }

      // Klasse loeschen (cascaded: memberships, lesson_settings, quiz_rooms)
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId)
    })()

    return reply.send({ ok: true })
  })

  // -------------------------------------------------------------------------
  // POST /api/teacher/classes/:id/code - Join-Code neu erzeugen
  // -------------------------------------------------------------------------
  fastify.post('/classes/:id/code', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    let joinCode: string
    let attempts = 0
    do {
      joinCode = generateJoinCode()
      attempts++
      if (attempts > 10) return reply.code(500).send({ fehler: 'Code-Erzeugung fehlgeschlagen.' })
    } while (db.prepare('SELECT id FROM classes WHERE join_code = ?').get(joinCode))

    db.prepare('UPDATE classes SET join_code = ? WHERE id = ?').run(joinCode, classId)

    return reply.send({ ok: true, join_code: joinCode })
  })

  // -------------------------------------------------------------------------
  // GET /api/teacher/classes/:id/dashboard
  // Fokus-Lektion: je Schueler fertig/dran/haengt fest
  //
  // Haengt-fest-Regel:
  //   >= 3 Versuche ohne Erfolg am aktuellen Schritt (done=0, attempts >= 3)
  //   ODER letzter Versuch hatte Fehler (error_msg != '') und liegt > 5 min zurueck.
  // -------------------------------------------------------------------------
  fastify.get('/classes/:id/dashboard', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const focusLessonId = cls.focus_lesson

    // Schueler der Klasse
    const students = db.prepare(`
      SELECT u.id, u.display_name
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ?
      ORDER BY u.display_name
    `).all(classId) as { id: number; display_name: string }[]

    const nowTs = Math.floor(Date.now() / 1000)
    const stuckThresholdTs = nowTs - 300 // 5 Minuten

    const result = students.map(student => {
      if (!focusLessonId) {
        return { user_id: student.id, display_name: student.display_name, status: 'kein_fokus' as const }
      }

      // Authoritative Gesamtzahl der Uebungsschritte aus lesson-steps.json
      const totalSteps = lessonExerciseSteps(focusLessonId)

      // Alle Schritte dieser Lektion fuer den Schueler (pro Schritt eine Zeile, step = 0-basiert)
      const steps = db.prepare(
        'SELECT step, done, attempts FROM progress WHERE user_id = ? AND lesson_id = ?'
      ).all(student.id, focusLessonId) as { step: number; done: number; attempts: number }[]

      const doneSteps = steps.filter(s => s.done === 1).length

      // Haengt-fest-Pruefung: mindestens ein offener Schritt mit >= 3 Versuchen
      // oder letzter Versuch mit Fehler vor > 5 min
      const stuckStep = steps.find(s => {
        if (s.done === 1) return false
        if (s.attempts >= 3) return true
        // Pruefen ob last_attempt Fehler > 5 min zurueck
        const la = db.prepare(
          'SELECT error_msg, updated_at FROM last_attempt WHERE user_id = ? AND lesson_id = ? AND step = ?'
        ).get(student.id, focusLessonId, s.step) as { error_msg: string; updated_at: number } | undefined
        return la !== undefined && la.error_msg !== '' && la.updated_at < stuckThresholdTs
      })

      let status: 'fertig' | 'dran' | 'haengt_fest' | 'noch_nicht_begonnen'
      if (stuckStep !== undefined) {
        status = 'haengt_fest'
      } else if (totalSteps > 0 && doneSteps >= totalSteps) {
        // fertig: alle Uebungsschritte erledigt (doneSteps >= totalSteps als Absicherung)
        status = 'fertig'
      } else if (steps.length > 0) {
        status = 'dran'
      } else {
        status = 'noch_nicht_begonnen'
      }

      return {
        user_id: student.id,
        display_name: student.display_name,
        status,
        steps_done: doneSteps,
        steps_total: totalSteps,
      }
    })

    return reply.send({
      class_id: classId,
      focus_lesson: focusLessonId,
      students: result,
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/teacher/classes/:id/matrix - Schueler x Lektionen Matrix
  // -------------------------------------------------------------------------
  fastify.get('/classes/:id/matrix', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const students = db.prepare(`
      SELECT u.id, u.display_name
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ?
      ORDER BY u.display_name
    `).all(classId) as { id: number; display_name: string }[]

    const studentIds = students.map(s => s.id)

    if (studentIds.length === 0) {
      return reply.send({ class_id: classId, students: [], matrix: {} })
    }

    // Fortschritt aller Schueler der Klasse laden
    const placeholders = studentIds.map(() => '?').join(',')
    const allProgress = db.prepare(`
      SELECT user_id, lesson_id, done, attempts
      FROM progress
      WHERE user_id IN (${placeholders})
    `).all(...studentIds) as { user_id: number; lesson_id: string; done: number; attempts: number }[]

    // Matrix aufbauen: { [lesson_id]: { [user_id]: 'fertig'|'begonnen'|'nicht_begonnen' } }
    const byUser: Record<number, Record<string, { done: number; attempts: number }[]>> = {}
    for (const row of allProgress) {
      if (!byUser[row.user_id]) byUser[row.user_id] = {}
      if (!byUser[row.user_id][row.lesson_id]) byUser[row.user_id][row.lesson_id] = []
      byUser[row.user_id][row.lesson_id].push({ done: row.done, attempts: row.attempts })
    }

    // Lektionen ermitteln (alle die irgendein Schueler hat + lesson_settings)
    const lessonSettings = db.prepare(
      'SELECT lesson_id, unlocked, sort_order, is_focus FROM lesson_settings WHERE class_id = ? ORDER BY sort_order'
    ).all(classId) as { lesson_id: string; unlocked: number; sort_order: number; is_focus: number }[]

    const lessonIds = lessonSettings.length > 0
      ? lessonSettings.map(l => l.lesson_id)
      : [...new Set(allProgress.map(p => p.lesson_id))].sort()

    // Kompakter Fortschritt je Schueler x Lektion
    const matrix: Record<string, Record<string, string>> = {}
    for (const lessonId of lessonIds) {
      matrix[lessonId] = {}
      const totalExerciseSteps = lessonExerciseSteps(lessonId)
      for (const student of students) {
        const steps = byUser[student.id]?.[lessonId] ?? []
        if (steps.length === 0) {
          matrix[lessonId][student.id] = 'nicht_begonnen'
        } else if (totalExerciseSteps > 0 && steps.filter(s => s.done === 1).length >= totalExerciseSteps) {
          // fertig: authoritative Anzahl der Uebungsschritte alle erledigt
          matrix[lessonId][student.id] = 'fertig'
        } else {
          matrix[lessonId][student.id] = 'begonnen'
        }
      }
    }

    return reply.send({ class_id: classId, students, lesson_ids: lessonIds, matrix })
  })

  // -------------------------------------------------------------------------
  // GET /api/teacher/classes/:id/students/:uid/last-attempt
  // Letzte Abfrage + Fehler eines Schuelers (K4)
  // -------------------------------------------------------------------------
  fastify.get('/classes/:id/students/:uid/last-attempt', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string; uid: string }).id)
    const userId = Number((req.params as { id: string; uid: string }).uid)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    // Mitgliedschaft pruefen
    const member = db.prepare(
      'SELECT id FROM memberships WHERE class_id = ? AND user_id = ?'
    ).get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    // Letzte Versuche (K4: nur letzte Abfrage + Fehler, kein Abfragetext ausser fuer Debugging)
    const attempts = db.prepare(
      'SELECT lesson_id, step, query, error_msg, updated_at FROM last_attempt WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(userId) as { lesson_id: string; step: number; query: string; error_msg: string; updated_at: number }[]

    return reply.send({ user_id: userId, last_attempts: attempts })
  })

  // -------------------------------------------------------------------------
  // PUT /api/teacher/classes/:id/lessons - Lektionseinstellungen setzen
  // -------------------------------------------------------------------------
  fastify.put('/classes/:id/lessons', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const parsed = putLessonsSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }

    const { lessons } = parsed.data

    // Sicherstellen: hoechstens eine Fokus-Lektion
    const focusCount = lessons.filter(l => l.is_focus).length
    if (focusCount > 1) {
      return reply.code(400).send({ fehler: 'Nur eine Fokus-Lektion erlaubt.' })
    }

    const focusLesson = lessons.find(l => l.is_focus)?.lesson_id ?? null

    db.transaction(() => {
      // Alle alten Einstellungen loeschen und neu einfuegen
      db.prepare('DELETE FROM lesson_settings WHERE class_id = ?').run(classId)

      const insert = db.prepare(`
        INSERT INTO lesson_settings (class_id, lesson_id, unlocked, sort_order, is_focus)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const lesson of lessons) {
        insert.run(classId, lesson.lesson_id, lesson.unlocked ? 1 : 0, lesson.sort_order, lesson.is_focus ? 1 : 0)
      }

      // focus_lesson in classes aktualisieren (Denormalisierung fuer schnelle Abfrage)
      db.prepare('UPDATE classes SET focus_lesson = ? WHERE id = ?').run(focusLesson, classId)
    })()

    return reply.send({ ok: true, focus_lesson: focusLesson })
  })

  // -------------------------------------------------------------------------
  // GET /api/teacher/classes/:id/students - Schuelerliste
  // -------------------------------------------------------------------------
  fastify.get('/classes/:id/students', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const students = db.prepare(`
      SELECT u.id, u.username, u.display_name, m.joined_at
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ?
      ORDER BY u.display_name
    `).all(classId) as { id: number; username: string; display_name: string; joined_at: number }[]

    return reply.send({ students })
  })

  // -------------------------------------------------------------------------
  // PATCH /api/teacher/classes/:id/students/:uid - Anzeigename umbenennen
  // -------------------------------------------------------------------------
  fastify.patch('/classes/:id/students/:uid', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string; uid: string }).id)
    const userId = Number((req.params as { id: string; uid: string }).uid)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const member = db.prepare('SELECT id FROM memberships WHERE class_id = ? AND user_id = ?').get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    const parsed = patchStudentSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }

    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(parsed.data.display_name, userId)

    return reply.send({ ok: true })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/teacher/classes/:id/students/:uid
  // Schueler aus Klasse entfernen + klassenbezogenen Fortschritt loeschen (K8)
  // -------------------------------------------------------------------------
  fastify.delete('/classes/:id/students/:uid', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string; uid: string }).id)
    const userId = Number((req.params as { id: string; uid: string }).uid)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const member = db.prepare('SELECT id FROM memberships WHERE class_id = ? AND user_id = ?').get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    // K8: Mitgliedschaft + klassenbezogener Fortschritt loeschen
    db.transaction(() => {
      db.prepare('DELETE FROM memberships WHERE class_id = ? AND user_id = ?').run(classId, userId)
      // Klassenbezogenen Fortschritt loeschen (K8)
      db.prepare('DELETE FROM progress WHERE user_id = ?').run(userId)
      db.prepare('DELETE FROM last_attempt WHERE user_id = ?').run(userId)
    })()

    return reply.send({ ok: true })
  })

  // -------------------------------------------------------------------------
  // POST /api/teacher/classes/:id/students/:uid/password-reset
  // Lehrkraft setzt Einmal-Passwort fuer Schueler (K3)
  // Neuer Hash mit gleichem Benutzernamen und Erstellungstag des Schuelers.
  // must_change_password wird gesetzt -> Schueler muss beim naechsten Login aendern.
  // -------------------------------------------------------------------------
  fastify.post('/classes/:id/students/:uid/password-reset', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string; uid: string }).id)
    const userId = Number((req.params as { id: string; uid: string }).uid)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const member = db.prepare('SELECT id FROM memberships WHERE class_id = ? AND user_id = ?').get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })

    const parsed = passwordResetSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungueltige Eingabe.', details: parsed.error.flatten() })
    }

    // Schuelerdaten laden (Benutzername + Erstellungstag fuer K3-Hash)
    const student = db.prepare(
      'SELECT username, created_day, role FROM users WHERE id = ?'
    ).get(userId) as { username: string; created_day: string; role: string } | undefined

    if (!student) return reply.code(404).send({ fehler: 'Schueler nicht gefunden.' })
    if (student.role !== 'student') {
      return reply.code(400).send({ fehler: 'Passwort-Reset nur fuer Schueler moeglich.' })
    }

    // K3: Hash mit demselben Benutzernamen und Tag (der Schueler bleibt als secret-Basis)
    const newHash = await hashPassword(
      parsed.data.new_password,
      normalizeUsername(student.username),
      student.created_day
    )

    db.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?'
    ).run(newHash, userId)

    return reply.send({ ok: true })
  })
}

export default teacherRoutes
