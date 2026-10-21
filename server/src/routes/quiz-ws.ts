/**
 * Quiz-WebSocket-Handler unter /api/quiz/ws
 *
 * Protokoll:
 *
 * VERBINDUNGSAUFBAU
 * Jeder Client sendet nach dem Upgrade sofort eine join-Nachricht:
 *
 *   Lehrkraft: { type: "teacher_join", room_id: number }   (Auth über Cookie tabula_session beim Upgrade)
 *   Schueler:  { type: "student_join", pin: string, display_name: string }
 *              (token optional: Session-Cookie des registrierten Nutzers)
 *
 * NACHRICHTEN LEHRKRAFT -> SERVER
 *   { type: "next_question" }         Naechste Frage zeigen
 *   { type: "reveal" }                Aktuelle Frage aufloesen
 *   { type: "end_quiz" }              Sitzung beenden
 *
 * NACHRICHTEN SERVER -> CLIENT (alle)
 *   { type: "lobby_state", participants: string[], count: number }
 *   { type: "question_start", question_index: number, question_id: number,
 *           question: string, options: string[], time_limit: number,
 *           started_at: number }
 *   { type: "answer_progress", count: number, total: number }
 *   { type: "reveal", correct_idx: number, answer_counts: number[],
 *           correct_ratio: number }
 *   { type: "leaderboard", rankings: {rank:number, display_name:string, points:number}[] }
 *   { type: "quiz_ended" }
 *   { type: "error", code: string, message: string }
 *
 * NACHRICHTEN SERVER -> SCHUELER (nur an diesen Schueler)
 *   { type: "answer_ack", correct: boolean, points: number, total_points: number }
 *   { type: "answer_too_late" }
 *   { type: "answer_duplicate" }
 *
 * NACHRICHTEN SCHUELER -> SERVER
 *   { type: "answer", question_id: number, chosen_idx: number }
 *
 * PUNKTE
 * Max. 1000 Punkte pro Frage. Schnellere Antworten geben mehr Punkte:
 *   points = round(1000 * (1 - (answer_ms / (time_limit_ms * 0.5 * 2)))^0.5)
 * Mindestpunkte bei richtiger Antwort: 100
 *
 * SICHERHEIT
 * - Origin-Check gegen ALLOWED_ORIGIN (wie CSRF)
 * - Rate-Limit fuer student_join (max. 10 Versuche pro Displayname in 1 Min.)
 * - Keine Antworten/Spielernamen in Logs (K5)
 * - Server ist Quelle der Wahrheit fuer Zeit und Punkte
 */
import type { FastifyPluginAsync } from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import type { WebSocket as WsSocket } from 'ws'
import type { Db } from '../db.js'
import { validateSession, SESSION_COOKIE_NAME } from '../session.js'
import { RateLimiter } from '../plugins/ratelimit.js'
// ---------------------------------------------------------------------------
// Typen fuer eingehende Nachrichten
// ---------------------------------------------------------------------------

interface TeacherJoin {
  type: 'teacher_join'
  room_id: number
  token?: string // nur Fallback; Browser authentifiziert per HttpOnly-Cookie beim Upgrade
}

interface StudentJoin {
  type: 'student_join'
  pin: string
  display_name: string
  token?: string // optional: Session-Cookie-Wert des registrierten Nutzers
}

interface NextQuestion {
  type: 'next_question'
}

interface RevealMsg {
  type: 'reveal'
}

interface EndQuiz {
  type: 'end_quiz'
}

interface StudentAnswer {
  type: 'answer'
  question_id: number
  chosen_idx: number
}

type IncomingMsg = TeacherJoin | StudentJoin | NextQuestion | RevealMsg | EndQuiz | StudentAnswer

// ---------------------------------------------------------------------------
// In-Memory-Raumzustand (Server-of-Truth)
// ---------------------------------------------------------------------------

interface ParticipantConn {
  ws: WsSocket
  participantId: number
  displayName: string
}

interface RoomState {
  teacherWs: WsSocket | null
  students: Map<WsSocket, ParticipantConn>
  // Wenn eine Frage laeuft: Endzeitpunkt in ms
  questionDeadlineMs: number | null
  currentQuestionId: number | null
  currentTimeLimitMs: number | null
}

// Globale Map: room_id -> RoomState
const rooms = new Map<number, RoomState>()

function getOrCreateRoom(roomId: number): RoomState {
  let room = rooms.get(roomId)
  if (!room) {
    room = {
      teacherWs: null,
      students: new Map(),
      questionDeadlineMs: null,
      currentQuestionId: null,
      currentTimeLimitMs: null,
    }
    rooms.set(roomId, room)
  }
  return room
}

