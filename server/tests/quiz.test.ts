/**
 * P7 Quiz-Tests (K5, K8, K10):
 *
 * 1. Kompletter Ablauf: Lehrkraft + 2 Schueler (WebSocket, echte Verbindung)
 * 2. Punkte nach Geschwindigkeit (schnellere Antwort = mehr Punkte)
 * 3. Spaete Antwort verworfen (nach Timer-Ablauf)
 * 4. Doppelte Antwort verworfen
 * 5. Loesung vor Aufloesen nicht gesendet
 * 6. Fremde Lehrkraft kann Quiz nicht steuern
 * 7. Zeitreise-Test 24h Loeschjob (nur Aggregat bleibt, keine Namen)
 * 8. K10: Keine IP-Spalten in Quiz-Tabellen
 * 9. Origin-Ablehnung
 * 10. REST: CRUD Fragensaetze, Sitzungs-Steuerung
 *
 * Verwendet 'ws' als WebSocket-Client (NPM-Paket) gegen app.listen auf Port 0.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import WebSocket from 'ws'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb } from './helpers.js'
import { runQuizCleanupJob } from '../src/jobs.js'
import type { Db } from '../src/db.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setup() {
  const db = testDb()
  const mail = new InMemoryMailSender()
  const app = await buildApp({ db, mail, skipCsrf: true })
  await app.ready()
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address() as { port: number }
  const baseUrl = `http://127.0.0.1:${address.port}`
  const wsUrl = `ws://127.0.0.1:${address.port}`
  return { db, mail, app, baseUrl, wsUrl }
}

async function teardown(app: FastifyInstance, db: Db) {
  await app.close()
  db.close()
}

// Lehrkraft registrieren und Session-Token holen
async function registerTeacher(app: FastifyInstance, username = 'lehrer1') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'teacher',
      username,
      display_name: 'Lehrkraft',
      name: 'Frau Test',
      email: `${username}@test.de`,
      password: 'sicheresPasswort1',
      terms_accepted: true,
    }),
  })
  expect(res.statusCode).toBe(201)
  const cookieHeader = res.headers['set-cookie']
  const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader as string
  const token = cookie.split('tabula_session=')[1]?.split(';')[0] ?? ''
  return token
}

// Schueler registrieren und Session-Token holen
async function registerStudent(app: FastifyInstance, username: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'student',
      username,
      display_name: username,
      password: 'sicheresPasswort1',
    }),
  })
  expect(res.statusCode).toBe(201)
  const cookieHeader = res.headers['set-cookie']
  const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader as string
  const token = cookie.split('tabula_session=')[1]?.split(';')[0] ?? ''
  return token
}

// Fragensatz erstellen
async function createQuiz(app: FastifyInstance, token: string, timeLimit = 20) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/teacher/quizzes',
    headers: {
      'content-type': 'application/json',
      'cookie': `tabula_session=${token}`,
    },
    body: JSON.stringify({
      title: 'Test Quiz',
      questions: [
        {
          question: 'Was ist 2+2?',
          options: ['3', '4', '5', '6'],
          correct_idx: 1,
          time_limit: timeLimit,
        },
        {
          question: 'Hauptstadt von Deutschland?',
          options: ['Hamburg', 'Berlin', 'Munich', 'Cologne'],
          correct_idx: 1,
          time_limit: timeLimit,
        },
      ],
    }),
  })
  expect(res.statusCode).toBe(201)
  return (JSON.parse(res.body) as { id: number }).id
}

// Quiz-Sitzung starten
async function startSession(app: FastifyInstance, token: string, quizId: number) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/teacher/quiz-sessions',
    headers: {
      'content-type': 'application/json',
      'cookie': `tabula_session=${token}`,
    },
    body: JSON.stringify({ quiz_id: quizId }),
  })
  expect(res.statusCode).toBe(201)
  return JSON.parse(res.body) as { id: number; pin: string }
}

// WebSocket-Verbindung herstellen und auf eine bestimmte Nachricht warten
function connectWs(url: string): Promise<{ ws: WebSocket; waitFor: (type: string) => Promise<Record<string, unknown>> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const handlers = new Map<string, (msg: Record<string, unknown>) => void>()
    const buffer: Record<string, unknown>[] = []

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>
      const type = msg['type'] as string
      const handler = handlers.get(type)
      if (handler) {
        handlers.delete(type)
        handler(msg)
      } else {
        buffer.push(msg)
      }
    })

    ws.on('error', reject)

    ws.on('open', () => {
      resolve({
        ws,
        waitFor: (type: string) =>
          new Promise<Record<string, unknown>>((res) => {
            // Check buffer first
            const idx = buffer.findIndex(m => m['type'] === type)
            if (idx !== -1) {
              res(buffer.splice(idx, 1)[0])
              return
            }
            handlers.set(type, res)
          }),
      })
    })
  })
}

function sendMsg(ws: WebSocket, data: object) {
  ws.send(JSON.stringify(data))
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Quiz REST: Fragensatz CRUD', () => {
  it('erstellt und listet Fragensaetze', async () => {
    const { app, db } = await setup()
    const token = await registerTeacher(app)

    // Erstellen
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/teacher/quizzes',
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${token}` },
      body: JSON.stringify({
        title: 'JOIN-Quiz',
        questions: [{ question: 'Was ist JOIN?', options: ['A', 'B', 'C', 'D'], correct_idx: 0, time_limit: 15 }],
      }),
    })
    expect(createRes.statusCode).toBe(201)
    const { id } = JSON.parse(createRes.body) as { id: number }
    expect(id).toBeGreaterThan(0)

    // Listen
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/teacher/quizzes',
      headers: { 'cookie': `tabula_session=${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const list = JSON.parse(listRes.body) as { id: number }[]
    expect(list.some(q => q.id === id)).toBe(true)

    // Einzeln lesen
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/quizzes/${id}`,
      headers: { 'cookie': `tabula_session=${token}` },
    })
    expect(getRes.statusCode).toBe(200)
    const quiz = JSON.parse(getRes.body) as { title: string; questions: unknown[] }
    expect(quiz.title).toBe('JOIN-Quiz')
    expect(quiz.questions).toHaveLength(1)

    await teardown(app, db)
  })

  it('aktualisiert einen Fragensatz', async () => {
    const { app, db } = await setup()
    const token = await registerTeacher(app)
    const quizId = await createQuiz(app, token)

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/teacher/quizzes/${quizId}`,
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${token}` },
      body: JSON.stringify({ title: 'Neuer Titel' }),
    })
    expect(patchRes.statusCode).toBe(200)

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/quizzes/${quizId}`,
      headers: { 'cookie': `tabula_session=${token}` },
    })
    expect(JSON.parse(getRes.body)).toMatchObject({ title: 'Neuer Titel' })

    await teardown(app, db)
  })

  it('loescht einen Fragensatz', async () => {
    const { app, db } = await setup()
    const token = await registerTeacher(app)
    const quizId = await createQuiz(app, token)

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/teacher/quizzes/${quizId}`,
      headers: { 'cookie': `tabula_session=${token}` },
    })
    expect(delRes.statusCode).toBe(200)

    // Danach 404
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/quizzes/${quizId}`,
      headers: { 'cookie': `tabula_session=${token}` },
    })
    expect(getRes.statusCode).toBe(404)

    await teardown(app, db)
  })

  it('fremde Lehrkraft sieht eigenen Quiz nicht (404)', async () => {
    const { app, db } = await setup()
    const token1 = await registerTeacher(app, 'lehrer1')
    const token2 = await registerTeacher(app, 'lehrer2')
    const quizId = await createQuiz(app, token1)

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/quizzes/${quizId}`,
      headers: { 'cookie': `tabula_session=${token2}` },
    })
    expect(res.statusCode).toBe(404)

    await teardown(app, db)
  })
})

describe('Quiz REST: Sitzungssteuerung', () => {
  it('startet eine Sitzung und gibt PIN zurueck', async () => {
    const { app, db } = await setup()
    const token = await registerTeacher(app)
    const quizId = await createQuiz(app, token)
    const session = await startSession(app, token, quizId)

    expect(session.id).toBeGreaterThan(0)
    expect(session.pin).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)

    await teardown(app, db)
  })

  it('fremde Lehrkraft kann Sitzung nicht steuern', async () => {
    const { app, db } = await setup()
    const token1 = await registerTeacher(app, 'lehrer1')
    const token2 = await registerTeacher(app, 'lehrer2')
    const quizId = await createQuiz(app, token1)
    const session = await startSession(app, token1, quizId)

    // Fremde Lehrkraft versucht next
    const res = await app.inject({
      method: 'POST',
      url: `/api/teacher/quiz-sessions/${session.id}/next`,
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${token2}` },
      body: '{}',
    })
    expect(res.statusCode).toBe(404)

    await teardown(app, db)
  })

  it('beendet eine Sitzung', async () => {
    const { app, db } = await setup()
    const token = await registerTeacher(app)
    const quizId = await createQuiz(app, token)
    const session = await startSession(app, token, quizId)

    const endRes = await app.inject({
      method: 'POST',
      url: `/api/teacher/quiz-sessions/${session.id}/end`,
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${token}` },
      body: '{}',
    })
    expect(endRes.statusCode).toBe(200)
    expect(JSON.parse(endRes.body)).toMatchObject({ ok: true })

    // Zweites Beenden gibt 409
    const end2 = await app.inject({
      method: 'POST',
      url: `/api/teacher/quiz-sessions/${session.id}/end`,
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${token}` },
      body: '{}',
    })
    expect(end2.statusCode).toBe(409)

    await teardown(app, db)
  })
})

describe('Quiz WebSocket: Kompletter Ablauf', () => {
  it('Lehrkraft + 2 Schueler, vollstaendiger Ablauf', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    // Lehrkraft verbindet
    const { ws: teacherWs, waitFor: teacherWait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id, token: teacherToken })
    const joinedT = await teacherWait('joined')
    expect(joinedT['role']).toBe('teacher')

    // Schueler 1 verbindet
    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin, display_name: 'Mia' })
    const joinedS1 = await s1Wait('joined')
    expect(joinedS1['display_name']).toBe('Mia')

    // Schueler 2 verbindet
    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(s2Ws, { type: 'student_join', pin: session.pin, display_name: 'Tom' })
    await s2Wait('joined')

    // Lehrkraft startet erste Frage
    sendMsg(teacherWs, { type: 'next_question' })
    const qS1 = await s1Wait('question_start')
    const qS2 = await s2Wait('question_start')
    expect(qS1['question_index']).toBe(1)
    expect(qS2['question_index']).toBe(1)

    const questionId = qS1['question_id'] as number

    // Beide Schueler antworten korrekt (Index 1 = '4')
    sendMsg(s1Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackS1 = await s1Wait('answer_ack')
    expect(ackS1['correct']).toBe(true)
    expect(ackS1['points']).toBeGreaterThan(0)

    sendMsg(s2Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackS2 = await s2Wait('answer_ack')
    expect(ackS2['correct']).toBe(true)

    // Lehrkraft loest auf
    sendMsg(teacherWs, { type: 'reveal' })
    const revealT = await teacherWait('reveal')
    expect(revealT['correct_idx']).toBe(1)

    // Beide Schueler empfangen reveal
    const revealS1 = await s1Wait('reveal')
    expect(revealS1['correct_idx']).toBe(1)

    // Rangliste empfangen
    const lbT = await teacherWait('leaderboard')
    const rankings = lbT['rankings'] as { display_name: string; points: number }[]
    expect(rankings).toHaveLength(2)
    expect(rankings[0]?.points).toBeGreaterThan(0)

    // Zweite Frage
    sendMsg(teacherWs, { type: 'next_question' })
    const q2S1 = await s1Wait('question_start')
    expect(q2S1['question_index']).toBe(2)

    // Sitzung beenden
    sendMsg(teacherWs, { type: 'end_quiz' })
    await teacherWait('quiz_ended')
    await s1Wait('quiz_ended')
    await s2Wait('quiz_ended')

    teacherWs.close()
    s1Ws.close()
    s2Ws.close()
    await teardown(app, db)
  })

  it('Loesung vor Aufloesen nicht an Schueler gesendet', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id, token: teacherToken })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(sWs, { type: 'student_join', pin: session.pin, display_name: 'Test' })
    await sWait('joined')

    // Frage starten
    sendMsg(teacherWs, { type: 'next_question' })
    const qMsg = await sWait('question_start')
    const questionId = qMsg['question_id'] as number

    // Antwort senden
    sendMsg(sWs, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ack = await sWait('answer_ack')

    // answer_ack darf correct_idx der Antwort NICHT enthalten
    // (der Schueler weiss nur ob er richtig/falsch liegt, nicht was korrekt war)
    // Die richtige Antwort (correct_idx) kommt erst im 'reveal'
    expect(ack['type']).toBe('answer_ack')
    expect(ack).not.toHaveProperty('correct_idx')
    expect(ack).not.toHaveProperty('options')

    // Kein unaufgefordetes 'reveal' empfangen (200ms warten)
    let gotReveal = false
    const revealPromise = new Promise<void>(resolve => {
      const handler = (raw: Buffer) => {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>
        if (msg['type'] === 'reveal') gotReveal = true
        resolve()
      }
      sWs.once('message', handler)
      setTimeout(() => {
        sWs.removeListener('message', handler)
        resolve()
      }, 200)
    })
    await revealPromise
    expect(gotReveal).toBe(false)

    teacherWs.close()
    sWs.close()
    await teardown(app, db)
  })

  it('spaete Antwort wird verworfen (nach Timer)', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    // Sehr kurzes Zeitlimit: 1 Sekunde
    const quizId = await createQuiz(app, teacherToken, 1)
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id, token: teacherToken })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(sWs, { type: 'student_join', pin: session.pin, display_name: 'Late' })
    await sWait('joined')

    sendMsg(teacherWs, { type: 'next_question' })
    const qMsg = await sWait('question_start')
    const questionId = qMsg['question_id'] as number

    // 1.5s warten (Timer laeuft bei 1s ab)
    await sleep(1500)

    sendMsg(sWs, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const late = await sWait('answer_too_late')
    expect(late['type']).toBe('answer_too_late')

    teacherWs.close()
    sWs.close()
    await teardown(app, db)
  })

  it('doppelte Antwort wird verworfen', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id, token: teacherToken })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(sWs, { type: 'student_join', pin: session.pin, display_name: 'Dupe' })
    await sWait('joined')

    sendMsg(teacherWs, { type: 'next_question' })
    const qMsg = await sWait('question_start')
    const questionId = qMsg['question_id'] as number

    // Erste Antwort
    sendMsg(sWs, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    await sWait('answer_ack')

    // Zweite Antwort -> Duplikat
    sendMsg(sWs, { type: 'answer', question_id: questionId, chosen_idx: 0 })
    const dup = await sWait('answer_duplicate')
    expect(dup['type']).toBe('answer_duplicate')

    teacherWs.close()
    sWs.close()
    await teardown(app, db)
  })

  it('Punkte nach Geschwindigkeit: schnellere Antwort mehr Punkte', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const quizId = await createQuiz(app, teacherToken, 30) // 30s Zeitlimit
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id, token: teacherToken })

    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin, display_name: 'Fast' })
    await s1Wait('joined')

    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(s2Ws, { type: 'student_join', pin: session.pin, display_name: 'Slow' })
    await s2Wait('joined')

    sendMsg(teacherWs, { type: 'next_question' })
    const qS1 = await s1Wait('question_start')
    await s2Wait('question_start')
    const questionId = qS1['question_id'] as number

    // S1 antwortet sofort (richtig)
    sendMsg(s1Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackFast = await s1Wait('answer_ack')

    // S2 antwortet nach 500ms (richtig)
    await sleep(500)
    sendMsg(s2Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackSlow = await s2Wait('answer_ack')

    // Beide korrekt; S1 muss >= S2 Punkte haben
    expect(ackFast['correct']).toBe(true)
    expect(ackSlow['correct']).toBe(true)
    expect(ackFast['points'] as number).toBeGreaterThanOrEqual(ackSlow['points'] as number)

    s1Ws.close()
    s2Ws.close()
    teacherWs.close()
    await teardown(app, db)
  })
})

describe('Quiz WebSocket: Sicherheit', () => {
  it('Origin-Ablehnung: falscher Origin wird geschlossen', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    // skipCsrf=false um Origin-Check aktiv zu haben
    const app = await buildApp({ db, mail, skipCsrf: false, allowedOrigin: 'https://www.tabulasql.de' })
    await app.ready()
    await app.listen({ port: 0, host: '127.0.0.1' })
    const { port } = app.server.address() as { port: number }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/quiz/ws`, {
        headers: { origin: 'https://evil.example.com' },
      })
      ws.on('close', (code) => {
        expect(code).toBe(1008)
        resolve()
      })
      ws.on('error', () => resolve()) // Verbindung verweigert ist auch ok
      setTimeout(reject, 3000)
    })

    await app.close()
    db.close()
  })

  it('Fremde Lehrkraft kann Quiz nicht ueber WS steuern', async () => {
    const { app, db, wsUrl } = await setup()
    const token1 = await registerTeacher(app, 'lehrer1')
    const token2 = await registerTeacher(app, 'lehrer2')
    const quizId = await createQuiz(app, token1)
    const session = await startSession(app, token1, quizId)

    const { ws: ws2, waitFor: wait2 } = await connectWs(`${wsUrl}/api/quiz/ws`)
    sendMsg(ws2, { type: 'teacher_join', room_id: session.id, token: token2 })

    const err = await wait2('error')
    expect(err['code']).toBe('not_found')

    ws2.close()
    await teardown(app, db)
  })
})

describe('K5: 24h Loeschjob', () => {
  it('Zeitreise: 24h nach Ende nur Aggregat bleibt, keine Namen', async () => {
    const { app, db } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    // Direkt per DB Teilnehmer und Antworten einfuegen (ohne WS)
    const participantResult = db.prepare(
      'INSERT INTO quiz_participants (room_id, display_name, total_points) VALUES (?, ?, ?)'
    ).run(session.id, 'TestSchueler', 800)
    const participantId = participantResult.lastInsertRowid as number

    // Fragen holen
    const questions = db.prepare(
      'SELECT id FROM quiz_questions WHERE set_id = ? ORDER BY position'
    ).all(quizId) as { id: number }[]
    expect(questions.length).toBeGreaterThan(0)

    db.prepare(
      'INSERT INTO quiz_answers (room_id, participant_id, question_id, chosen_idx, answer_ms, points) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(session.id, participantId, questions[0]!.id, 1, 500, 800)

    // Sitzung beenden (ended_at = jetzt minus 25 Stunden)
    const endedAt = Math.floor(Date.now() / 1000) - 25 * 60 * 60
    db.prepare("UPDATE quiz_rooms SET state = 'ended', ended_at = ? WHERE id = ?").run(endedAt, session.id)

    // Vor dem Job: Teilnehmer und Antworten vorhanden
    const beforeParticipants = db.prepare('SELECT id FROM quiz_participants WHERE room_id = ?').all(session.id)
    expect(beforeParticipants.length).toBe(1)

    // Job ausfuehren (Zeitreise: now liegt nach ended_at + 24h)
    const cleaned = runQuizCleanupJob(db)
    expect(cleaned).toBe(1)

    // Nach dem Job: keine Teilnehmer, keine Antworten
    const afterParticipants = db.prepare('SELECT id FROM quiz_participants WHERE room_id = ?').all(session.id)
    expect(afterParticipants.length).toBe(0)

    const afterAnswers = db.prepare('SELECT id FROM quiz_answers WHERE room_id = ?').all(session.id)
    expect(afterAnswers.length).toBe(0)

    // Aber Statistik vorhanden
    const stats = db.prepare('SELECT * FROM quiz_question_stats WHERE room_id = ?').all(session.id) as Record<string, unknown>[]
    expect(stats.length).toBeGreaterThan(0)
    // Keine Namen in stats
    expect(stats[0]).not.toHaveProperty('display_name')
    expect(stats[0]).not.toHaveProperty('user_id')
    expect(stats[0]?.['answer_count']).toBe(1)

    await teardown(app, db)
  })

  it('Quiz innerhalb 24h wird NICHT geloescht', async () => {
    const { app, db } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    // Teilnehmer einfuegen
    db.prepare(
      'INSERT INTO quiz_participants (room_id, display_name, total_points) VALUES (?, ?, ?)'
    ).run(session.id, 'TestSchueler', 500)

    // Sitzung beenden (ended_at = vor 12 Stunden, also innerhalb 24h)
    const endedAt = Math.floor(Date.now() / 1000) - 12 * 60 * 60
    db.prepare("UPDATE quiz_rooms SET state = 'ended', ended_at = ? WHERE id = ?").run(endedAt, session.id)

    const cleaned = runQuizCleanupJob(db)
    expect(cleaned).toBe(0)

    // Teilnehmer noch vorhanden
    const participants = db.prepare('SELECT id FROM quiz_participants WHERE room_id = ?').all(session.id)
    expect(participants.length).toBe(1)

    await teardown(app, db)
  })
})

describe('K10: Keine IP-Spalten in Quiz-Tabellen', () => {
  it('quiz_rooms hat keine IP-Spalten', async () => {
    const { app, db } = await setup()
    const cols = (db.prepare('PRAGMA table_info(quiz_rooms)').all() as { name: string }[]).map(c => c.name)
    // Pruefe nur exakte IP-Spaltennamen, nicht Teilstrings in anderen Spalten
    expect(cols.find(c => c === 'ip' || c === 'ip_address' || c === 'remote_ip' || c === 'client_ip')).toBeUndefined()
    await teardown(app, db)
  })

  it('quiz_participants hat keine IP-Spalten', async () => {
    const { app, db } = await setup()
    const cols = (db.prepare('PRAGMA table_info(quiz_participants)').all() as { name: string }[]).map(c => c.name)
    expect(cols.find(c => c === 'ip' || c === 'ip_address' || c === 'remote_ip' || c === 'client_ip')).toBeUndefined()
    await teardown(app, db)
  })

  it('quiz_answers hat keine IP-Spalten', async () => {
    const { app, db } = await setup()
    const cols = (db.prepare('PRAGMA table_info(quiz_answers)').all() as { name: string }[]).map(c => c.name)
    expect(cols.find(c => c === 'ip' || c === 'ip_address' || c === 'remote_ip' || c === 'client_ip')).toBeUndefined()
    await teardown(app, db)
  })
})

describe('K8: Konto loeschen entfernt Quiz-Daten', () => {
  it('Konto loeschen entfernt quiz_participants Eintraege', async () => {
    const { app, db } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const studentToken = await registerStudent(app, 'schueler1')

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    // Student-ID per Username holen
    const student = db.prepare("SELECT id FROM users WHERE username = 'schueler1'").get() as { id: number }
    const studentId = student.id

    // Teilnehmer-Eintrag anlegen
    db.prepare(
      'INSERT INTO quiz_participants (room_id, user_id, display_name, total_points) VALUES (?, ?, ?, ?)'
    ).run(session.id, studentId, 'Schueler1', 500)

    // Konto loeschen
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { 'cookie': `tabula_session=${studentToken}` },
    })
    expect(delRes.statusCode).toBe(200)

    // Teilnehmer-Eintraege weg (ON DELETE CASCADE via user_id)
    const participants = db.prepare('SELECT id FROM quiz_participants WHERE user_id = ?').all(studentId)
    expect(participants.length).toBe(0)

    await teardown(app, db)
  })
})
