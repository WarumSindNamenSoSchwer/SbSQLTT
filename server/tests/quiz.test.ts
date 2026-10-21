/**
 * P7 Quiz-Tests (K5, K8, K10):
 *
 * 1. Kompletter Ablauf: Lehrkraft + 2 Schüler (registriert, Cookie im WS-Header)
 * 2. Punkte nach Geschwindigkeit (schnellere Antwort = mehr Punkte)
 * 3. Späte Antwort verworfen (nach Timer-Ablauf)
 * 4. Doppelte Antwort verworfen
 * 5. Lösung vor Auflösen nicht gesendet
 * 6. Fremde Lehrkraft kann Quiz nicht steuern
 * 7. Zeitreise-Test 24h Löschjob (nur Aggregat bleibt, keine Namen)
 * 8. K10: Keine IP-Spalten in Quiz-Tabellen
 * 9. Origin-Ablehnung
 * 10. REST: CRUD Fragensätze, Sitzungs-Steuerung
 * 11. Gast (ohne Konto) wird abgelehnt (login_required)
 * 12. Klassen-Check: Schüler ohne Klassenmitgliedschaft wird abgelehnt
 * 13. lobby_state enthält expected bei Klassensitzung
 * 14. Anmeldung per HttpOnly-Cookie (Schüler)
 *
 * Verwendet 'ws' als WebSocket-Client gegen app.listen auf Port 0.
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

/** Lehrkraft registrieren und Session-Token holen */
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

/** Schüler registrieren und Session-Token holen */
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

/** Fragensatz erstellen */
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

/** Quiz-Sitzung starten */
async function startSession(app: FastifyInstance, token: string, quizId: number, classId?: number) {
  const body: Record<string, unknown> = { quiz_id: quizId }
  if (classId !== undefined) body['class_id'] = classId
  const res = await app.inject({
    method: 'POST',
    url: '/api/teacher/quiz-sessions',
    headers: {
      'content-type': 'application/json',
      'cookie': `tabula_session=${token}`,
    },
    body: JSON.stringify(body),
  })
  expect(res.statusCode).toBe(201)
  return JSON.parse(res.body) as { id: number; pin: string }
}