function cleanupRoom(roomId: number): void {
  const room = rooms.get(roomId)
  if (!room) return
  if (room.teacherWs === null && room.students.size === 0) {
    rooms.delete(roomId)
  }
}

// ---------------------------------------------------------------------------
// Hilfs-Sende-Funktionen
// ---------------------------------------------------------------------------

function sendJson(ws: WsSocket, data: object): void {
  try {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(data))
    }
  } catch {
    // Ignorieren: Client hat Verbindung geschlossen
  }
}

function broadcastToRoom(room: RoomState, data: object, excludeWs?: WsSocket): void {
  if (room.teacherWs && room.teacherWs !== excludeWs) {
    sendJson(room.teacherWs, data)
  }
  for (const [ws] of room.students) {
    if (ws !== excludeWs) sendJson(ws, data)
  }
}

// ---------------------------------------------------------------------------
// Punkte-Berechnung (serversseitig, K5)
// ---------------------------------------------------------------------------

function calculatePoints(answerMs: number, timeLimitMs: number): number {
  if (answerMs > timeLimitMs) return 0
  // Punkte sinken mit der Zeit: sqrt-Abfall, Min. 100
  const ratio = Math.max(0, 1 - answerMs / timeLimitMs)
  const points = Math.round(1000 * Math.sqrt(ratio))
  return Math.max(100, Math.min(1000, points))
}

// ---------------------------------------------------------------------------
// Lehrkraft-Aktionen (Server-of-Truth)
// ---------------------------------------------------------------------------

interface QuestionRow {
  id: number
  position: number
  question: string
  options: string
  correct_idx: number
  time_limit: number
}

interface RoomRow {
  id: number
  set_id: number
  state: string
  current_q: number
  pin: string | null
  current_question_id: number | null
  current_question_started_at: number | null
  ended_at: number | null
}

function handleNextQuestion(db: Db, roomId: number, room: RoomState): void {
  const roomRow = db.prepare(
    `SELECT id, set_id, state, current_q, current_question_id FROM quiz_rooms WHERE id = ?`
  ).get(roomId) as RoomRow | undefined
  if (!roomRow) return

  if (roomRow.state === 'ended') {
    if (room.teacherWs) sendJson(room.teacherWs, { type: 'error', code: 'already_ended', message: 'Sitzung bereits beendet.' })
    return
  }

  const questions = db.prepare(
    'SELECT id, position, question, options, correct_idx, time_limit FROM quiz_questions WHERE set_id = ? ORDER BY position'
  ).all(roomRow.set_id) as QuestionRow[]

  const nextIdx = roomRow.state === 'lobby' ? 0 : roomRow.current_q
  if (roomRow.state !== 'lobby' && nextIdx >= questions.length) {
    if (room.teacherWs) sendJson(room.teacherWs, { type: 'error', code: 'no_more_questions', message: 'Alle Fragen gestellt.' })
    return
  }

  const nextQuestion = questions[nextIdx]
  if (!nextQuestion) return

  const now = Date.now()
  const nowS = Math.floor(now / 1000)
  const newIndex = roomRow.state === 'lobby' ? 1 : roomRow.current_q + 1

  db.prepare(
    `UPDATE quiz_rooms SET state = 'question', current_q = ?, current_question_id = ?,
     current_question_started_at = ?, started_at = COALESCE(started_at, ?)
     WHERE id = ?`
  ).run(newIndex, nextQuestion.id, nowS, nowS, roomId)

  const timeLimitMs = nextQuestion.time_limit * 1000
  room.questionDeadlineMs = now + timeLimitMs
  room.currentQuestionId = nextQuestion.id
  room.currentTimeLimitMs = timeLimitMs

  broadcastToRoom(room, {
    type: 'question_start',
    question_index: newIndex,
    question_id: nextQuestion.id,
    question: nextQuestion.question,
    options: JSON.parse(nextQuestion.options) as string[],
    time_limit: nextQuestion.time_limit,
    started_at: nowS,
  })
}

