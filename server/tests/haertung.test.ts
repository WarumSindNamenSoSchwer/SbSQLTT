/**
 * Härtung (Audit 29.10.2026): Anmeldeschutz, Eingabegrenzen, robuster Quiz-WebSocket.
 * Jeder Test prüft das gewünschte Verhalten; die Nummern P1 bis P14 verweisen auf den Bericht.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import WebSocket from 'ws'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb, registerTeacher, createClass, joinStudent, lookup, C } from './helpers.js'

const ORIGIN = 'https://www.tabulasql.de'
let app: FastifyInstance
let db: ReturnType<typeof testDb>

beforeEach(async () => {
  db = testDb()
  app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true })
})
afterEach(async () => { await app.close() })

/** Anfrage von einem bestimmten "Gerät" (X-Real-IP wie hinter Caddy) */
const from = (ip: string) => ({ 'x-real-ip': ip, 'content-type': 'application/json' })
const post = (url: string, payload: object, ip = '198.51.100.1', cookie?: string) =>
  app.inject({ method: 'POST', url, headers: { ...from(ip), ...(cookie ? { cookie } : {}) }, payload })

describe('P1/P2 Klassencodes', () => {
  it('ein Gerät, das viele falsche Codes probiert, bremst nur sich selbst', async () => {
    const t = await registerTeacher(app)
    const cls = await createClass(app, t.cookie)
    let last = 0
    for (let i = 0; i < 70; i++) last = (await app.inject({ method: 'GET', url: `/api/class-login/lookup?code=falsch-${i}`, headers: from('203.0.113.9') })).statusCode
    expect(last).toBe(429)
    const other = await app.inject({ method: 'GET', url: `/api/class-login/lookup?code=${cls.code}`, headers: from('198.51.100.20') })
    expect(other.statusCode).toBe(200)
  })

  it('join zählt unbekannte Codes ebenfalls', async () => {
    let n429 = 0
    for (let i = 0; i < 70; i++) {
      const r = await post('/api/class-login/join', { code: `nicht-da-${i}`, key: 'a'.repeat(64), enc_name: 'h1.AA.AA.AA' }, '203.0.113.10')
      if (r.statusCode === 429) n429++
    }
    expect(n429).toBeGreaterThan(0)
  })
})

describe('P3/P4 Klassen-Login', () => {
  it('"Passwort schon vergeben" zählt als Fehlversuch und wird gebremst', async () => {
    const t = await registerTeacher(app)
    const cls = await createClass(app, t.cookie)
    const a = await joinStudent(app, cls.code, 'Lena S.', 'pw-lena-1')
    const statuses = new Set<number>()
    for (let i = 0; i < 45; i++) statuses.add((await post('/api/class-login/join', { code: cls.code, key: a.key, enc_name: 'h1.AA.AA.AA' }, '203.0.113.11')).statusCode)
    expect(statuses.has(409)).toBe(true)
    expect(statuses.has(429)).toBe(true)
  })

  it('Fehlversuche von einem Gerät sperren die übrige Klasse nicht', async () => {
    const t = await registerTeacher(app)
    const cls = await createClass(app, t.cookie)
    const ok = await joinStudent(app, cls.code, 'Mia T.', 'pw-mia-1')
    let last = 0
    for (let i = 0; i < 45; i++) last = (await post('/api/class-login/login', { code: cls.code, key: i.toString(16).padStart(64, '0') }, '203.0.113.12')).statusCode
    expect(last).toBe(429)
    const r = await post('/api/class-login/login', { code: cls.code, key: ok.key }, '198.51.100.30')
    expect(r.statusCode).toBe(200)
  })

  it('eine ganze Klasse am selben Schul-Router kann beitreten', async () => {
    const t = await registerTeacher(app)
    const cls = await createClass(app, t.cookie)
    const info = await lookup(app, cls.code)
    const pub = await C.importPublicKey(info.public_key)
    let created = 0
    for (let i = 0; i < 32; i++) {
      const key = await C.deriveStudentKey(info.class_salt, `Schüler ${i}`, 'gemeinsam1')
      const r = await post('/api/class-login/join', { code: cls.code, key, enc_name: await C.sealForTeacher(pub, `Schüler ${i}`) }, '192.0.2.50')
      if (r.statusCode === 201) created++
    }
    expect(created).toBe(32)
  })
})

