/**
 * P7 Quiz-Tests (K5, K8, K10):
 *
 * 1. Kompletter Ablauf: Lehrkraft + 2 Schüler (Klassen-Login)
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
 * 14. Anmeldung per HttpOnly-Cookie (Lehrkraft und Schüler)
 * 15. class_id ist Pflicht beim Quiz-Start
 *
 * Verwendet 'ws' als WebSocket-Client gegen app.listen auf Port 0.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import WebSocket from 'ws'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb, registerTeacher, createClass, joinStudent, C, type TestTeacher } from './helpers.js'
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

/** Lehrkraft registrieren und Session-Token holen (neues Modell: E-Mail + Keys) */
async function registerTeacherQuiz(app: FastifyInstance, email = 'lehrer@test.de'): Promise<{ token: string; teacher: TestTeacher }> {
  const teacher = await registerTeacher(app, email, 'sicheresPasswort1', 'Frau Test')
  const token = teacher.cookie.split('tabula_session=')[1]?.split(';')[0] ?? ''
  return { token, teacher }
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

/** Quiz-Sitzung starten (class_id ist jetzt Pflicht) */
async function startSession(app: FastifyInstance, token: string, quizId: number, classId: number) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/teacher/quiz-sessions',
    headers: {
      'content-type': 'application/json',
      'cookie': `tabula_session=${token}`,
    },
    body: JSON.stringify({ quiz_id: quizId, class_id: classId }),
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
    const { token } = await registerTeacherQuiz(app, 'lehrer1@test.de')

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
    const { token } = await registerTeacherQuiz(app, 'lehrer1@test.de')
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
    const { token } = await registerTeacherQuiz(app, 'lehrer1@test.de')
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
    const { token: token1 } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const { token: token2 } = await registerTeacherQuiz(app, 'lehrer2@test.de')
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
  it('startet eine Sitzung mit class_id und gibt PIN zurueck', async () => {
    const { app, db } = await setup()
    const { token, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const quizId = await createQuiz(app, token)
    const session = await startSession(app, token, quizId, cls.id)

    expect(session.id).toBeGreaterThan(0)
    expect(session.pin).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)

    await teardown(app, db)
  })

  it('ohne class_id wird 400 zurueckgegeben', async () => {
    const { app, db } = await setup()
    const { token } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const quizId = await createQuiz(app, token)

    const res = await app.inject({
      method: 'POST',
      url: '/api/teacher/quiz-sessions',
      headers: { 'content-type': 'application/json', 'cookie': `tabula_session=${token}` },
      body: JSON.stringify({ quiz_id: quizId }), // kein class_id
    })
    expect(res.statusCode).toBe(400)

    await teardown(app, db)
  })

  it('fremde Lehrkraft kann Sitzung nicht steuern', async () => {
    const { app, db } = await setup()
    const { token: token1, teacher: t1 } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const { token: token2 } = await registerTeacherQuiz(app, 'lehrer2@test.de')
    const cls = await createClass(app, t1.cookie, 'QuizKlasse1')
    const quizId = await createQuiz(app, token1)
    const session = await startSession(app, token1, quizId, cls.id)

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
    const { token, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse2')
    const quizId = await createQuiz(app, token)
    const session = await startSession(app, token, quizId, cls.id)

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

describe('Quiz WebSocket: Kompletter Ablauf (Klassen-Login)', () => {
  it('Lehrkraft + 2 Schueler per Klassen-Login, vollstaendiger Ablauf', async () => {
    const { app, db, wsUrl } = await setup()
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')

    // Zwei Schueler beitreten
    const { res: j1, cookie: s1Cookie } = await joinStudent(app, cls.code, 'Anna Test', 'passwort111')
    expect(j1.statusCode).toBe(201)
    const { res: j2, cookie: s2Cookie } = await joinStudent(app, cls.code, 'Ben Test', 'passwort222')
    expect(j2.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

    // Lehrkraft verbindet per Cookie
    const { ws: teacherWs, waitFor: teacherWait } = await connectWs(
      `${wsUrl}/api/quiz/ws`,
      `tabula_session=${teacherToken}`
    )
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })
    const joinedT = await teacherWait('joined')
    expect(joinedT['role']).toBe('teacher')
    // Lehrkraft bekommt den PIN für Beamer und QR-Code (nicht die Raum-ID)
    expect(joinedT['pin']).toBe(session.pin)
    expect(typeof joinedT['quiz_title']).toBe('string')
    // Kein display_name in 'joined' fuer Lehrkraft
    expect(joinedT['display_name']).toBeUndefined()

    // Schüler 1 verbindet per Cookie
    const s1Token = s1Cookie.split('tabula_session=')[1]?.split(';')[0] ?? s1Cookie.replace('tabula_session=', '')
    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(
      `${wsUrl}/api/quiz/ws`,
      s1Cookie
    )
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin })
    const joinedS1 = await s1Wait('joined')
    // Kein display_name in 'joined' fuer Schueler
    expect(joinedS1['display_name']).toBeUndefined()

    // Schüler 2 verbindet
    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(
      `${wsUrl}/api/quiz/ws`,
      s2Cookie
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
    const rankings = lbT['rankings'] as { enc_name?: string; points: number }[]
    expect(rankings).toHaveLength(2)
    expect(rankings[0]?.points).toBeGreaterThan(0)
    // Lehrkraft bekommt enc_name (verschluesselt), kein Klartext-Name
    if (rankings[0]?.enc_name) {
      expect(String(rankings[0].enc_name)).toMatch(/^h1\./)
    }

    // Schueler bekommt my_rank statt leaderboard
    const myRankS1 = await s1Wait('my_rank')
    expect(typeof myRankS1['rank']).toBe('number')
    expect(typeof myRankS1['of']).toBe('number')
    expect(typeof myRankS1['points']).toBe('number')
    // Schueler bekommt kein enc_name oder Klarnamen-Feld
    expect(myRankS1['enc_name']).toBeUndefined()
    expect(myRankS1['display_name']).toBeUndefined()

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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const { res: jr, cookie: sCookie } = await joinStudent(app, cls.code, 'Test Schueler', 'passwort111')
    expect(jr.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`, sCookie)
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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const { res: jr, cookie: sCookie } = await joinStudent(app, cls.code, 'Late Schueler', 'passwort111')
    expect(jr.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken, 1) // 1s Zeitlimit
    const session = await startSession(app, teacherToken, quizId, cls.id)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`, sCookie)
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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const { res: jr, cookie: sCookie } = await joinStudent(app, cls.code, 'Dupe Schueler', 'passwort111')
    expect(jr.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: sWs, waitFor: sWait } = await connectWs(`${wsUrl}/api/quiz/ws`, sCookie)
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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')

    const { res: j1, cookie: s1Cookie } = await joinStudent(app, cls.code, 'Fast Schueler', 'passwort111')
    expect(j1.statusCode).toBe(201)
    const { res: j2, cookie: s2Cookie } = await joinStudent(app, cls.code, 'Slow Schueler', 'passwort222')
    expect(j2.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken, 30) // 30s Zeitlimit
    const session = await startSession(app, teacherToken, quizId, cls.id)

    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, s1Cookie)
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin })
    await s1Wait('joined')

    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, s2Cookie)
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
  it('Lehrkraft + 3 Schueler, 2 Fragen, Rangliste nach quiz_ended (enc_name)', async () => {
    const { app, db, wsUrl } = await setup()
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse3')

    // Drei Schueler beitreten
    const { res: j1, cookie: s1Cookie } = await joinStudent(app, cls.code, 'Anna Quiz', 'passwort111')
    expect(j1.statusCode).toBe(201)
    const { res: j2, cookie: s2Cookie } = await joinStudent(app, cls.code, 'Ben Quiz', 'passwort222')
    expect(j2.statusCode).toBe(201)
    const { res: j3, cookie: s3Cookie } = await joinStudent(app, cls.code, 'Cara Quiz', 'passwort333')
    expect(j3.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken, 30) // 2 Fragen in createQuiz

    const session = await startSession(app, teacherToken, quizId, cls.id)

    // Alle verbinden
    const { ws: teacherWs, waitFor: teacherWait } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })
    await teacherWait('joined')

    const { ws: s1Ws, waitFor: s1Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, s1Cookie)
    sendMsg(s1Ws, { type: 'student_join', pin: session.pin })
    await s1Wait('joined')

    const { ws: s2Ws, waitFor: s2Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, s2Cookie)
    sendMsg(s2Ws, { type: 'student_join', pin: session.pin })
    await s2Wait('joined')

    const { ws: s3Ws, waitFor: s3Wait } = await connectWs(`${wsUrl}/api/quiz/ws`, s3Cookie)
    sendMsg(s3Ws, { type: 'student_join', pin: session.pin })
    await s3Wait('joined')

    // --- Frage 1 ---
    sendMsg(teacherWs, { type: 'next_question' })
    const q1 = await s1Wait('question_start')
    await s2Wait('question_start')
    await s3Wait('question_start')
    expect(q1['question_index']).toBe(1)

    const q1Id = q1['question_id'] as number

    // Anna und Ben richtig, Cara falsch
    sendMsg(s1Ws, { type: 'answer', question_id: q1Id, chosen_idx: 1 })
    const ack1 = await s1Wait('answer_ack')
    expect(ack1['correct']).toBe(true)

    sendMsg(s2Ws, { type: 'answer', question_id: q1Id, chosen_idx: 1 })
    const ack2 = await s2Wait('answer_ack')
    expect(ack2['correct']).toBe(true)

    sendMsg(s3Ws, { type: 'answer', question_id: q1Id, chosen_idx: 0 }) // falsch
    const ack3 = await s3Wait('answer_ack')
    expect(ack3['correct']).toBe(false)
    expect(ack3['points']).toBe(0)

    // Auflösen
    sendMsg(teacherWs, { type: 'reveal' })
    await teacherWait('reveal')

    // Lehrkraft bekommt leaderboard mit enc_name und entschlüsselt die echten Namen
    const lbAfterQ1 = await teacherWait('leaderboard')
    const rankings1 = lbAfterQ1['rankings'] as { enc_name: string | null; points: number; rank: number }[]
    expect(rankings1).toHaveLength(3)
    for (const r of rankings1) expect(String(r.enc_name)).toMatch(/^h1\./)
    const names1 = await Promise.all(rankings1.map((r) => C.openForTeacher(teacher.privateKey, r.enc_name!)))
    expect(names1.sort()).toEqual(['Anna Quiz', 'Ben Quiz', 'Cara Quiz'])
    // Platz 1 hat die meisten Punkte, Cara (falsch) ist Letzte mit 0
    expect(rankings1[0].points).toBeGreaterThanOrEqual(rankings1[1].points)
    expect(await C.openForTeacher(teacher.privateKey, rankings1[2].enc_name!)).toBe('Cara Quiz')
    expect(rankings1[2].points).toBe(0)

    // Schüler bekommen nur den eigenen Platz, keine Namen
    const r1 = await s1Wait('my_rank')
    expect(r1['of']).toBe(3)
    expect([1, 2]).toContain(r1['rank'])
    expect(r1['enc_name']).toBeUndefined()
    expect(r1['rankings']).toBeUndefined()
    const r3 = await s3Wait('my_rank')
    expect(r3['rank']).toBe(3)
    expect(r3['points']).toBe(0)

    // --- Frage 2 ---
    sendMsg(teacherWs, { type: 'next_question' })
    const q2 = await s1Wait('question_start')
    await s2Wait('question_start')
    await s3Wait('question_start')

    const q2Id = q2['question_id'] as number

    // Alle drei richtig
    sendMsg(s1Ws, { type: 'answer', question_id: q2Id, chosen_idx: 1 })
    await s1Wait('answer_ack')
    sendMsg(s2Ws, { type: 'answer', question_id: q2Id, chosen_idx: 1 })
    await s2Wait('answer_ack')
    sendMsg(s3Ws, { type: 'answer', question_id: q2Id, chosen_idx: 1 })
    await s3Wait('answer_ack')

    // Auflösen + Quiz beenden
    sendMsg(teacherWs, { type: 'reveal' })
    await teacherWait('reveal')
    const finalLb = await teacherWait('leaderboard')
    const rankings = finalLb['rankings'] as { rank: number; enc_name?: string; points: number }[]

    // Rangliste: 3 Einträge, sortiert nach Punkten absteigend
    expect(rankings.length).toBe(3)
    expect(rankings[0]!.points).toBeGreaterThanOrEqual(rankings[1]!.points)
    expect(rankings[1]!.points).toBeGreaterThanOrEqual(rankings[2]!.points)

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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')

    // Klasse A anlegen, Quiz dort starten
    const clsA = await createClass(app, teacher.cookie, 'Klasse A')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, clsA.id)

    // Klasse B anlegen, Schueler tritt nur in Klasse B bei
    const clsB = await createClass(app, teacher.cookie, 'Klasse B')
    const { res: jr, cookie: sToken } = await joinStudent(app, clsB.code, 'Fremder Schueler', 'passwort111')
    expect(jr.statusCode).toBe(201)

    // Schueler versucht bei Quiz von Klasse A beizutreten
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`, { headers: { cookie: sToken } })
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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'Klasse Test')

    // Zwei Schueler beitreten lassen
    await joinStudent(app, cls.code, 'Mitglied 1', 'passwort111')
    await joinStudent(app, cls.code, 'Mitglied 2', 'passwort222')

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

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
    const { token: token1, teacher: t1 } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const { token: token2 } = await registerTeacherQuiz(app, 'lehrer2@test.de')
    const cls = await createClass(app, t1.cookie, 'QuizKlasse')
    const quizId = await createQuiz(app, token1)
    const session = await startSession(app, token1, quizId, cls.id)

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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

    const participantResult = db.prepare(
      'INSERT INTO quiz_participants (room_id, display_name, total_points) VALUES (?, ?, ?)'
    ).run(session.id, '#1', 800)
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
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

    db.prepare(
      'INSERT INTO quiz_participants (room_id, display_name, total_points) VALUES (?, ?, ?)'
    ).run(session.id, '#1', 500)

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
  it('Lehrkraft loeschen entfernt quiz_participants Eintraege der Klassen-Schueler', async () => {
    const { app, db } = await setup()
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Quiz Schueler', 'passwort111')
    expect(jr.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }
    const studentId = student.id

    db.prepare(
      'INSERT INTO quiz_participants (room_id, user_id, display_name, total_points) VALUES (?, ?, ?, ?)'
    ).run(session.id, studentId, '#' + studentId, 500)

    // Lehrkraft loescht ihr Konto (loescht auch Schueler)
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { 'cookie': teacher.cookie },
    })
    expect(delRes.statusCode).toBe(200)

    // Schueler-Konto geloescht → quiz_participants auch weg
    const participants = db.prepare('SELECT id FROM quiz_participants WHERE user_id = ?').all(studentId)
    expect(participants.length).toBe(0)

    await teardown(app, db)
  })
})

describe('Quiz WebSocket: Anmeldung per HttpOnly-Cookie', () => {
  it('Lehrkraft tritt ohne token im Nachrichtentext bei, nur mit Cookie beim Upgrade', async () => {
    const { app, db, wsUrl } = await setup()
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'cookielehrer@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

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

  it('Schueler tritt mit Cookie bei (kein display_name in joined)', async () => {
    const { app, db, wsUrl } = await setup()
    const { token: teacherToken, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')
    const { res: jr, cookie: sCookie } = await joinStudent(app, cls.code, 'Cookie Schueler', 'passwort111')
    expect(jr.statusCode).toBe(201)

    const quizId = await createQuiz(app, teacherToken)
    const session = await startSession(app, teacherToken, quizId, cls.id)

    // Lehrkraft verbindet
    const { ws: teacherWs } = await connectWs(`${wsUrl}/api/quiz/ws`, `tabula_session=${teacherToken}`)
    sendMsg(teacherWs, { type: 'teacher_join', room_id: session.id })

    // Schüler verbindet mit Cookie, ohne display_name im Nachrichtentext
    const sMsg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/api/quiz/ws`, { headers: { cookie: sCookie } })
      ws.on('open', () => ws.send(JSON.stringify({ type: 'student_join', pin: session.pin })))
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as Record<string, unknown>
        if (m['type'] === 'joined' || m['type'] === 'error') { ws.close(); resolve(m) }
      })
      setTimeout(() => reject(new Error('timeout')), 3000)
    })
    expect(sMsg['type']).toBe('joined')
    // Kein display_name in 'joined' fuer Schueler (neues Modell)
    expect(sMsg['display_name']).toBeUndefined()

    teacherWs.close()
    await teardown(app, db)
  })
})