/** WebSocket-Verbindung herstellen (mit optionalem Cookie) */
function connectWs(url: string, cookie?: string): Promise<{ ws: WebSocket; waitFor: (type: string) => Promise<Record<string, unknown>> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, cookie ? { headers: { cookie } } : undefined)
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

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/teacher/quizzes',
      headers: { 'cookie': `tabula_session=${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const list = JSON.parse(listRes.body) as { id: number }[]
    expect(list.some(q => q.id === id)).toBe(true)

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

describe('Quiz WebSocket: Kompletter Ablauf (mit Konten)', () => {
  it('Lehrkraft + 2 registrierte Schueler, vollstaendiger Ablauf', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const s1Token = await registerStudent(app, 'mia')
    const s2Token = await registerStudent(app, 'tom')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    // Lehrkraft verbindet per Cookie
    const { ws: teacherWs, waitFor: teacherWait } = await connectWs(
      `${wsUrl}/api/quiz/ws`,
      `tabula_session=${teacherToken}`
    )
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })
    const joinedT = await teacherWait('joined')
    expect(joinedT['role']).toBe('teacher')

    // Schüler 1 verbindet per Cookie
    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(
      `${wsUrl}/api/quiz/ws`,
      `tabula_session=${s1Token}`
    )
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin })
    const joinedS1 = await s1Wait('joined')
    expect(joinedS1['display_name']).toBe('mia')

    // Schüler 2 verbindet per Cookie
    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(
      `${wsUrl}/api/quiz/ws`,
      `tabula_session=${s2Token}`
    )
    sendMsg(s2Ws, { type: 'student_join', pin: session.pin })
    await s2Wait('joined')

    // Lehrkraft startet erste Frage
    sendMsg(teacherWs, { type: 'next_question' })
    const qS1 = await s1Wait('question_start')
    const qS2 = await s2Wait('question_start')
    expect(qS1['question_index']).toBe(1)
    expect(qS2['question_index']).toBe(1)

    const questionId = qS1['question_id'] as number

    // Beide Schüler antworten korrekt (Index 1 = '4')
    sendMsg(s1Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackS1 = await s1Wait('answer_ack')
    expect(ackS1['correct']).toBe(true)
    expect(ackS1['points']).toBeGreaterThan(0)

    sendMsg(s2Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackS2 = await s2Wait('answer_ack')
    expect(ackS2['correct']).toBe(true)

    // Lehrkraft löst auf
    sendMsg(teacherWs, { type: 'reveal' })
    const revealT = await teacherWait('reveal')
    expect(revealT['correct_idx']).toBe(1)

    const revealS1 = await s1Wait('reveal')
    expect(revealS1['correct_idx']).toBe(1)

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
    const sToken = await registerStudent(app, 'testschueler')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${sToken}`)
    sendMsg(sWs, { type: 'student_join', pin: session.pin })
    await sWait('joined')

    sendMsg(teacherWs, { type: 'next_question' })
    const qMsg = await sWait('question_start')
    const questionId = qMsg['question_id'] as number

    sendMsg(sWs, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ack = await sWait('answer_ack')

    // answer_ack darf correct_idx nicht enthalten
    expect(ack['type']).toBe('answer_ack')
    expect(ack).not.toHaveProperty('correct_idx')
    expect(ack).not.toHaveProperty('options')

    // Kein unaufgefordertes 'reveal' (200ms warten)
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
    const sToken = await registerStudent(app, 'lates')
    const quizId = await createQuiz(app, teacherToken, 1) // 1s Zeitlimit
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${sToken}`)
    sendMsg(sWs, { type: 'student_join', pin: session.pin })
    await sWait('joined')

    sendMsg(teacherWs, { type: 'next_question' })
    const qMsg = await sWait('question_start')
    const questionId = qMsg['question_id'] as number

    // 1.5s warten (Timer läuft bei 1s ab)
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
    const sToken = await registerStudent(app, 'dupe')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${sToken}`)
    sendMsg(sWs, { type: 'student_join', pin: session.pin })
    await sWait('joined')

    sendMsg(teacherWs, { type: 'next_question' })
    const qMsg = await sWait('question_start')
    const questionId = qMsg['question_id'] as number

    sendMsg(sWs, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    await sWait('answer_ack')

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
    const s1Token = await registerStudent(app, 'fast')
    const s2Token = await registerStudent(app, 'slow')
    const quizId = await createQuiz(app, teacherToken, 30) // 30s Zeitlimit
    const session = await startSession(app, teacherToken, quizId)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${s1Token}`)
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin })
    await s1Wait('joined')

    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${s2Token}`)
    sendMsg(s2Ws, { type: 'student_join', pin: session.pin })
    await s2Wait('joined')

    sendMsg(teacherWs, { type: 'next_question' })
    const qS1 = await s1Wait('question_start')
    await s2Wait('question_start')
    const questionId = qS1['question_id'] as number

    sendMsg(s1Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackFast = await s1Wait('answer_ack')

    await sleep(500)
    sendMsg(s2Ws, { type: 'answer', question_id: questionId, chosen_idx: 1 })
    const ackSlow = await s2Wait('answer_ack')

    expect(ackFast['correct']).toBe(true)
    expect(ackSlow['correct']).toBe(true)
    expect(ackFast['points'] as number).toBeGreaterThanOrEqual(ackSlow['points'] as number)

    s1Ws.close()
    s2Ws.close()
    teacherWs.close()
    await teardown(app, db)
  })
})

