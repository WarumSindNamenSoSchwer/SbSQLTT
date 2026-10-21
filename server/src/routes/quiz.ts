/**
 * Quiz-REST-Routen fuer Lehrkraefte.
 *
 * /api/teacher/quizzes           - CRUD Fragensaetze (nur eigene)
 * /api/teacher/quiz-sessions     - Sitzungen starten, steuern, beenden
 *
 * Sicherheitsregeln:
 * - Nur role=teacher.
 * - Eine Lehrkraft sieht und aendert nur ihre eigenen Fragensaetze.
 *   Fremde liefern 404 (nicht 403), um Existenz nicht zu verraten.
 * - Keine IP-Spalten (K10).
 * - Keine Antworten oder Schuelerbezeichnungen in Logs (K5).
 * - K8: Konto loeschen und Klasse loeschen kaskadieren auf ON DELETE CASCADE.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import type { Db } from '../db.js'
import { validateSession, SESSION_COOKIE_NAME } from '../session.js'

// ---------------------------------------------------------------------------
// PIN-Erzeugung (ohne verwechselbare Zeichen, wie JOIN_CODE in teacher.ts)
// ---------------------------------------------------------------------------

const PIN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const PIN_LENGTH = 6

export function generatePin(): string {
  const bytes = randomBytes(PIN_LENGTH)
  return Array.from(bytes)
    .map(b => PIN_ALPHABET[b % PIN_ALPHABET.length])
    .join('')
}

// ---------------------------------------------------------------------------
// Auth-Hilfsfunktion
// ---------------------------------------------------------------------------

interface TeacherSession {
  user_id: number
}

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

// ---------------------------------------------------------------------------
// Zod-Schemas
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  question: z.string().min(1).max(512),
  /** Optionaler SQL-Codeblock fuer Beamer/Handy-Anzeige */
  code: z.string().max(2048).optional(),
  options: z.array(z.string().min(1).max(256)).min(2).max(4),
  correct_idx: z.number().int().min(0).max(3),
  time_limit: z.number().int().min(1).max(120).default(20),
})

const createQuizSchema = z.object({
  title: z.string().min(1).max(128),
  questions: z.array(questionSchema).min(1).max(50),
})

const patchQuizSchema = z.object({
  title: z.string().min(1).max(128).optional(),
  questions: z.array(questionSchema).min(1).max(50).optional(),
})

const startSessionSchema = z.object({
  quiz_id: z.number().int().positive(),
  /** Optionaler Klassen-Bezug (K4) */
  class_id: z.number().int().positive().optional(),
})

// ---------------------------------------------------------------------------
// DB-Typen
// ---------------------------------------------------------------------------

interface QuizRow {
  id: number
  teacher_id: number
  title: string
  source: string
  created_at: number
}

interface QuestionRow {
  id: number
  set_id: number
  position: number
  question: string
  code: string | null
  options: string
  correct_idx: number
  time_limit: number
}

interface RoomRow {
  id: number
  class_id: number | null
  set_id: number
  state: string
  current_q: number
  pin: string | null
  current_question_id: number | null
  current_question_started_at: number | null
  started_at: number | null
  ended_at: number | null
  created_at: number
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface QuizRoutesOptions {
  db: Db
}

const quizRoutes: FastifyPluginAsync<QuizRoutesOptions> = async (fastify, opts) => {
  const { db } = opts

  // ==========================================================================
  // Fragensaetze (quizzes)
  // ==========================================================================

  // GET /api/teacher/quizzes - Alle eigenen Fragensaetze
  fastify.get('/quizzes', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const sets = db.prepare(
      'SELECT id, title, source, created_at FROM quiz_question_sets WHERE teacher_id = ? ORDER BY created_at DESC'
    ).all(teacher.user_id) as { id: number; title: string; source: string; created_at: number }[]

    return sets
  })