describe('P5 Lehrkraft-Login', () => {
  it('fremde Fehlversuche sperren die Lehrkraft auf ihrem Gerät nicht aus', async () => {
    await registerTeacher(app, 'lk@schule.de', 'richtigesPw1')
    let last = 0
    for (let i = 0; i < 12; i++) last = (await post('/api/login', { login: 'lk@schule.de', password: 'falsch' + i }, '203.0.113.13')).statusCode
    expect(last).toBe(429)
    const r = await post('/api/login', { login: 'lk@schule.de', password: 'richtigesPw1' }, '198.51.100.40')
    expect(r.statusCode).toBe(200)
  })

  it('erfolgreiche Anmeldungen zählen nicht gegen die Grenze', async () => {
    await registerTeacher(app, 'oft@schule.de', 'richtigesPw1')
    for (let i = 0; i < 15; i++) {
      expect((await post('/api/login', { login: 'oft@schule.de', password: 'richtigesPw1' })).statusCode).toBe(200)
    }
  })
})

describe('P6 Registrierung', () => {
  it('viele Konten vom selben Gerät werden gebremst', async () => {
    const { bundle } = await C.createTeacherKeys('egalPasswort1', C.generateRecoveryCode())
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      statuses.push((await post('/api/register', { display_name: 'X', name: 'X', email: `n${i}@schule.de`, password: 'egalPasswort1', terms_accepted: true, keys: bundle }, '203.0.113.14')).statusCode)
    }
    expect(statuses.filter((s) => s === 201).length).toBe(10)
    expect(statuses.at(-1)).toBe(429)
  })
})

describe('P9 Schlüssel setzen', () => {
  it('neues Schlüsselpaar nur in der Wiederherstellung, sonst 403', async () => {
    const t = await registerTeacher(app)
    const { bundle } = await C.createTeacherKeys('anderesPw12', C.generateRecoveryCode())
    const r = await post('/api/me/keys', { keys: bundle }, undefined, t.cookie)
    expect(r.statusCode).toBe(403)
  })

  it('neuer Wiederherstellungscode braucht das aktuelle Passwort', async () => {
    const t = await registerTeacher(app)
    const me = JSON.parse((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: t.cookie } })).body).user
    const pk = await C.unwrapWithSecret(t.password, me.keys.wrapped_by_password)
    const keys = { public_key: me.keys.public_key, wrapped_by_password: me.keys.wrapped_by_password, wrapped_by_recovery: await C.wrapWithSecret('neuer-code', pk) }
    expect((await post('/api/me/keys', { keys }, undefined, t.cookie)).statusCode).toBe(403)
    expect((await post('/api/me/keys', { keys, current_password: 'falsch' }, undefined, t.cookie)).statusCode).toBe(403)
    const ok = await post('/api/me/keys', { keys, current_password: t.password }, undefined, t.cookie)
    expect(JSON.parse(ok.body)).toEqual({ ok: true, new_pair: false })
  })
})

describe('P10 Konto löschen', () => {
  it('nur mit dem aktuellen Passwort', async () => {
    const t = await registerTeacher(app)
    const del = (payload?: object) => app.inject({ method: 'DELETE', url: '/api/me', headers: { cookie: t.cookie, ...(payload ? { 'content-type': 'application/json' } : {}) }, ...(payload ? { payload } : {}) })
    expect((await del()).statusCode).toBe(400)
    expect((await del({ password: 'falsch' })).statusCode).toBe(403)
    expect((await del({ password: t.password })).statusCode).toBe(200)
  })

  it('löscht auch eigene Fragensätze (Nutzungsbedingungen 9, Datenschutz K8)', async () => {
    const t = await registerTeacher(app)
    const mk = await app.inject({
      method: 'POST', url: '/api/teacher/quizzes', headers: { cookie: t.cookie, 'content-type': 'application/json' },
      payload: { title: 'Mein Quiz', questions: [{ question: 'Was ist SQL?', options: ['Sprache', 'Tier'], correct_idx: 0 }] },
    })
    expect(mk.statusCode).toBeLessThan(300)
    const own = () => (db.prepare("SELECT COUNT(*) AS n FROM quiz_question_sets WHERE source = 'custom'").get() as { n: number }).n
    expect(own()).toBe(1)
    const res = await app.inject({ method: 'DELETE', url: '/api/me', headers: { cookie: t.cookie, 'content-type': 'application/json' }, payload: { password: t.password } })
    expect(res.statusCode).toBe(200)
    expect(own()).toBe(0)
    expect((db.prepare('SELECT COUNT(*) AS n FROM quiz_questions').get() as { n: number }).n).toBe(0)
  })
})