describe('Quiz WebSocket: 3 Schüler, 2 Fragen, Rangliste', () => {
  it('Lehrkraft + 3 Schueler, 2 Fragen, Rangliste nach quiz_ended', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const s1Token = await registerStudent(app, 'anna')
    const s2Token = await registerStudent(app, 'ben')
    const s3Token = await registerStudent(app, 'cara')

    // Quiz mit 2 Fragen anlegen (zweite Frage durch PATCH hinzufügen)
    const quizId = await createQuiz(app, teacherToken, 30) // erste Frage mit 30s
    // Zweite Frage hinzufügen
    await app.inject({
      method: 'POST',
      url: `/api/teacher/quizzes/${quizId}/questions`,
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${teacherToken}` },
      body: JSON.stringify({
        question: 'Was macht ORDER BY?',
        options: ['Filtert', 'Sortiert', 'Gruppiert', 'Löscht'],
        correct_index: 1,
        time_limit: 30,
        points: 200,
      }),
    })

    const session = await startSession(app, teacherToken, quizId)

    // Alle verbinden
    const { ws: teacherWs, waitFor: teacherWait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })
    await teacherWait('joined')

    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${s1Token}`)
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin })
    await s1Wait('joined')

    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${s2Token}`)
    sendMsg(s2Ws, { type: 'student_join', pin: session.pin })
    await s2Wait('joined')

    const { ws: s3Ws, waitFor: s3Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${s3Token}`)
    sendMsg(s3Ws, { type: 'student_join', pin: session.pin })
    await s3Wait('joined')

    // --- Frage 1 ---
    sendMsg(teacherWs, { type: 'next_question' })
    const q1 = await s1Wait('question_start')
    await s2Wait('question_start')
    await s3Wait('question_start')
    expect(q1['question_index']).toBe(1)

    const q1Id = q1['question_id'] as number

    // Anna und Ben antworten richtig, Cara falsch
    sendMsg(s1Ws, { type: 'answer', question_id: q1Id, chosen_idx: 1 })
    const ack1 = await s1Wait('answer_ack')
    expect(ack1['correct']).toBe(true)
    expect(ack1['points'] as number).toBeGreaterThan(0)

    sendMsg(s2Ws, { type: 'answer', question_id: q1Id, chosen_idx: 1 })
    const ack2 = await s2Wait('answer_ack')
    expect(ack2['correct']).toBe(true)

    sendMsg(s3Ws, { type: 'answer', question_id: q1Id, chosen_idx: 0 }) // falsch
    const ack3 = await s3Wait('answer_ack')
    expect(ack3['correct']).toBe(false)
    expect(ack3['points']).toBe(0)

    // Auflösen
    sendMsg(teacherWs, { type: 'reveal' })
    const reveal1 = await teacherWait('reveal')
    expect(reveal1['correct_idx']).toBe(1)
    await teacherWait('leaderboard') // Rankings nach Frage 1

    // --- Frage 2 ---
    sendMsg(teacherWs, { type: 'next_question' })
    const q2 = await s1Wait('question_start')
    await s2Wait('question_start')
    await s3Wait('question_start')
    expect(q2['question_index']).toBe(2)

    const q2Id = q2['question_id'] as number

    // Alle drei antworten richtig auf Frage 2
    sendMsg(s1Ws, { type: 'answer', question_id: q2Id, chosen_idx: 1 })
    await s1Wait('answer_ack')
    sendMsg(s2Ws, { type: 'answer', question_id: q2Id, chosen_idx: 1 })
    await s2Wait('answer_ack')
    sendMsg(s3Ws, { type: 'answer', question_id: q2Id, chosen_idx: 1 })
    const ack3q2 = await s3Wait('answer_ack')
    expect(ack3q2['correct']).toBe(true)

    // Auflösen + Quiz beenden
    sendMsg(teacherWs, { type: 'reveal' })
    await teacherWait('reveal')
    const finalLb = await teacherWait('leaderboard')
    const rankings = finalLb['rankings'] as { rank: number; display_name: string; points: number }[]

    // Rangliste: mindestens 3 Einträge, sortiert nach Punkten absteigend
    expect(rankings.length).toBe(3)
    expect(rankings[0]!.points).toBeGreaterThanOrEqual(rankings[1]!.points)
    expect(rankings[1]!.points).toBeGreaterThanOrEqual(rankings[2]!.points)
    // Cara hat Frage 1 falsch beantwortet, sollte am Ende weniger Punkte haben als Anna/Ben
    const caraEntry = rankings.find(r => r.display_name === 'cara')
    const annaEntry = rankings.find(r => r.display_name === 'anna')
    expect(caraEntry).toBeDefined()
    expect(annaEntry).toBeDefined()
    expect(annaEntry!.points).toBeGreaterThan(caraEntry!.points)

    sendMsg(teacherWs, { type: 'end_quiz' })
    await teacherWait('quiz_ended')
    await s1Wait('quiz_ended')
    await s2Wait('quiz_ended')
    await s3Wait('quiz_ended')

    // Gast-Ablehnung: neuer Gast-WS ohne Cookie → login_required
    const { ws: guestWs, waitFor: guestWait } = await connectWs(`${wsUrl}/api/quiz/ws`, '')
    sendMsg(guestWs, { type: 'student_join', pin: session.pin })
    const guestErr = await guestWait('error')
    expect(guestErr['code']).toBe('login_required')
    guestWs.close()

    teacherWs.close(); s1Ws.close(); s2Ws.close(); s3Ws.close()
    await teardown(app, db)
  })
})

