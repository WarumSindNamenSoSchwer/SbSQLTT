/**
 * Audit-Befunde 29.10.2026 (Cloudflare-Lauf): Registrierung setzt last_login_at, Quiz je Teilnehmer
 * nur eine Verbindung.
 */
import { describe, it, expect } from 'vitest'
import WebSocket from 'ws'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { runInactivityDeletionJob } from '../src/jobs.js'
import { testDb, registerTeacher, createClass, joinStudent } from './helpers.js'

const ORIGIN = 'https://www.tabulasql.de'

describe('Registrierung zählt als Anmeldung (Inaktivitäts-Löschung, K8)', () => {
  it('last_login_at ist gesetzt, der Job löscht das Konto nach 12 Monaten', async () => {
    const db = testDb()
    const app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true })
    await registerTeacher(app, 'nie-wieder@schule.de')
    const row = db.prepare("SELECT last_login_at FROM users WHERE email = 'nie-wieder@schule.de'").get() as { last_login_at: number | null }
    expect(row.last_login_at).toBeTypeOf('number')
    const in13Monaten = (row.last_login_at! + 400 * 24 * 3600) * 1000
    expect(runInactivityDeletionJob(db, in13Monaten)).toBeGreaterThan(0)
    expect(db.prepare("SELECT 1 FROM users WHERE email = 'nie-wieder@schule.de'").get()).toBeUndefined()
    await app.close()
  })
})

describe('Quiz: je Teilnehmer eine offene Verbindung', () => {
  it('zweiter Beitritt desselben Schülers schließt die erste Verbindung, Zählung bleibt 1', async () => {
    const db = testDb()
    const app = await buildApp({ db, mail: new InMemoryMailSender(), allowedOrigin: ORIGIN })
    const inj = app.inject.bind(app)
    ;(app as unknown as { inject: typeof app.inject }).inject = ((o: Record<string, unknown>) =>
      inj({ ...o, headers: { origin: ORIGIN, ...((o.headers as object) ?? {}) } } as never)) as typeof app.inject
    const t = await registerTeacher(app)
    const cls = await createClass(app, t.cookie)
    const s = await joinStudent(app, cls.code, 'Ben K.', 'pw-ben-1')
    const room = JSON.parse((await app.inject({ method: 'POST', url: '/api/teacher/quiz-sessions', headers: { 'content-type': 'application/json', cookie: t.cookie }, payload: { bank_lesson_id: 'select-basics', class_id: cls.id } })).body)
    await app.listen({ port: 0, host: '127.0.0.1' })
    const url = `ws://127.0.0.1:${(app.server.address() as { port: number }).port}/api/quiz/ws`
    const open = (cookie: string) => new Promise<{ ws: WebSocket; msgs: Record<string, unknown>[]; closed: Promise<number> }>((res) => {
      const ws = new WebSocket(url, { headers: { origin: ORIGIN, cookie } }); const msgs: Record<string, unknown>[] = []
      const closed = new Promise<number>((r) => ws.on('close', (c) => r(c)))
      ws.on('message', (m) => msgs.push(JSON.parse(String(m)))); ws.on('open', () => res({ ws, msgs, closed }))
    })
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const teacher = await open(t.cookie); teacher.ws.send(JSON.stringify({ type: 'teacher_join', room_id: room.id })); await wait(200)
    const a = await open(s.cookie); a.ws.send(JSON.stringify({ type: 'student_join', pin: room.pin })); await wait(200)
    const b = await open(s.cookie); b.ws.send(JSON.stringify({ type: 'student_join', pin: room.pin })); await wait(200)
    expect(await a.closed).toBe(4000)
    expect(b.ws.readyState).toBe(WebSocket.OPEN)
    teacher.ws.send(JSON.stringify({ type: 'next_question' })); await wait(200)
    const q = b.msgs.find((m) => m.type === 'question_start') as { question_id: number }
    b.ws.send(JSON.stringify({ type: 'answer', question_id: q.question_id, chosen_idx: 0 })); await wait(200)
    const progress = teacher.msgs.filter((m) => m.type === 'answer_progress').at(-1) as { count: number; total: number }
    expect(progress).toEqual({ type: 'answer_progress', count: 1, total: 1 })
    for (const c of [teacher, b]) c.ws.terminate()
    await app.close()
  })
})
