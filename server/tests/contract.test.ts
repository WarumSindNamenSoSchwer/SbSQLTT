/**
 * Vertragstest Frontend ↔ Server.
 *
 * Ruft die ECHTEN Frontend-Client-Funktionen (src/lib/tabula/api.ts, quiz-api.ts) gegen die
 * ECHTE Server-App (über HTTP, wie im Browser) auf. Fängt ab, wenn Pfade, Methoden oder
 * Antwortformen zwischen Frontend und Server auseinanderlaufen.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb } from './helpers.js'
import type { Db } from '../src/db.js'

const ORIGIN = 'http://test.local'
let app: FastifyInstance
let db: Db
let base = ''
const mail = new InMemoryMailSender()
// Echtes fetch sichern, bevor es für die Client-Aufrufe ersetzt wird
const nativeFetch = globalThis.fetch.bind(globalThis)

// Browser-ähnliches fetch: relative /api-URLs, Origin-Header, Cookie-Jar je "Browser"
function makeBrowser() {
  let cookie = ''
  const f = async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    headers.set('origin', ORIGIN)
    if (cookie) headers.set('cookie', cookie)
    const res = await nativeFetch(base + input, { ...init, headers })
    const set = res.headers.get('set-cookie')
    if (set) {
      const v = set.split(';')[0]
      cookie = v.endsWith('=') ? '' : v
    }
    return res
  }
  return f
}
async function as<T>(browser: ReturnType<typeof makeBrowser>, fn: () => Promise<T>): Promise<T> {
  const prev = globalThis.fetch
  ;(globalThis as { fetch: unknown }).fetch = browser
  try { return await fn() } finally { (globalThis as { fetch: unknown }).fetch = prev }
}

let api: typeof import('../../src/lib/tabula/api.ts')
let qapi: typeof import('../../src/lib/tabula/quiz-api.ts')
const realFetch = globalThis.fetch

beforeAll(async () => {
  db = testDb()
  app = await buildApp({ db, mail, allowedOrigin: ORIGIN })
  await app.listen({ port: 0, host: '127.0.0.1' })
  base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`
  // Client-Module nutzen fetch('/api/...'): auf den Testserver umbiegen
  api = await import('../../src/lib/tabula/api.ts')
  qapi = await import('../../src/lib/tabula/quiz-api.ts')
}, 60_000)

afterAll(async () => {
  globalThis.fetch = realFetch
  await app.close()
  db.close()
})

describe('Vertrag: Frontend-Clients gegen echten Server', () => {
  it('Konto, Klasse, Fortschritt, Dashboard, Lektionen, Quiz-Editor, Quiz-Start, Auswertung', async () => {
    const teacher = makeBrowser()
    const student = makeBrowser()

    // Konten
    await as(teacher, () => api.apiRegister({ role: 'teacher', username: 'vlehrer', display_name: 'Frau V', name: 'Vera V', email: 'v@schule.de', password: 'geheimnis123', terms_accepted: true } as never))
    await as(student, () => api.apiRegister({ role: 'student', username: 'vschueler', display_name: 'Sam', password: 'geheimnis123' } as never))
    const me = await as(teacher, () => api.apiMe())
    expect(me.user.role).toBe('teacher')
    expect(me.user.email_verified_at).toBeNull()

    // Klasse anlegen, Schüler tritt bei
    const created = await as(teacher, () => api.apiTeacherCreateClass('10v'))
    const cls = created.class
    expect(cls.join_code).toMatch(/^[A-Z2-9]{6}$/)
    const joined = await as(student, () => api.apiJoinClass(cls.join_code))
    expect(joined.class_name ?? (joined as { ok: boolean }).ok).toBeTruthy()

    // Lektionen: setzen und wieder lesen (D4)
    await as(teacher, () => api.apiTeacherPutLessons(cls.id, [{ lesson_id: 'where-filters', unlocked: true, sort_order: 0, is_focus: true }]))
    const lessons = await as(teacher, () => api.apiTeacherGetLessons(cls.id))
    expect(lessons.lessons).toEqual([{ lesson_id: 'where-filters', unlocked: true, sort_order: 0, is_focus: true }])

    // Schüler sieht Fokus
    const mine = await as(student, () => api.apiGetClasses())
    expect(mine.classes[0].lessons.find((l: { is_focus: boolean }) => l.is_focus)?.lesson_id).toBe('where-filters')

    // Fortschritt mit 3 Fehlversuchen -> Dashboard "stuck", letzte Abfrage sichtbar
    const now = Math.floor(Date.now() / 1000)
    await as(student, () => api.apiPutProgress([{ lesson_id: 'where-filters', step: 2, done: false, attempts: 3, updated_at: now }] as never, [{ lesson_id: 'where-filters', step: 2, query: 'SELECT yeer FROM books', error_msg: 'Spalte fehlt' }] as never))
    const dash = await as(teacher, () => api.apiTeacherDashboard(cls.id))
    expect(dash.students[0].status).toBe('stuck')
    expect(dash.students[0].total_steps).toBeGreaterThan(0)
    const matrix = await as(teacher, () => api.apiTeacherMatrix(cls.id))
    expect(matrix.rows[0].cells.length).toBe(matrix.lesson_ids.length)
    const la = await as(teacher, () => api.apiTeacherLastAttempt(cls.id, dash.students[0].user_id))
    expect(la.last_attempt?.query).toBe('SELECT yeer FROM books')

    // Quiz-Editor (D8): leeren Satz anlegen, Frage anhängen, ändern, löschen
    const set = await as(teacher, () => qapi.apiQuizCreate('Mein Satz'))
    expect(set.quiz.id).toBeGreaterThan(0)
    const q1 = await as(teacher, () => qapi.apiQuizAddQuestion(set.quiz.id, { question: 'Was filtert WHERE?', code: null, options: ['Zeilen', 'Spalten', 'Tabellen', 'Gruppen'], correct_index: 0, time_limit: 20, points: 1000 }))
    expect(q1.question.correct_index).toBe(0)
    const q1b = await as(teacher, () => qapi.apiQuizUpdateQuestion(set.quiz.id, q1.question.id, { correct_index: 0, question: 'Was filtert WHERE genau?' }))
    expect(q1b.question.question).toBe('Was filtert WHERE genau?')
    const q2 = await as(teacher, () => qapi.apiQuizAddQuestion(set.quiz.id, { question: 'Weg damit', code: null, options: ['a', 'b'], correct_index: 1, time_limit: 10, points: 1000 }))
    await as(teacher, () => qapi.apiQuizDeleteQuestion(set.quiz.id, q2.question.id))
    const detail = await as(teacher, () => qapi.apiQuizGet(set.quiz.id))
    expect(detail.quiz.questions.length).toBe(1)
    const list = await as(teacher, () => qapi.apiQuizList())
    expect(list.quizzes.find((x) => x.id === set.quiz.id)?.question_count).toBe(1)

    // Quiz starten (eigener Satz und aus der Bank), beenden, Auswertung
    const s1 = await as(teacher, () => qapi.apiQuizStart(set.quiz.id, { class_id: cls.id }))
    expect(s1.session_id).toBeGreaterThan(0)
    expect(s1.pin).toMatch(/^[A-Z2-9]{6}$/)
    const bank = await as(teacher, () => qapi.apiQuizBankList())
    expect(bank.length).toBeGreaterThanOrEqual(10)
    const s2 = await as(teacher, () => qapi.apiQuizStartFromBank(bank[0].lesson_id))
    expect(s2.session_id).toBeGreaterThan(0)
    await as(teacher, () => qapi.apiQuizEnd(s1.session_id))
    const res = await as(teacher, () => qapi.apiQuizResults(s1.session_id))
    expect(res.result.quiz_title).toBe('Mein Satz')
    expect(Array.isArray(res.result.participants)).toBe(true)

    // Passwort ändern, E-Mail bestätigen (Link aus der echten Mail), Abmelden
    await as(student, () => api.apiChangePassword('geheimnis123', 'neuesGeheimnis456'))
    const token = mail.sent.find((m) => m.to === 'v@schule.de')!.text.match(/token=([a-f0-9]{64})/)![1]
    await as(makeBrowser(), () => api.apiVerifyEmail(token))
    const me2 = await as(teacher, () => api.apiMe())
    expect(typeof me2.user.email_verified_at).toBe('number')
    await as(teacher, () => api.apiLogout())
    await expect(as(teacher, () => api.apiMe())).rejects.toThrow()
  }, 60_000)

  it('fremder Origin wird abgelehnt (CSRF), auch für Client-Aufrufe', async () => {
    const evil = async (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      headers.set('origin', 'https://evil.example')
      return nativeFetch(base + input, { ...init, headers })
    }
    await expect(as(evil as never, () => api.apiLogin('vlehrer', 'geheimnis123'))).rejects.toMatchObject({ status: 403 })
  })
})
