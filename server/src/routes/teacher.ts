/**
 * Lehrkraft-API unter /api/teacher
 *
 * Sicherheitsregeln:
 * - Nur role=teacher darf diese Endpunkte aufrufen.
 * - Eine Lehrkraft sieht und ändert nur ihre eigenen Klassen.
 *   Fremde Klassen liefern 404 (nicht 403), um Existenz nicht zu verraten (K4).
 * - Keine IP-Adressen in DB (K10).
 * - Der Server kennt keine Schülernamen und keine Abfragen im Klartext (K1, K4). Er liefert
 *   enc_name und sealed aus, der Browser der Lehrkraft entschlüsselt.
 *
 * Klassencode: drei Wörter und eine Zahl, z. B. "blau-tiger-mond-42" (leicht abzutippen).
 *
 * Hängt-fest-Regel:
 * Ein Schüler gilt als "hängt fest" an einem Schritt, wenn
 *   - er >= 3 Versuche ohne Erfolg hat (done=0, attempts >= 3) ODER
 *   - der letzte Versuch einen Fehler hatte (has_error = 1) UND länger als 5 Minuten zurückliegt.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomBytes, randomInt } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from '../db.js'
import { sha256hex } from '../db.js'
import { validateSession, SESSION_COOKIE_NAME } from '../session.js'

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
// Klassencode: Wörter statt Zeichensalat (an der Tafel lesbar, an Schul-PCs leicht zu tippen)
// ---------------------------------------------------------------------------

const CODE_WORDS = [
  'adler', 'ampel', 'anker', 'apfel', 'baum', 'berg', 'birne', 'blatt', 'blau', 'blitz', 'boot', 'brot',
  'burg', 'dach', 'delfin', 'drache', 'eiche', 'eimer', 'elch', 'ente', 'erde', 'eule', 'falke', 'farn',
  'feder', 'feld', 'fels', 'fisch', 'fluss', 'fuchs', 'gabel', 'garten', 'geige', 'gold', 'gras', 'hafen',
  'hammer', 'hase', 'himmel', 'hirsch', 'honig', 'horn', 'hund', 'igel', 'insel', 'kaktus', 'kamel', 'kanu',
  'karte', 'katze', 'kerze', 'kiwi', 'klee', 'koala', 'krone', 'kugel', 'lampe', 'linde', 'luchs', 'mantel',
  'meer', 'melone', 'mond', 'nebel', 'nest', 'oase', 'otter', 'palme', 'panda', 'pilz', 'pirat', 'planet',
  'rabe', 'regen', 'rose', 'sand', 'schaf', 'schiff', 'segel', 'sonne', 'spatz', 'stern', 'storch', 'tanne',
  'tiger', 'turm', 'vogel', 'wald', 'welle', 'wiese', 'wind', 'wolf', 'wolke', 'zebra', 'zelt', 'zitrone',
]

/** Klassencode, z. B. "blau-tiger-mond-42" (etwa 26 Bit, Raten wird zusätzlich gebremst). */
export function generateJoinCode(): string {
  const w = () => CODE_WORDS[randomInt(CODE_WORDS.length)]
  return `${w()}-${w()}-${w()}-${randomInt(10, 100)}`
}

function uniqueJoinCode(db: Db): string | null {
  for (let i = 0; i < 20; i++) {
    const code = generateJoinCode()
    if (!db.prepare('SELECT id FROM classes WHERE join_code = ?').get(code)) return code
  }
  return null
}