  // GET /api/teacher/quizzes/:id - Einzelner Fragensatz mit Fragen
  fastify.get('/quizzes/:id', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const quizId = parseInt(id, 10)
    if (isNaN(quizId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const quiz = db.prepare(
      'SELECT id, teacher_id, title, source, created_at FROM quiz_question_sets WHERE id = ?'
    ).get(quizId) as QuizRow | undefined

    if (!quiz || quiz.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Fragensatz nicht gefunden.' })
    }

    const questions = db.prepare(
      'SELECT id, position, question, code, options, correct_idx, time_limit FROM quiz_questions WHERE set_id = ? ORDER BY position'
    ).all(quizId) as QuestionRow[]

    return {
      id: quiz.id,
      title: quiz.title,
      source: quiz.source,
      created_at: quiz.created_at,
      questions: questions.map(q => ({
        id: q.id,
        position: q.position,
        question: q.question,
        ...(q.code ? { code: q.code } : {}),
        options: JSON.parse(q.options) as string[],
        correct_idx: q.correct_idx,
        time_limit: q.time_limit,
      })),
    }
  })

  // POST /api/teacher/quizzes - Neuen Fragensatz anlegen
  fastify.post('/quizzes', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const parsed = createQuizSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
    }
    const { title, questions } = parsed.data

    const result = db.transaction(() => {
      const setResult = db.prepare(
        "INSERT INTO quiz_question_sets (teacher_id, title, source) VALUES (?, ?, 'custom')"
      ).run(teacher.user_id, title)
      const setId = setResult.lastInsertRowid as number

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        db.prepare(
          'INSERT INTO quiz_questions (set_id, position, question, code, options, correct_idx, time_limit) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(setId, i + 1, q.question, q.code ?? null, JSON.stringify(q.options), q.correct_idx, q.time_limit)
      }

      return setId
    })()

    return reply.code(201).send({ id: result })
  })

  // PATCH /api/teacher/quizzes/:id - Fragensatz aktualisieren
  fastify.patch('/quizzes/:id', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const quizId = parseInt(id, 10)
    if (isNaN(quizId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const quiz = db.prepare(
      'SELECT id, teacher_id FROM quiz_question_sets WHERE id = ?'
    ).get(quizId) as QuizRow | undefined

    if (!quiz || quiz.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Fragensatz nicht gefunden.' })
    }

    const parsed = patchQuizSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
    }
    const { title, questions } = parsed.data

    db.transaction(() => {
      if (title !== undefined) {
        db.prepare('UPDATE quiz_question_sets SET title = ? WHERE id = ?').run(title, quizId)
      }
      if (questions !== undefined) {
        db.prepare('DELETE FROM quiz_questions WHERE set_id = ?').run(quizId)
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i]
          db.prepare(
            'INSERT INTO quiz_questions (set_id, position, question, code, options, correct_idx, time_limit) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(quizId, i + 1, q.question, q.code ?? null, JSON.stringify(q.options), q.correct_idx, q.time_limit)
        }
      }
    })()

    return { ok: true }
  })

  // DELETE /api/teacher/quizzes/:id - Fragensatz loeschen
  fastify.delete('/quizzes/:id', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const quizId = parseInt(id, 10)
    if (isNaN(quizId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const quiz = db.prepare(
      'SELECT id, teacher_id FROM quiz_question_sets WHERE id = ?'
    ).get(quizId) as QuizRow | undefined

    if (!quiz || quiz.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Fragensatz nicht gefunden.' })
    }

    db.prepare('DELETE FROM quiz_question_sets WHERE id = ?').run(quizId)
    return { ok: true }
  })

  // ==========================================================================
  // Quiz-Sitzungen (quiz-sessions)
  // ==========================================================================

  // POST /api/teacher/quiz-sessions - Neue Sitzung starten
  fastify.post('/quiz-sessions', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const parsed = startSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.', details: parsed.error.flatten() })
    }
    const { quiz_id, class_id } = parsed.data

    // Eigentuemerschaft pruefen
    const quiz = db.prepare(
      'SELECT id, teacher_id FROM quiz_question_sets WHERE id = ?'
    ).get(quiz_id) as QuizRow | undefined
    if (!quiz || quiz.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Fragensatz nicht gefunden.' })
    }

    // Optionale Klasse pruefen
    if (class_id !== undefined) {
      const cls = db.prepare(
        'SELECT id FROM classes WHERE id = ? AND teacher_id = ?'
      ).get(class_id, teacher.user_id) as { id: number } | undefined
      if (!cls) {
        return reply.code(404).send({ fehler: 'Klasse nicht gefunden.' })
      }
    }

    // Eindeutigen PIN generieren (bis zu 10 Versuche)
    let pin: string | null = null
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generatePin()
      const existing = db.prepare(
        "SELECT id FROM quiz_rooms WHERE pin = ? AND state != 'ended'"
      ).get(candidate)
      if (!existing) {
        pin = candidate
        break
      }
    }
    if (!pin) {
      return reply.code(503).send({ fehler: 'Kein PIN verfügbar. Bitte erneut versuchen.' })
    }

    // Sitzung anlegen (class_id kann NULL sein - Gast-Modus)
    const roomResult = db.prepare(
      `INSERT INTO quiz_rooms (class_id, set_id, state, pin, current_q)
       VALUES (?, ?, 'lobby', ?, 0)`
    ).run(class_id ?? null, quiz_id, pin)

    const roomId = roomResult.lastInsertRowid as number
    return reply.code(201).send({ id: roomId, pin })
  })

  // GET /api/teacher/quiz-sessions/:id - Sitzungsstatus (fuer Reconnect)
  fastify.get('/quiz-sessions/:id', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const roomId = parseInt(id, 10)
    if (isNaN(roomId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const room = db.prepare(
      `SELECT r.id, r.set_id, r.state, r.current_q, r.pin, r.ended_at,
              r.current_question_id, r.current_question_started_at,
              qs.teacher_id
       FROM quiz_rooms r
       JOIN quiz_question_sets qs ON r.set_id = qs.id
       WHERE r.id = ?`
    ).get(roomId) as (RoomRow & { teacher_id: number }) | undefined

    if (!room || room.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Sitzung nicht gefunden.' })
    }

    const participants = db.prepare(
      'SELECT display_name, total_points FROM quiz_participants WHERE room_id = ? ORDER BY total_points DESC'
    ).all(roomId) as { display_name: string; total_points: number }[]

    const answerCount = (db.prepare(
      'SELECT COUNT(DISTINCT participant_id) as cnt FROM quiz_answers WHERE room_id = ? AND question_id = ?'
    ).get(roomId, room.current_question_id ?? 0) as { cnt: number } | undefined)?.cnt ?? 0

    return {
      id: room.id,
      state: room.state,
      current_q: room.current_q,
      pin: room.pin,
      ended_at: room.ended_at,
      current_question_id: room.current_question_id,
      current_question_started_at: room.current_question_started_at,
      participants,
      answer_count: answerCount,
    }
  })

  // POST /api/teacher/quiz-sessions/:id/next - Naechste Frage starten
  fastify.post('/quiz-sessions/:id/next', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const roomId = parseInt(id, 10)
    if (isNaN(roomId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const room = db.prepare(
      `SELECT r.id, r.set_id, r.state, r.current_q, qs.teacher_id
       FROM quiz_rooms r
       JOIN quiz_question_sets qs ON r.set_id = qs.id
       WHERE r.id = ?`
    ).get(roomId) as (RoomRow & { teacher_id: number }) | undefined

    if (!room || room.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Sitzung nicht gefunden.' })
    }

    if (room.state === 'ended') {
      return reply.code(409).send({ fehler: 'Sitzung bereits beendet.' })
    }

    // Fragen des Sets holen
    const questions = db.prepare(
      'SELECT id, position, question, options, correct_idx, time_limit FROM quiz_questions WHERE set_id = ? ORDER BY position'
    ).all(room.set_id) as QuestionRow[]

    if (questions.length === 0) {
      return reply.code(409).send({ fehler: 'Keine Fragen vorhanden.' })
    }

    const nextIndex = room.state === 'lobby' ? 0 : room.current_q // current_q = 1-based index of last shown
    if (room.state !== 'lobby' && nextIndex >= questions.length) {
      return reply.code(409).send({ fehler: 'Alle Fragen wurden bereits gestellt.' })
    }

    const nextQuestion = questions[room.state === 'lobby' ? 0 : room.current_q]
    if (!nextQuestion) {
      return reply.code(409).send({ fehler: 'Keine weitere Frage.' })
    }

    const now = Math.floor(Date.now() / 1000)
    const newIndex = room.state === 'lobby' ? 1 : room.current_q + 1

    db.prepare(
      `UPDATE quiz_rooms SET state = 'question', current_q = ?, current_question_id = ?,
       current_question_started_at = ?, started_at = COALESCE(started_at, ?)
       WHERE id = ?`
    ).run(newIndex, nextQuestion.id, now, now, roomId)

    return {
      question_index: newIndex,
      question_id: nextQuestion.id,
      question: nextQuestion.question,
      options: JSON.parse(nextQuestion.options) as string[],
      time_limit: nextQuestion.time_limit,
      started_at: now,
    }
  })

  // POST /api/teacher/quiz-sessions/:id/reveal - Aktuelle Frage aufloesen
  fastify.post('/quiz-sessions/:id/reveal', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const roomId = parseInt(id, 10)
    if (isNaN(roomId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const room = db.prepare(
      `SELECT r.id, r.set_id, r.state, r.current_q, r.current_question_id, qs.teacher_id
       FROM quiz_rooms r
       JOIN quiz_question_sets qs ON r.set_id = qs.id
       WHERE r.id = ?`
    ).get(roomId) as (RoomRow & { teacher_id: number }) | undefined

    if (!room || room.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Sitzung nicht gefunden.' })
    }

    if (room.state !== 'question') {
      return reply.code(409).send({ fehler: 'Keine laufende Frage zum Auflösen.' })
    }

    db.prepare("UPDATE quiz_rooms SET state = 'reveal' WHERE id = ?").run(roomId)

    // Antwortstatistiken berechnen
    const question = db.prepare(
      'SELECT correct_idx, options FROM quiz_questions WHERE id = ?'
    ).get(room.current_question_id) as { correct_idx: number; options: string } | undefined

    if (!question) {
      return { ok: true }
    }

    const options = JSON.parse(question.options) as string[]
    const answers = db.prepare(
      'SELECT chosen_idx, COUNT(*) as cnt FROM quiz_answers WHERE room_id = ? AND question_id = ? AND chosen_idx IS NOT NULL GROUP BY chosen_idx'
    ).all(roomId, room.current_question_id) as { chosen_idx: number; cnt: number }[]

    const counts = new Array<number>(options.length).fill(0)
    let totalAnswers = 0
    let correctCount = 0

    for (const row of answers) {
      if (row.chosen_idx >= 0 && row.chosen_idx < counts.length) {
        counts[row.chosen_idx] = row.cnt
        totalAnswers += row.cnt
        if (row.chosen_idx === question.correct_idx) {
          correctCount = row.cnt
        }
      }
    }

    return {
      correct_idx: question.correct_idx,
      answer_counts: counts,
      correct_ratio: totalAnswers > 0 ? correctCount / totalAnswers : 0,
      total_answers: totalAnswers,
    }
  })

  // POST /api/teacher/quiz-sessions/:id/end - Sitzung beenden
  fastify.post('/quiz-sessions/:id/end', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const roomId = parseInt(id, 10)
    if (isNaN(roomId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const room = db.prepare(
      `SELECT r.id, r.set_id, r.state, qs.teacher_id
       FROM quiz_rooms r
       JOIN quiz_question_sets qs ON r.set_id = qs.id
       WHERE r.id = ?`
    ).get(roomId) as (RoomRow & { teacher_id: number }) | undefined

    if (!room || room.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Sitzung nicht gefunden.' })
    }

    if (room.state === 'ended') {
      return reply.code(409).send({ fehler: 'Sitzung bereits beendet.' })
    }

    const now = Math.floor(Date.now() / 1000)
    db.prepare("UPDATE quiz_rooms SET state = 'ended', ended_at = ? WHERE id = ?").run(now, roomId)

    return { ok: true, ended_at: now }
  })

  // GET /api/teacher/quiz-sessions/:id/result - Ergebnis (auch nach 24h: nur Stats)
  fastify.get('/quiz-sessions/:id/result', async (req, reply) => {
    const teacher = await requireTeacher(db, req, reply)
    if (!teacher) return

    const { id } = req.params as { id: string }
    const roomId = parseInt(id, 10)
    if (isNaN(roomId)) return reply.code(400).send({ fehler: 'Ungültige ID.' })

    const room = db.prepare(
      `SELECT r.id, r.set_id, r.state, r.ended_at, qs.teacher_id
       FROM quiz_rooms r
       JOIN quiz_question_sets qs ON r.set_id = qs.id
       WHERE r.id = ?`
    ).get(roomId) as (RoomRow & { teacher_id: number }) | undefined

    if (!room || room.teacher_id !== teacher.user_id) {
      return reply.code(404).send({ fehler: 'Sitzung nicht gefunden.' })
    }

    // Rangliste (falls noch vorhanden - 24h Fenster)
    const participants = db.prepare(
      'SELECT display_name, total_points FROM quiz_participants WHERE room_id = ? ORDER BY total_points DESC LIMIT 50'
    ).all(roomId) as { display_name: string; total_points: number }[]

    // Frage-Statistiken (bleiben dauerhaft)
    const stats = db.prepare(
      `SELECT qs.id as question_id, qq.question, qq.correct_idx,
              qs.answer_counts, qs.correct_ratio, qs.answer_count, qs.avg_ms
       FROM quiz_question_stats qs
       JOIN quiz_questions qq ON qs.question_id = qq.id
       WHERE qs.room_id = ?
       ORDER BY qq.position`
    ).all(roomId) as {
      question_id: number
      question: string
      correct_idx: number
      answer_counts: string
      correct_ratio: number
      answer_count: number
      avg_ms: number | null
    }[]

    return {
      id: room.id,
      state: room.state,
      ended_at: room.ended_at,
      participants,
      question_stats: stats.map(s => ({
        question_id: s.question_id,
        question: s.question,
        correct_idx: s.correct_idx,
        answer_counts: JSON.parse(s.answer_counts) as number[],
        correct_ratio: s.correct_ratio,
        answer_count: s.answer_count,
        avg_ms: s.avg_ms,
      })),
    }
  })
}

export default quizRoutes
