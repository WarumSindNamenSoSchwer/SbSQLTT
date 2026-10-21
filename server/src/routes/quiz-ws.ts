/**
 * Quiz-WebSocket-Handler unter /api/quiz/ws
 *
 * PROTOKOLL
 *
 * VERBINDUNGSAUFBAU
 * Jeder Client sendet nach dem Upgrade sofort eine Join-Nachricht.
 * Die Sitzung wird ausschliesslich ueber den HttpOnly-Cookie tabula_session
 * beim WS-Upgrade geprueft. Gaeste werden abgelehnt.
 *
 *   Lehrkraft: { type: "teacher_join", room_id: number }
 *              Auth: Cookie tabula_session beim Upgrade-Request
 *   Schueler:  { type: "student_join", pin: string }
 *              Auth: Cookie tabula_session (Pflicht, kein Gast-Beitritt)
 *              display_name kommt aus dem Konto, Feld im Join entfaellt.
 *
 * NACHRICHTEN LEHRKRAFT -> SERVER
 *   { type: "next_question" }         Naechste Frage zeigen
 *   { type: "reveal" }                Aktuelle Frage aufloesen
 *   { type: "end_quiz" }              Sitzung beenden
 *
 * NACHRICHTEN SERVER -> CLIENT (alle)
 *   { type: "lobby_state", participants: string[], count: number,
 *           expected?: number }       expected = Anzahl Klassenmitglieder (nur bei Klassensitzung)
 *   { type: "question_start", question_index: number, question_total: number, question_id: number,
 *           question: string, code?: string, options: string[], time_limit: number,
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
 * FEHLER-CODES (code-Feld im error-Typ)
 *   login_required   Schueler ohne gueltige Sitzung
 *   not_in_class     Schueler ist nicht Mitglied der angegebenen Klasse
 *   invalid_pin      PIN nicht gefunden oder Sitzung beendet
 *   not_in_lobby     Quiz laeuft bereits
 *   name_taken       Anzeigename bereits vergeben
 *   unauthorized     Lehrkraft ohne gueltige Sitzung
 *   forbidden        Nutzer ist keine Lehrkraft
 *   not_found        Sitzung gehoert nicht dieser Lehrkraft
 *   already_ended    Sitzung bereits beendet
 *   rate_limited     Zu viele Beitrittsversuche
 *   not_joined       Nachricht vor Join-Nachricht gesendet
 *   invalid_json     Ungueltige JSON-Nachricht
 *
 * PUNKTE
 * Max. 1000 Punkte pro Frage. Schnellere Antworten geben mehr Punkte:
 *   points = round(1000 * sqrt(1 - answerMs / timeLimitMs))
 * Mindestpunkte bei richtiger Antwort: 100
 *
 * SICHERHEIT
 * - Origin-Check gegen ALLOWED_ORIGIN (wie CSRF)
 * - Rate-Limit fuer student_join (max. 10 Versuche je Rate-Key in 1 Min.)
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
  /** Nur Fallback fuer Tests/Nicht-Browser-Clients; Browser sendet Cookie automatisch */
  token?: string
}

interface StudentJoin {
  type: 'student_join'
  pin: string
  /** Nur Fallback fuer Tests; Browser sendet Cookie automatisch */
  token?: string
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
  /** Endzeitpunkt der laufenden Frage in ms */
  questionDeadlineMs: number | null
  currentQuestionId: number | null
  currentTimeLimitMs: number | null
}

/** Globale Map: room_id -> RoomState */
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
// Punkte-Berechnung (serverseitig, K5)
// ---------------------------------------------------------------------------

function calculatePoints(answerMs: number, timeLimitMs: number): number {
  if (answerMs > timeLimitMs) return 0
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
  code: string | null
  options: string
  correct_idx: number
  time_limit: number
}

interface RoomRow {
  id: number
  set_id: number
  class_id: number | null
  state: string
  current_q: number
  pin: string | null
  current_question_id: number | null
  current_question_started_at: number | null
  ended_at: number | null
}