function handleReveal(db: Db, roomId: number, room: RoomState): void {
  const roomRow = db.prepare(
    `SELECT id, state, current_question_id FROM quiz_rooms WHERE id = ?`
  ).get(roomId) as RoomRow | undefined
  if (!roomRow) return

  if (roomRow.state !== 'question') {
    if (room.teacherWs) sendJson(room.teacherWs, { type: 'error', code: 'not_in_question', message: 'Keine laufende Frage.' })
    return
  }

  db.prepare("UPDATE quiz_rooms SET state = 'reveal' WHERE id = ?").run(roomId)
  room.questionDeadlineMs = null // Timer stoppen

  const question = db.prepare(
    'SELECT correct_idx, options FROM quiz_questions WHERE id = ?'
  ).get(roomRow.current_question_id) as { correct_idx: number; options: string } | undefined

  if (!question) return

  const options = JSON.parse(question.options) as string[]
  const answers = db.prepare(
    'SELECT chosen_idx, COUNT(*) as cnt FROM quiz_answers WHERE room_id = ? AND question_id = ? AND chosen_idx IS NOT NULL GROUP BY chosen_idx'
  ).all(roomId, roomRow.current_question_id) as { chosen_idx: number; cnt: number }[]

  const counts = new Array<number>(options.length).fill(0)
  let totalAnswers = 0
  let correctCount = 0
  for (const row of answers) {
    if (row.chosen_idx >= 0 && row.chosen_idx < counts.length) {
      counts[row.chosen_idx] = row.cnt
      totalAnswers += row.cnt
      if (row.chosen_idx === question.correct_idx) correctCount = row.cnt
    }
  }

  const revealMsg = {
    type: 'reveal',
    correct_idx: question.correct_idx,
    answer_counts: counts,
    correct_ratio: totalAnswers > 0 ? correctCount / totalAnswers : 0,
  }
  broadcastToRoom(room, revealMsg)

  // Rangliste senden
  sendLeaderboard(db, roomId, room)
}

function handleEndQuiz(db: Db, roomId: number, room: RoomState): void {
  const now = Math.floor(Date.now() / 1000)
  db.prepare("UPDATE quiz_rooms SET state = 'ended', ended_at = ? WHERE id = ?").run(now, roomId)
  room.questionDeadlineMs = null
  broadcastToRoom(room, { type: 'quiz_ended' })
}

function sendLeaderboard(db: Db, roomId: number, room: RoomState): void {
  const rankings = db.prepare(
    `SELECT display_name, total_points
     FROM quiz_participants
     WHERE room_id = ?
     ORDER BY total_points DESC
     LIMIT 20`
  ).all(roomId) as { display_name: string; total_points: number }[]

  broadcastToRoom(room, {
    type: 'leaderboard',
    rankings: rankings.map((r, i) => ({
      rank: i + 1,
      display_name: r.display_name,
      points: r.total_points,
    })),
  })
}

// ---------------------------------------------------------------------------
// Plugin-Optionen
// ---------------------------------------------------------------------------

export interface QuizWsOptions {
  db: Db
  allowedOrigin: string
  /** Nur fuer Tests: true deaktiviert den Origin-Check */
  skipOriginCheck?: boolean
}

// Rate-Limiter fuer Student-Join (in-memory, keine IPs - K10)
const joinRateLimiter = new RateLimiter(10, 60 * 1000)

// ---------------------------------------------------------------------------
// WebSocket-Plugin
// ---------------------------------------------------------------------------