describe('Quiz WebSocket: Sicherheit', () => {
  it('Gast ohne Konto wird abgelehnt (login_required)', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    // WS ohne Cookie öffnen (kein Konto)
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`) // kein Cookie
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'student_join', pin: session.pin }))
      })
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>
        ws.close()
        resolve(msg)
      })
      ws.on('close', () => resolve({ type: 'closed' }))
      ws.on('error', () => resolve({ type: 'error' }))
      setTimeout(() => reject(new Error('timeout')), 3000)
    })

    expect(result['code']).toBe('login_required')

    await teardown(app, db)
  })

  it('Schueler ohne Klassenmitgliedschaft wird abgelehnt (not_in_class)', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const sToken = await registerStudent(app, 'fremder')

    // Klasse anlegen
    const classRes = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${teacherToken}` },
      body: JSON.stringify({ name: 'Klasse 10a' }),
    })
    expect(classRes.statusCode).toBe(201)
    const classId = (JSON.parse(classRes.body) as { class: { id: number } }).class.id

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, classId)

    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`, { headers: { cookie: `tabula_session=${sToken}` } })
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'student_join', pin: session.pin }))
      })
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>
        ws.close()
        resolve(msg)
      })
      ws.on('close', () => resolve({ type: 'closed' }))
      ws.on('error', () => resolve({ type: 'error' }))
      setTimeout(() => reject(new Error('timeout')), 3000)
    })

    expect(result['code']).toBe('not_in_class')

    await teardown(app, db)
  })

  it('lobby_state enthaelt expected bei Klassensitzung', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const s1Token = await registerStudent(app, 'mitglied1')
    const s2Token = await registerStudent(app, 'mitglied2')

    // Klasse anlegen
    const classRes = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${teacherToken}` },
      body: JSON.stringify({ name: 'Klasse Test' }),
    })
    const classBody = JSON.parse(classRes.body) as { class: { id: number; join_code: string } }
    const classId = classBody.class.id
    const joinCode = classBody.class.join_code

    for (const token of [s1Token, s2Token]) {
      await app.inject({
        method: 'POST',
        url: '/api/classes/join',
        headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${token}` },
        body: JSON.stringify({ code: joinCode }),
      })
    }

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, classId)

    // Lehrkraft verbindet und empfängt lobby_state
    const lobbyMsg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`, { headers: { cookie: `tabula_session=${teacherToken}` } })
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'teacher_join', room_id: session.id }))
      })
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>
        if (msg['type'] === 'lobby_state') {
          ws.close()
          resolve(msg)
        }
      })
      setTimeout(() => reject(new Error('timeout')), 3000)
    })

    expect(lobbyMsg['expected']).toBe(2)
    expect(typeof lobbyMsg['count']).toBe('number')

    await teardown(app, db)
  })

  it('Origin-Ablehnung: falscher Origin wird geschlossen', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
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
      ws.on('error', () => resolve())
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

    const { ws: ws2, waitFor: wait2 } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${token2}`)
    sendMsg(ws2, { type: 'teacher_join', room_id: session.id })

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

    const participantResult = db.prepare(
      'INSERT INTO quiz_participants (room_id, display_name, total_points) VALUES (?, ?, ?)'
    ).run(session.id, 'TestSchüler', 800)
    const participantId = participantResult.lastInsertRowid as number

    const questions = db.prepare(
      'SELECT id FROM quiz_questions WHERE set_id = ? ORDER BY position'
    ).all(quizId) as { id: number }[]
    expect(questions.length).toBeGreaterThan(0)

    db.prepare(
      'INSERT INTO quiz_answers (room_id, participant_id, question_id, chosen_idx, answer_ms, points) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(session.id, participantId, questions[0]!.id, 1, 500, 800)

    const endedAt = Math.floor(Date.now() / 1000) - 25 * 60 * 60
    db.prepare("UPDATE quiz_rooms SET state = 'ended', ended_at = ? WHERE id = ?").run(endedAt, session.id)

    const beforeParticipants = db.prepare('SELECT id FROM quiz_participants WHERE room_id = ?').all(session.id)
    expect(beforeParticipants.length).toBe(1)

    const cleaned = runQuizCleanupJob(db)
    expect(cleaned).toBe(1)

    const afterParticipants = db.prepare('SELECT id FROM quiz_participants WHERE room_id = ?').all(session.id)
    expect(afterParticipants.length).toBe(0)

    const afterAnswers = db.prepare('SELECT id FROM quiz_answers WHERE room_id = ?').all(session.id)
    expect(afterAnswers.length).toBe(0)

    const stats = db.prepare('SELECT * FROM quiz_question_stats WHERE room_id = ?').all(session.id) as Record<string, unknown>[]
    expect(stats.length).toBeGreaterThan(0)
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

    db.prepare(
      'INSERT INTO quiz_participants (room_id, display_name, total_points) VALUES (?, ?, ?)'
    ).run(session.id, 'TestSchüler', 500)

    const endedAt = Math.floor(Date.now() / 1000) - 12 * 60 * 60
    db.prepare("UPDATE quiz_rooms SET state = 'ended', ended_at = ? WHERE id = ?").run(endedAt, session.id)

    const cleaned = runQuizCleanupJob(db)
    expect(cleaned).toBe(0)

    const participants = db.prepare('SELECT id FROM quiz_participants WHERE room_id = ?').all(session.id)
    expect(participants.length).toBe(1)

    await teardown(app, db)
  })
})

describe('K10: Keine IP-Spalten in Quiz-Tabellen', () => {
  it('quiz_rooms hat keine IP-Spalten', async () => {
    const { app, db } = await setup()
    const cols = (db.prepare('PRAGMA table_info(quiz_rooms)').all() as { name: string }[]).map(c => c.name)
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

    const student = db.prepare("SELECT id FROM users WHERE username = 'schueler1'").get() as { id: number }
    const studentId = student.id

    db.prepare(
      'INSERT INTO quiz_participants (room_id, user_id, display_name, total_points) VALUES (?, ?, ?, ?)'
    ).run(session.id, studentId, 'Schueler1', 500)

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { 'cookie': `tabula_session=${studentToken}` },
    })
    expect(delRes.statusCode).toBe(200)

    const participants = db.prepare('SELECT id FROM quiz_participants WHERE user_id = ?').all(studentId)
    expect(participants.length).toBe(0)

    await teardown(app, db)
  })
})

describe('Quiz WebSocket: Anmeldung per HttpOnly-Cookie', () => {
  it('Lehrkraft tritt ohne token im Nachrichtentext bei, nur mit Cookie beim Upgrade', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'cookielehrer')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`, { headers: { cookie: `tabula_session=${teacherToken}` } })
      ws.on('open', () => ws.send(JSON.stringify({ type: 'teacher_join', room_id: session.id })))
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as Record<string, unknown>
        if (m['type'] === 'joined' || m['type'] === 'error') { ws.close(); resolve(m) }
      })
      setTimeout(() => reject(new Error('timeout')), 3000)
    })
    expect(msg['type']).toBe('joined')
    expect(msg['role']).toBe('teacher')

    const denied = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`) // kein Cookie
      ws.on('open', () => ws.send(JSON.stringify({ type: 'teacher_join', room_id: session.id })))
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as Record<string, unknown>
        if (m['type'] === 'joined' || m['type'] === 'error') { ws.close(); resolve(m) }
      })
      setTimeout(() => reject(new Error('timeout')), 3000)
    })
    expect(denied['code']).toBe('unauthorized')

    await teardown(app, db)
  })

  it('Schueler tritt mit Cookie bei, Anzeigename aus Konto', async () => {
    const { app, db, wsUrl } = await setup()
    const teacherToken = await registerTeacher(app, 'lehrer1')
    const sToken = await registerStudent(app, 'cookieschueler')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId)

    // Lehrkraft verbindet
    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    // Schüler verbindet mit Cookie, ohne display_name im Nachrichtentext
    const sMsg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`, { headers: { cookie: `tabula_session=${sToken}` } })
      ws.on('open', () => ws.send(JSON.stringify({ type: 'student_join', pin: session.pin })))
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as Record<string, unknown>
        if (m['type'] === 'joined' || m['type'] === 'error') { ws.close(); resolve(m) }
      })
      setTimeout(() => reject(new Error('timeout')), 3000)
    })
    expect(sMsg['type']).toBe('joined')
    expect(sMsg['role']).toBe('student')
    // display_name kommt aus dem Konto
    expect(sMsg['display_name']).toBe('cookieschueler')

    teacherWs.close()
    await teardown(app, db)
  })
})