// ---------------------------------------------------------------------------
// Quiz-Bank: automatische Fragensaetze
// ---------------------------------------------------------------------------

describe('Quiz-Bank: GET /api/teacher/quiz-bank', () => {
  it('liefert 10 Lektionen mit je 8 Fragen', async () => {
    const { app, db } = await setup()
    const { token } = await registerTeacherQuiz(app, 'lehrer1@test.de')

    const res = await app.inject({
      method: 'GET',
      url: '/api/teacher/quiz-bank',
      headers: { cookie: `tabula_session=${token}` },
    })
    expect(res.statusCode).toBe(200)
    const bank = JSON.parse(res.body) as { lesson_id: string; title: string; question_count: number }[]
    expect(bank.length).toBe(10)
    for (const entry of bank) {
      expect(entry.question_count).toBe(8)
      expect(typeof entry.title).toBe('string')
    }

    await teardown(app, db)
  })

  it('nicht angemeldete Anfrage wird abgelehnt', async () => {
    const { app, db } = await setup()

    const res = await app.inject({
      method: 'GET',
      url: '/api/teacher/quiz-bank',
    })
    expect(res.statusCode).toBe(401)

    await teardown(app, db)
  })
})

describe('Quiz-Bank: POST /api/teacher/quiz-sessions mit bank_lesson_id', () => {
  it('Lehrkraft startet Auto-Quiz, Fragen kommen an', async () => {
    const { app, db, wsUrl } = await setup()
    const { token, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')

    // Auto-Session starten (class_id Pflicht)
    const res = await app.inject({
      method: 'POST',
      url: '/api/teacher/quiz-sessions',
      headers: { 'content-type': 'application/json', cookie: `tabula_session=${token}` },
      body: JSON.stringify({ bank_lesson_id: 'joins', class_id: cls.id }),
    })
    expect(res.statusCode).toBe(201)
    const { id, pin } = JSON.parse(res.body) as { id: number; pin: string }
    expect(id).toBeGreaterThan(0)
    expect(pin).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)

    // Fragensatz wurde mit source='auto' angelegt
    const qSet = db.prepare(
      "SELECT id, source FROM quiz_question_sets WHERE source = 'auto'"
    ).get() as { id: number; source: string } | undefined
    expect(qSet).toBeDefined()
    expect(qSet?.source).toBe('auto')

    // 8 Fragen vorhanden
    const qCount = (db.prepare('SELECT COUNT(*) AS cnt FROM quiz_questions WHERE set_id = ?').get(qSet!.id) as { cnt: number }).cnt
    expect(qCount).toBe(8)

    // Zweiter Aufruf: gleicher Satz wird wiederverwendet (kein Duplikat)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/teacher/quiz-sessions',
      headers: { 'content-type': 'application/json', cookie: `tabula_session=${token}` },
      body: JSON.stringify({ bank_lesson_id: 'joins', class_id: cls.id }),
    })
    expect(res2.statusCode).toBe(201)
    const setCount = (db.prepare(
      "SELECT COUNT(*) AS cnt FROM quiz_question_sets WHERE source = 'auto' AND title = 'Tabellen verbinden mit JOIN'"
    ).get() as { cnt: number }).cnt
    expect(setCount).toBe(1)

    await teardown(app, db)
  })

  it('fremde Lehrkraft sieht keine Auto-Saetze anderer', async () => {
    const { app, db } = await setup()
    const { token: token1, teacher: t1 } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const { token: token2 } = await registerTeacherQuiz(app, 'lehrer2@test.de')
    const cls1 = await createClass(app, t1.cookie, 'QuizKlasse1')

    // Lehrer 1 legt Auto-Satz an
    await app.inject({
      method: 'POST',
      url: '/api/teacher/quiz-sessions',
      headers: { 'content-type': 'application/json', cookie: `tabula_session=${token1}` },
      body: JSON.stringify({ bank_lesson_id: 'select-basics', class_id: cls1.id }),
    })

    // Lehrer 2 listet eigene Fragensaetze
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/teacher/quizzes',
      headers: { cookie: `tabula_session=${token2}` },
    })
    const list = JSON.parse(listRes.body) as { id: number }[]
    expect(list.length).toBe(0)

    await teardown(app, db)
  })

  it('ungueltige lesson_id liefert 404', async () => {
    const { app, db } = await setup()
    const { token, teacher } = await registerTeacherQuiz(app, 'lehrer1@test.de')
    const cls = await createClass(app, teacher.cookie, 'QuizKlasse')

    const res = await app.inject({
      method: 'POST',
      url: '/api/teacher/quiz-sessions',
      headers: { 'content-type': 'application/json', cookie: `tabula_session=${token}` },
      body: JSON.stringify({ bank_lesson_id: 'nichtvorhanden', class_id: cls.id }),
    })
    expect(res.statusCode).toBe(404)

    await teardown(app, db)
  })
})