const quizWsPlugin: FastifyPluginAsync<QuizWsOptions> = async (fastify, opts) => {
  const { db, allowedOrigin, skipOriginCheck } = opts

  await fastify.register(fastifyWebsocket)

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    // Origin-Check (wie CSRF, K5)
    if (!skipOriginCheck) {
      const origin = req.headers['origin']
      if (!origin || origin !== allowedOrigin) {
        socket.close(1008, 'Ungueltige Herkunft.')
        return
      }
    }

    let roomId: number | null = null
    let isTeacher = false
    let participantWsEntry: ParticipantConn | null = null
    // Sitzung aus dem HttpOnly-Cookie des Upgrade-Requests (Browser sendet es automatisch mit).
    // msg.token bleibt nur als Fallback für Tests/Nicht-Browser-Clients.
    const cookieToken = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? ''

    socket.on('message', (rawData) => {
      let msg: IncomingMsg
      try {
        msg = JSON.parse(rawData.toString()) as IncomingMsg
      } catch {
        sendJson(socket, { type: 'error', code: 'invalid_json', message: 'Ungueltige JSON-Nachricht.' })
        return
      }

      // BEITRITT
      if (msg.type === 'teacher_join') {
        handleTeacherJoin(msg)
        return
      }
      if (msg.type === 'student_join') {
        handleStudentJoin(msg)
        return
      }

      // Aktionen setzen roomId voraus
      if (roomId === null) {
        sendJson(socket, { type: 'error', code: 'not_joined', message: 'Zuerst beitreten.' })
        return
      }

      const room = rooms.get(roomId)
      if (!room) return

      if (isTeacher) {
        if (msg.type === 'next_question') {
          handleNextQuestion(db, roomId, room)
        } else if (msg.type === 'reveal') {
          handleReveal(db, roomId, room)
        } else if (msg.type === 'end_quiz') {
          handleEndQuiz(db, roomId, room)
        }
      } else {
        if (msg.type === 'answer') {
          handleStudentAnswer(msg, room)
        }
      }
    })

    socket.on('close', () => {
      if (roomId === null) return
      const room = rooms.get(roomId)
      if (!room) return

      if (isTeacher) {
        room.teacherWs = null
      } else {
        room.students.delete(socket)
        // Lobby-Update senden
        sendLobbyState(room)
      }
      cleanupRoom(roomId)
    })

    // ---- Innere Hilfsfunktionen ----

    function handleTeacherJoin(msg: TeacherJoin): void {
      const session = validateSession(db, cookieToken || msg.token || '')
      if (!session) {
        sendJson(socket, { type: 'error', code: 'unauthorized', message: 'Ungueltige Sitzung.' })
        socket.close(1008, 'Unauthorized.')
        return
      }
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.user_id) as { role: string } | undefined
      if (!user || user.role !== 'teacher') {
        sendJson(socket, { type: 'error', code: 'forbidden', message: 'Nur Lehrkraefte.' })
        socket.close(1008, 'Forbidden.')
        return
      }

      // Eigentuemerschaft pruefen
      const roomRow = db.prepare(
        `SELECT r.id, r.state, qs.teacher_id
         FROM quiz_rooms r
         JOIN quiz_question_sets qs ON r.set_id = qs.id
         WHERE r.id = ?`
      ).get(msg.room_id) as { id: number; state: string; teacher_id: number } | undefined

      if (!roomRow || roomRow.teacher_id !== session.user_id) {
        sendJson(socket, { type: 'error', code: 'not_found', message: 'Sitzung nicht gefunden.' })
        socket.close(1008, 'Not found.')
        return
      }

      if (roomRow.state === 'ended') {
        sendJson(socket, { type: 'error', code: 'already_ended', message: 'Sitzung beendet.' })
        socket.close(1000, 'Ended.')
        return
      }

      roomId = msg.room_id
      isTeacher = true
      const room = getOrCreateRoom(roomId)
      room.teacherWs = socket

      // Aktuellen Zustand senden
      sendLobbyState(room)
      sendJson(socket, { type: 'joined', role: 'teacher', room_id: roomId })
    }

    function handleStudentJoin(msg: StudentJoin): void {
      // Rate-Limit fuer Beitritt (verhindert PIN-Raten, K10)
      const limitKey = `join:${msg.display_name.slice(0, 32)}`
      if (!joinRateLimiter.check(limitKey)) {
        sendJson(socket, { type: 'error', code: 'rate_limited', message: 'Zu viele Beitrittsversuche.' })
        socket.close(1008, 'Rate limited.')
        return
      }

      // Validierung - display_name: 1-32 Zeichen
      const name = msg.display_name?.trim()
      if (!name || name.length < 1 || name.length > 32) {
        sendJson(socket, { type: 'error', code: 'invalid_name', message: 'Anzeigename: 1-32 Zeichen.' })
        return
      }

      // PIN pruefen (nur aktive Sitzungen)
      const roomRow = db.prepare(
        `SELECT id, state, pin FROM quiz_rooms WHERE pin = ? AND state != 'ended'`
      ).get(msg.pin?.toUpperCase()) as { id: number; state: string; pin: string } | undefined

      if (!roomRow) {
        sendJson(socket, { type: 'error', code: 'invalid_pin', message: 'Ungueltiger PIN.' })
        return
      }

      // Nur in Lobby beitreten (waehrend Frage: kein Beitritt)
      if (roomRow.state !== 'lobby') {
        sendJson(socket, { type: 'error', code: 'not_in_lobby', message: 'Quiz laeuft bereits.' })
        return
      }

      // Registrierten Nutzer ermitteln (optional)
      let userId: number | null = null
      let displayName = name

      const studentToken = cookieToken || msg.token || ''
      if (studentToken) {
        const session = validateSession(db, studentToken)
        if (session) {
          const userRow = db.prepare(
            'SELECT id, display_name FROM users WHERE id = ?'
          ).get(session.user_id) as { id: number; display_name: string } | undefined
          if (userRow) {
            userId = userRow.id
            displayName = userRow.display_name
          }
        }
      }

      // Teilnehmer anlegen (UNIQUE-Verletzung = Name vergeben)
      let participantId: number
      try {
        const result = db.prepare(
          `INSERT INTO quiz_participants (room_id, user_id, display_name)
           VALUES (?, ?, ?)`
        ).run(roomRow.id, userId, displayName)
        participantId = result.lastInsertRowid as number
      } catch {
        // Name bereits vergeben
        sendJson(socket, { type: 'error', code: 'name_taken', message: 'Name bereits vergeben.' })
        return
      }

      roomId = roomRow.id
      isTeacher = false
      const room = getOrCreateRoom(roomId)
      participantWsEntry = { ws: socket, participantId, displayName }
      room.students.set(socket, participantWsEntry)

      sendJson(socket, { type: 'joined', role: 'student', display_name: displayName, participant_id: participantId })
      sendLobbyState(room)
    }

    function handleStudentAnswer(msg: StudentAnswer, room: RoomState): void {
      if (!participantWsEntry) return

      // Raumstatus pruefen
      const roomRow = db.prepare(
        'SELECT state, current_question_id, current_question_started_at FROM quiz_rooms WHERE id = ?'
      ).get(roomId) as { state: string; current_question_id: number | null; current_question_started_at: number | null } | undefined

      if (!roomRow || roomRow.state !== 'question') {
        sendJson(socket, { type: 'answer_too_late' })
        return
      }

      // Frage muss die aktuelle sein
      if (msg.question_id !== roomRow.current_question_id) {
        sendJson(socket, { type: 'answer_too_late' })
        return
      }

      // Timer-Check: Server prueft Deadline
      if (room.questionDeadlineMs !== null && Date.now() > room.questionDeadlineMs) {
        sendJson(socket, { type: 'answer_too_late' })
        return
      }

      // Antwortzeit berechnen
      const startedAtMs = (roomRow.current_question_started_at ?? 0) * 1000
      const answerMs = Date.now() - startedAtMs

      // Duplikat-Check
      const existing = db.prepare(
        'SELECT id FROM quiz_answers WHERE room_id = ? AND participant_id = ? AND question_id = ?'
      ).get(roomId, participantWsEntry.participantId, msg.question_id)

      if (existing) {
        sendJson(socket, { type: 'answer_duplicate' })
        return
      }

      // Korrektheit und Punkte berechnen
      const question = db.prepare(
        'SELECT correct_idx, time_limit FROM quiz_questions WHERE id = ?'
      ).get(msg.question_id) as { correct_idx: number; time_limit: number } | undefined

      if (!question) {
        sendJson(socket, { type: 'answer_too_late' })
        return
      }

      const isCorrect = msg.chosen_idx === question.correct_idx
      const timeLimitMs = room.currentTimeLimitMs ?? (question.time_limit * 1000)
      const points = isCorrect ? calculatePoints(answerMs, timeLimitMs) : 0

      // Antwort speichern (KEIN Log-Eintrag - K5)
      db.prepare(
        `INSERT INTO quiz_answers (room_id, participant_id, question_id, chosen_idx, answer_ms, points)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(roomId, participantWsEntry.participantId, msg.question_id, msg.chosen_idx, answerMs, points)

      // Punkte aufsummieren
      const newTotal = (db.prepare(
        'SELECT COALESCE(SUM(points), 0) as total FROM quiz_answers WHERE participant_id = ? AND room_id = ?'
      ).get(participantWsEntry.participantId, roomId) as { total: number }).total

      db.prepare(
        'UPDATE quiz_participants SET total_points = ? WHERE id = ?'
      ).run(newTotal, participantWsEntry.participantId)

      // Bestaetigung nur an diesen Schueler (Richtige Antwort NICHT senden - K5)
      sendJson(socket, {
        type: 'answer_ack',
        correct: isCorrect,
        points,
        total_points: newTotal,
      })

      // Antwort-Fortschritt an Lehrkraft
      const answerCount = (db.prepare(
        'SELECT COUNT(*) as cnt FROM quiz_answers WHERE room_id = ? AND question_id = ?'
      ).get(roomId, msg.question_id) as { cnt: number }).cnt

      if (room.teacherWs) {
        sendJson(room.teacherWs, {
          type: 'answer_progress',
          count: answerCount,
          total: room.students.size,
        })
      }
    }

    function sendLobbyState(room: RoomState): void {
      const participants = db.prepare(
        'SELECT display_name FROM quiz_participants WHERE room_id = ? ORDER BY joined_at'
      ).all(roomId) as { display_name: string }[]

      const lobbyMsg = {
        type: 'lobby_state',
        participants: participants.map(p => p.display_name),
        count: participants.length,
      }
      broadcastToRoom(room, lobbyMsg)
    }
  })
}

export default quizWsPlugin