/** Einmal-Code für vergessene Schüler-Passwörter: 8 Zeichen ohne verwechselbare Zeichen. */
const RESET_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const RESET_TTL_S = 15 * 60
function generateResetCode(): string {
  return Array.from({ length: 8 }, () => RESET_ALPHABET[randomInt(RESET_ALPHABET.length)]).join('')
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
                AND la.has_error = 1
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
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
    }

    const joinCode = uniqueJoinCode(db)
    if (!joinCode) return reply.code(500).send({ fehler: 'Code-Erzeugung fehlgeschlagen.' })

    const result = db.prepare(
      'INSERT INTO classes (teacher_id, name, join_code, class_salt) VALUES (?, ?, ?, ?)'
    ).run(session.user_id, parsed.data.name, joinCode, randomBytes(16).toString('hex'))

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
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
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

    // K8: Klasse löschen. Die Schüler existieren nur in dieser Klasse und werden mit allen
    // Daten gelöscht (Fortschritt, letzte Abfrage, Sitzungen per CASCADE). Danach die Klasse
    // selbst (cascaded: memberships, lesson_settings, quiz_rooms).
    db.transaction(() => {
      db.prepare(
        `DELETE FROM users WHERE role = 'student' AND id IN (SELECT user_id FROM memberships WHERE class_id = ?)`
      ).run(classId)
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

    const joinCode = uniqueJoinCode(db)
    if (!joinCode) return reply.code(500).send({ fehler: 'Code-Erzeugung fehlgeschlagen.' })

    // Nur der Code ändert sich, das Klassen-Salz bleibt: angemeldete Schüler loggen sich mit dem neuen Code ein.
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
      SELECT u.id, u.enc_name
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ?
      ORDER BY m.joined_at
    `).all(classId) as { id: number; enc_name: string | null }[]

    const nowTs = Math.floor(Date.now() / 1000)
    const stuckThresholdTs = nowTs - 300 // 5 Minuten

    const result = students.map(student => {
      if (!focusLessonId) {
        return { user_id: student.id, enc_name: student.enc_name, status: 'kein_fokus' as const }
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
          'SELECT has_error, updated_at FROM last_attempt WHERE user_id = ? AND lesson_id = ? AND step = ?'
        ).get(student.id, focusLessonId, s.step) as { has_error: number; updated_at: number } | undefined
        return la !== undefined && la.has_error === 1 && la.updated_at < stuckThresholdTs
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

      // Aktueller Schritt: erster offener Schritt (sonst letzter erledigter), Versuche dort, letzte Aktivitaet
      const open = steps.filter(s => s.done === 0).sort((a, b) => a.step - b.step)
      const current = stuckStep ?? open[0] ?? null
      const lastActive = (db.prepare(
        'SELECT MAX(updated_at) AS t FROM progress WHERE user_id = ? AND lesson_id = ?'
      ).get(student.id, focusLessonId) as { t: number | null }).t

      return {
        user_id: student.id,
        enc_name: student.enc_name,
        status,
        steps_done: doneSteps,
        steps_total: totalSteps,
        current_step: current ? current.step : null,
        attempts: current ? current.attempts : 0,
        last_active: lastActive ?? null,
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
      SELECT u.id, u.enc_name
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ?
      ORDER BY m.joined_at
    `).all(classId) as { id: number; enc_name: string | null }[]

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
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    // Mitgliedschaft pruefen
    const member = db.prepare(
      'SELECT id FROM memberships WHERE class_id = ? AND user_id = ?'
    ).get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    // Letzte Versuche (K4): Abfrage und Fehlermeldung nur verschlüsselt (sealed), der Browser
    // der Lehrkraft entschlüsselt. has_error sagt, ob der Versuch einen Fehler hatte.
    const attempts = db.prepare(
      'SELECT lesson_id, step, sealed, has_error, updated_at FROM last_attempt WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(userId) as { lesson_id: string; step: number; sealed: string; has_error: number; updated_at: number }[]

    return reply.send({ user_id: userId, last_attempts: attempts })
  })

  // -------------------------------------------------------------------------
  // GET /api/teacher/classes/:id/lessons - Lektionseinstellungen lesen (D4)
  // -------------------------------------------------------------------------
  fastify.get('/classes/:id/lessons', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return
    const classId = Number((req.params as { id: string }).id)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return
    const rows = db.prepare(
      'SELECT lesson_id, unlocked, sort_order, is_focus FROM lesson_settings WHERE class_id = ? ORDER BY sort_order'
    ).all(classId) as { lesson_id: string; unlocked: number; sort_order: number; is_focus: number }[]
    return reply.send({
      lessons: rows.map((r) => ({ lesson_id: r.lesson_id, unlocked: r.unlocked === 1, sort_order: r.sort_order, is_focus: r.is_focus === 1 })),
    })
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
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
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
      SELECT u.id, u.enc_name, m.joined_at, u.last_login_at
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ?
      ORDER BY m.joined_at
    `).all(classId) as { id: number; enc_name: string | null; joined_at: number; last_login_at: number | null }[]

    return reply.send({ students })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/teacher/classes/:id/students/:uid
  // Schüler aus der Klasse entfernen (K8). Der Schüler existiert nur in dieser Klasse,
  // also wird er mit allen Daten gelöscht (Fortschritt, letzte Abfrage, Sitzungen per CASCADE).
  // -------------------------------------------------------------------------
  fastify.delete('/classes/:id/students/:uid', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string; uid: string }).id)
    const userId = Number((req.params as { id: string; uid: string }).uid)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const member = db.prepare('SELECT id FROM memberships WHERE class_id = ? AND user_id = ?').get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    db.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").run(userId)

    return reply.send({ ok: true })
  })

  // -------------------------------------------------------------------------
  // POST /api/teacher/classes/:id/students/:uid/reset-code
  // Einmal-Code für einen Schüler, der sein Passwort vergessen hat (K1).
  // 15 Minuten gültig, nur als Hash gespeichert. Der Schüler legt damit selbst ein neues
  // Passwort fest (POST /api/class-login/reset). Ein neuer Code ersetzt einen alten.
  // -------------------------------------------------------------------------
  fastify.post('/classes/:id/students/:uid/reset-code', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string; uid: string }).id)
    const userId = Number((req.params as { id: string; uid: string }).uid)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    const member = db.prepare('SELECT id FROM memberships WHERE class_id = ? AND user_id = ?').get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    const code = generateResetCode()
    const expiresAt = Math.floor(Date.now() / 1000) + RESET_TTL_S
    db.transaction(() => {
      db.prepare('DELETE FROM student_reset_codes WHERE user_id = ?').run(userId)
      db.prepare('INSERT INTO student_reset_codes (code_hash, user_id, class_id, expires_at) VALUES (?, ?, ?, ?)')
        .run(sha256hex(code), userId, classId, expiresAt)
    })()

    return reply.send({ ok: true, code, expires_at: expiresAt })
  })

  // -------------------------------------------------------------------------
  // POST /api/teacher/classes/:id/students/:uid/complete
  // Lehrkraft markiert einen Schritt eines Schuelers als erledigt (progress.done=1).
  // Sicherheit: nur eigene Klasse, nur Mitglieder der Klasse.
  // -------------------------------------------------------------------------

  const completeSchema = z.object({
    lesson_id: z.string().min(1).max(64),
    step: z.number().int().min(0),
  })

  fastify.post('/classes/:id/students/:uid/complete', async (req, reply) => {
    const session = await requireTeacher(db, req, reply)
    if (!session) return

    const classId = Number((req.params as { id: string; uid: string }).id)
    const userId = Number((req.params as { id: string; uid: string }).uid)
    if (!Number.isInteger(classId) || classId <= 0) return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
    if (!Number.isInteger(userId) || userId <= 0) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    const cls = requireOwnClass(db, session.user_id, classId, reply)
    if (!cls) return

    // Mitgliedschaft pruefen (K4: Existenz nicht verraten -> 404 statt 403)
    const member = db.prepare(
      'SELECT id FROM memberships WHERE class_id = ? AND user_id = ?'
    ).get(classId, userId)
    if (!member) return reply.code(404).send({ fehler: 'Schüler nicht gefunden.' })

    const parsed = completeSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
    }

    const { lesson_id, step } = parsed.data

    // Schritt als erledigt markieren (upsert: existiert evtl. schon)
    db.prepare(`
      INSERT INTO progress (user_id, lesson_id, step, done, attempts, updated_at)
      VALUES (?, ?, ?, 1, 0, unixepoch())
      ON CONFLICT (user_id, lesson_id, step) DO UPDATE SET done = 1, updated_at = unixepoch()
    `).run(userId, lesson_id, step)

    return reply.send({ ok: true })
  })
}

export default teacherRoutes