function handleNextQuestion(db: Db, roomId: number, room: RoomState): void {
  const roomRow = db.prepare(
    `SELECT id, set_id, class_id, state, current_q, current_question_id FROM quiz_rooms WHERE id = ?`
  ).get(roomId) as RoomRow | undefined
  if (!roomRow) return

  if (roomRow.state === 'ended') {
    if (room.teacherWs) sendJson(room.teacherWs, { type: 'error', code: 'already_ended', message: 'Sitzung bereits beendet.' })
    return
  }

  const questions = db.prepare(
    'SELECT id, position, question, code, options, correct_idx, time_limit FROM quiz_questions WHERE set_id = ? ORDER BY position'
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

  const msg: Record<string, unknown> = {
    type: 'question_start',
    question_index: newIndex,
    question_total: questions.length,
    question_id: nextQuestion.id,
    question: nextQuestion.question,
    options: JSON.parse(nextQuestion.options) as string[],
    time_limit: nextQuestion.time_limit,
    started_at: nowS,
  }
  if (nextQuestion.code) msg['code'] = nextQuestion.code

  broadcastToRoom(room, msg)
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
  room.questionDeadlineMs = null

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

  broadcastToRoom(room, {
    type: 'reveal',
    correct_idx: question.correct_idx,
    answer_counts: counts,
    correct_ratio: totalAnswers > 0 ? correctCount / totalAnswers : 0,
  })

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

/** Rate-Limiter fuer Student-Join (in-memory, keine IPs - K10) */
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
        socket.close(1008, 'Ungültige Herkunft.')
        return
      }
    }

    let roomId: number | null = null
    let isTeacher = false
    let participantWsEntry: ParticipantConn | null = null

    /**
     * cookieToken: HttpOnly-Cookie aus dem WS-Upgrade-Request.
     * Browser sendet es automatisch mit. Fuer Tests kann msg.token als Fallback genutzt werden.
     */
    const cookieToken = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? ''

    socket.on('message', (rawData) => {
      let msg: IncomingMsg
      try {
        msg = JSON.parse(rawData.toString()) as IncomingMsg
      } catch {
        sendJson(socket, { type: 'error', code: 'invalid_json', message: 'Ungültige JSON-Nachricht.' })
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
        // DB koennte bereits geschlossen sein (Tests: teardown vor close-Event)
        try { sendLobbyState(db, roomId, room) } catch { /* ignorieren */ }
      }
      cleanupRoom(roomId)
    })

    // ---- Innere Hilfsfunktionen ----

    function handleTeacherJoin(msg: TeacherJoin): void {
      const token = cookieToken || msg.token || ''
      const session = validateSession(db, token)
      if (!session) {
        sendJson(socket, { type: 'error', code: 'unauthorized', message: 'Ungültige Sitzung.' })
        socket.close(1008, 'Unauthorized.')
        return
      }
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.user_id) as { role: string } | undefined
      if (!user || user.role !== 'teacher') {
        sendJson(socket, { type: 'error', code: 'forbidden', message: 'Nur Lehrkräfte.' })
        socket.close(1008, 'Forbidden.')
        return
      }

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

      sendLobbyState(db, roomId, room)
      sendJson(socket, { type: 'joined', role: 'teacher', room_id: roomId })
    }

    function handleStudentJoin(msg: StudentJoin): void {
      // Schritt 1: Sitzung pruefen - NUR mit Konto (K4, Datenschutz quiz)
      const studentToken = cookieToken || msg.token || ''
      const session = validateSession(db, studentToken)
      if (!session) {
        sendJson(socket, { type: 'error', code: 'login_required', message: 'Quiz erfordert ein Konto. Bitte melde dich an.' })
        socket.close(1008, 'Login required.')
        return
      }

      // display_name aus dem Konto holen
      const userRow = db.prepare(
        'SELECT id, display_name FROM users WHERE id = ?'
      ).get(session.user_id) as { id: number; display_name: string } | undefined
      if (!userRow) {
        sendJson(socket, { type: 'error', code: 'login_required', message: 'Konto nicht gefunden.' })
        socket.close(1008, 'Login required.')
        return
      }

      // Rate-Limit (verhindert PIN-Raten, K10)
      const limitKey = `join:${session.user_id}`
      if (!joinRateLimiter.check(limitKey)) {
        sendJson(socket, { type: 'error', code: 'rate_limited', message: 'Zu viele Beitrittsversuche. Bitte warte einen Moment.' })
        socket.close(1008, 'Rate limited.')
        return
      }

      // Schritt 2: PIN pruefen
      const roomRow = db.prepare(
        `SELECT id, class_id, state, pin FROM quiz_rooms WHERE pin = ? AND state != 'ended'`
      ).get(msg.pin?.toUpperCase()) as { id: number; class_id: number | null; state: string; pin: string } | undefined

      if (!roomRow) {
        sendJson(socket, { type: 'error', code: 'invalid_pin', message: 'Ungültiger PIN.' })
        return
      }

      if (roomRow.state !== 'lobby') {
        sendJson(socket, { type: 'error', code: 'not_in_lobby', message: 'Quiz läuft bereits.' })
        return
      }

      // Schritt 3: Klassen-Check (falls Sitzung eine Klasse hat)
      if (roomRow.class_id !== null) {
        const membership = db.prepare(
          'SELECT id FROM memberships WHERE class_id = ? AND user_id = ?'
        ).get(roomRow.class_id, session.user_id) as { id: number } | undefined

        if (!membership) {
          sendJson(socket, { type: 'error', code: 'not_in_class', message: 'Du bist kein Mitglied dieser Klasse.' })
          return
        }
      }

      const displayName = userRow.display_name

      // Schritt 4: Teilnehmer anlegen (UNIQUE-Verletzung = doppelter Beitritt)
      let participantId: number
      try {
        const result = db.prepare(
          `INSERT INTO quiz_participants (room_id, user_id, display_name)
           VALUES (?, ?, ?)`
        ).run(roomRow.id, session.user_id, displayName)
        participantId = result.lastInsertRowid as number
      } catch {
        // Doppelter Beitritt (user_id UNIQUE je Raum) -> als Wiederverbindung behandeln
        const existing = db.prepare(
          'SELECT id FROM quiz_participants WHERE room_id = ? AND user_id = ?'
        ).get(roomRow.id, session.user_id) as { id: number } | undefined
        if (existing) {
          participantId = existing.id
        } else {
          sendJson(socket, { type: 'error', code: 'name_taken', message: 'Name bereits vergeben.' })
          return
        }
      }

      roomId = roomRow.id
      isTeacher = false
      const room = getOrCreateRoom(roomId)
      participantWsEntry = { ws: socket, participantId, displayName }
      room.students.set(socket, participantWsEntry)

      sendJson(socket, { type: 'joined', role: 'student', display_name: displayName, participant_id: participantId })
      sendLobbyState(db, roomId, room)
    }

    function handleStudentAnswer(msg: StudentAnswer, room: RoomState): void {
      if (!participantWsEntry) return

      const roomRow = db.prepare(
        'SELECT state, current_question_id, current_question_started_at FROM quiz_rooms WHERE id = ?'
      ).get(roomId) as { state: string; current_question_id: number | null; current_question_started_at: number | null } | undefined

      if (!roomRow || roomRow.state !== 'question') {
        sendJson(socket, { type: 'answer_too_late' })
        return
      }

      if (msg.question_id !== roomRow.current_question_id) {
        sendJson(socket, { type: 'answer_too_late' })
        return
      }

      if (room.questionDeadlineMs !== null && Date.now() > room.questionDeadlineMs) {
        sendJson(socket, { type: 'answer_too_late' })
        return
      }

      const startedAtMs = (roomRow.current_question_started_at ?? 0) * 1000
      const answerMs = Date.now() - startedAtMs

      const existing = db.prepare(
        'SELECT id FROM quiz_answers WHERE room_id = ? AND participant_id = ? AND question_id = ?'
      ).get(roomId, participantWsEntry.participantId, msg.question_id)

      if (existing) {
        sendJson(socket, { type: 'answer_duplicate' })
        return
      }

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

      // Bestaetigung nur an diesen Schueler (richtige Antwort NICHT senden - K5)
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
  })
}

/**
 * Sendet den aktuellen Lobby-Zustand an alle Teilnehmenden.
 * Bei Klassensitzungen wird expected (Anzahl Klassenmitglieder) ergaenzt.
 */
function sendLobbyState(db: Db, roomId: number, room: RoomState): void {
  const participants = db.prepare(
    'SELECT display_name FROM quiz_participants WHERE room_id = ? ORDER BY joined_at'
  ).all(roomId) as { display_name: string }[]

  const roomRow = db.prepare('SELECT class_id FROM quiz_rooms WHERE id = ?').get(roomId) as { class_id: number | null } | undefined

  const lobbyMsg: Record<string, unknown> = {
    type: 'lobby_state',
    participants: participants.map(p => p.display_name),
    count: participants.length,
  }

  if (roomRow?.class_id !== null && roomRow?.class_id !== undefined) {
    const memberCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM memberships WHERE class_id = ?'
    ).get(roomRow.class_id) as { cnt: number }).cnt
    lobbyMsg['expected'] = memberCount
  }

  broadcastToRoom(room, lobbyMsg)
}

export default quizWsPlugin