describe('P12 Quiz-WebSocket bleibt bei unerwarteten Nachrichten stabil', () => {
  it('unbekannte Formen bekommen eine Fehlermeldung, der Dienst läuft weiter', async () => {
    const wsApp = await buildApp({ db: testDb(), mail: new InMemoryMailSender(), allowedOrigin: ORIGIN })
    await wsApp.listen({ port: 0, host: '127.0.0.1' })
    const port = (wsApp.server.address() as { port: number }).port
    const thrown: string[] = []
    const onErr = (e: Error) => thrown.push(e.message)
    process.on('uncaughtException', onErr)
    try {
      for (const frame of ['null', '42', '"text"', '[]', '{"type":"teacher_join","room_id":"1"}', '{"type":"student_join","pin":5}', '{"type":"answer","question_id":1,"chosen_idx":-1}']) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/api/quiz/ws`, { headers: { origin: ORIGIN } })
        const reply = new Promise<Record<string, unknown>>((res) => ws.on('message', (m) => res(JSON.parse(String(m)))))
        await new Promise<void>((res) => ws.on('open', () => res()))
        ws.send(frame)
        const msg = await reply
        expect(msg.type).toBe('error')
        ws.terminate()
      }
      // Zu große Nachricht: Verbindung wird geschlossen (1009), kein Absturz
      const big = new WebSocket(`ws://127.0.0.1:${port}/api/quiz/ws`, { headers: { origin: ORIGIN } })
      await new Promise<void>((res) => big.on('open', () => res()))
      const closed = new Promise<number>((res) => big.on('close', (code) => res(code)))
      big.send('x'.repeat(10_000))
      expect(await closed).toBe(1009)
      expect(thrown).toEqual([])
      expect((await wsApp.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200)
    } finally {
      process.off('uncaughtException', onErr)
      await wsApp.close()
    }
  })
})

describe('P13 Eingabegrenzen bei Passwort vergessen', () => {
  it('überlange Eingaben werden früh abgelehnt', async () => {
    const long = 'a'.repeat(5000)
    const f = await post('/api/password/forgot', { email: `${long}@x.de` })
    expect(JSON.parse(f.body)).toEqual({ ok: true })
    const r = await post('/api/password/reset', { token: long, password: 'neuesPasswort1' })
    expect(r.statusCode).toBe(400)
  })
})

describe('P14 Fortschritt nur für echte Lektionen und plausible Werte', () => {
  it('unbekannte Lektionen werden übersprungen, Werte begrenzt', async () => {
    const t = await registerTeacher(app)
    const cls = await createClass(app, t.cookie)
    const s = await joinStudent(app, cls.code, 'Ben K.', 'pw-ben-1')
    const r = await app.inject({ method: 'PUT', url: '/api/progress', headers: { 'content-type': 'application/json', cookie: s.cookie },
      payload: { progress: [
        { lesson_id: 'erfunden', step: 0, done: true, attempts: 1, updated_at: 1 },
        { lesson_id: 'select-basics', step: 200, done: true, attempts: 1, updated_at: 1 },
        { lesson_id: 'select-basics', step: 1, done: false, attempts: 2 ** 40, updated_at: 2 ** 45 },
      ] } })
    expect(r.statusCode).toBe(200)
    const rows = db.prepare('SELECT lesson_id, step, attempts, updated_at FROM progress').all() as { lesson_id: string; step: number; attempts: number; updated_at: number }[]
    expect(rows.length).toBe(1)
    expect(rows[0].lesson_id).toBe('select-basics')
    expect(rows[0].attempts).toBe(10_000)
    expect(rows[0].updated_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000))
  })
})
