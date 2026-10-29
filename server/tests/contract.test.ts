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
  it('Lehrkraft, Klassen-Login, Fortschritt, Dashboard, Lektionen, Quiz-Editor, Quiz-Start, Auswertung, Schlüssel', async () => {
    const teacher = makeBrowser()
    const student = makeBrowser()
    const C = await import('../../src/lib/tabula/crypto.ts')
    C.__setTestKdfScale(16)

    // Lehrkraft registriert sich: Schlüsselpaar entsteht im "Browser", Code bleibt dort
    const recoveryCode = C.generateRecoveryCode()
    const keys = await C.createTeacherKeys('geheimnis123', recoveryCode)
    await as(teacher, () => api.apiRegister({ display_name: 'Frau V', name: 'Vera V', email: 'V@Schule.de', password: 'geheimnis123', terms_accepted: true, keys: keys.bundle }))
    const me = await as(teacher, () => api.apiMe())
    expect(me.user.role).toBe('teacher')
    if (me.user.role !== 'teacher') throw new Error('Lehrkraft erwartet')
    expect(me.user.email).toBe('v@schule.de')
    expect(me.user.email_verified_at).toBeNull()
    expect(me.user.keys.public_key).toBe(keys.bundle.public_key)
    // Anmelden mit anderer Schreibweise der E-Mail, Schlüssel lässt sich mit dem Passwort öffnen
    await as(teacher, () => api.apiLogin('v@SCHULE.de', 'geheimnis123'))
    const priv = await C.unlockTeacherKey('geheimnis123', me.user.keys.wrapped_by_password!)

    // Klasse anlegen, Schüler tritt über den Klassen-Login bei
    const created = await as(teacher, () => api.apiTeacherCreateClass('10v'))
    const cls = created.class
    expect(cls.join_code).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/)
    const info = await as(student, () => api.apiClassLookup(cls.join_code))
    expect(info.class_name).toBe('10v')
    expect(info.teacher_name).toBe('Frau V')
    const skey = await C.deriveStudentKey(info.class_salt, 'Sam Müller', 'schuelerPw1')
    const enc = await C.sealForTeacher(await C.importPublicKey(info.public_key), 'Sam Müller')
    const joined = await as(student, () => api.apiClassJoin(cls.join_code, skey, enc))
    expect(joined.class_name).toBe('10v')
    const sme = await as(student, () => api.apiMe())
    expect(sme.user.role).toBe('student')
    if (sme.user.role !== 'student') throw new Error('Schüler erwartet')
    expect(sme.user.class?.public_key).toBe(info.public_key)
    expect(JSON.stringify(sme.user)).not.toContain('Sam')

    // Anmelden an einem anderen PC
    const otherPc = makeBrowser()
    await as(otherPc, () => api.apiClassLogin(cls.join_code, skey))
    expect((await as(otherPc, () => api.apiMe())).user.role).toBe('student')

    // Lektionen: setzen und wieder lesen (D4)
    await as(teacher, () => api.apiTeacherPutLessons(cls.id, [{ lesson_id: 'where-filters', unlocked: true, sort_order: 0, is_focus: true }]))
    const lessons = await as(teacher, () => api.apiTeacherGetLessons(cls.id))
    expect(lessons.lessons).toEqual([{ lesson_id: 'where-filters', unlocked: true, sort_order: 0, is_focus: true }])

    // Schüler sieht Fokus
    const mine = await as(student, () => api.apiGetClasses())
    expect(mine.classes[0].lessons.find((l: { is_focus: boolean }) => l.is_focus)?.lesson_id).toBe('where-filters')

    // Fortschritt mit 3 Fehlversuchen -> Dashboard "stuck", letzte Abfrage nur für die Lehrkraft lesbar
    const now = Math.floor(Date.now() / 1000)
    const sealed = await C.sealForTeacher(await C.importPublicKey(info.public_key), JSON.stringify({ q: 'SELECT yeer FROM books', e: 'Spalte fehlt' }))
    await as(student, () => api.apiPutProgress([{ lesson_id: 'where-filters', step: 2, done: false, attempts: 3, updated_at: now }], [{ lesson_id: 'where-filters', step: 2, sealed, has_error: true }]))
    const dash = await as(teacher, () => api.apiTeacherDashboard(cls.id))
    expect(dash.students[0].status).toBe('stuck')
    expect(dash.students[0].total_steps).toBeGreaterThan(0)
    expect(await C.openForTeacher(priv, dash.students[0].enc_name!)).toBe('Sam Müller')
    const matrix = await as(teacher, () => api.apiTeacherMatrix(cls.id))
    expect(matrix.rows[0].cells.length).toBe(matrix.lesson_ids.length)
    expect(await C.openForTeacher(priv, matrix.rows[0].enc_name!)).toBe('Sam Müller')
    const studs = await as(teacher, () => api.apiTeacherGetStudents(cls.id))
    expect(await C.openForTeacher(priv, studs.students[0].enc_name!)).toBe('Sam Müller')
    const la = await as(teacher, () => api.apiTeacherLastAttempt(cls.id, dash.students[0].user_id))
    expect(JSON.parse((await C.openForTeacher(priv, la.last_attempt!.sealed))!).q).toBe('SELECT yeer FROM books')

    // Passwort vergessen beim Schüler: Einmal-Code der Lehrkraft
    const rc = await as(teacher, () => api.apiTeacherResetCode(cls.id, dash.students[0].user_id))
    const skey2 = await C.deriveStudentKey(info.class_salt, 'Sam Müller', 'neuesPw2026')
    await as(student, () => api.apiClassReset(cls.join_code, rc.code, skey2, enc))
    // Name ändern
    const skey3 = await C.deriveStudentKey(info.class_salt, 'Samuel Müller', 'neuesPw2026')
    await as(student, () => api.apiStudentRekey(skey2, skey3, enc))

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

    // Quiz starten (eigener Satz und aus der Bank, beide mit Klasse), beenden, Auswertung
    const s1 = await as(teacher, () => qapi.apiQuizStart(set.quiz.id, { class_id: cls.id }))
    expect(s1.session_id).toBeGreaterThan(0)
    expect(s1.pin).toMatch(/^[A-Z2-9]{6}$/)
    const bank = await as(teacher, () => qapi.apiQuizBankList())
    expect(bank.length).toBeGreaterThanOrEqual(10)
    const s2 = await as(teacher, () => qapi.apiQuizStartFromBank(bank[0].lesson_id, { class_id: cls.id }))
    expect(s2.session_id).toBeGreaterThan(0)
    await as(teacher, () => qapi.apiQuizEnd(s1.session_id))
    const res = await as(teacher, () => qapi.apiQuizResults(s1.session_id))
    expect(res.result.quiz_title).toBe('Mein Satz')
    expect(Array.isArray(res.result.participants)).toBe(true)

    // Lehrkraft: Passwort ändern ohne neu verpackten Schlüssel wird abgelehnt (400)
    await expect(as(teacher, () => api.apiChangePassword('geheimnis123', 'neuesGeheimnis456', ''))).rejects.toMatchObject({ status: 400 })
    // mit neu verpacktem Schlüssel klappt es, Namen bleiben lesbar
    const pk = await C.unwrapWithSecret('geheimnis123', me.user.keys.wrapped_by_password!)
    const rewrapped = await C.wrapWithSecret('neuesGeheimnis456', pk)
    await as(teacher, () => api.apiChangePassword('geheimnis123', 'neuesGeheimnis456', rewrapped))
    const me3 = await as(teacher, () => api.apiMe())
    if (me3.user.role !== 'teacher') throw new Error('Lehrkraft erwartet')
    const priv2 = await C.unlockTeacherKey('neuesGeheimnis456', me3.user.keys.wrapped_by_password!)
    const studs2 = await as(teacher, () => api.apiTeacherGetStudents(cls.id))
    expect(await C.openForTeacher(priv2, studs2.students[0].enc_name!)).toBe('Sam Müller')

    // Schlüssel setzen außerhalb der Wiederherstellung (z. B. neuer Wiederherstellungscode):
    // ungültige Daten 400, ohne Passwort 403, mit Passwort ok, gleiches Paar
    if (me3.user.role !== 'teacher') throw new Error('Lehrkraft erwartet')
    const tk = me3.user.keys
    await expect(as(teacher, () => api.apiSetKeys({ public_key: tk.public_key!, wrapped_by_password: '', wrapped_by_recovery: '' }))).rejects.toMatchObject({ status: 400 })
    await expect(as(teacher, () => api.apiSetKeys({ public_key: tk.public_key!, wrapped_by_password: rewrapped, wrapped_by_recovery: tk.wrapped_by_recovery! }))).rejects.toMatchObject({ status: 403 })
    const ok = await as(teacher, () => api.apiSetKeys({ public_key: tk.public_key!, wrapped_by_password: rewrapped, wrapped_by_recovery: tk.wrapped_by_recovery! }, 'neuesGeheimnis456'))
    expect(ok.new_pair).toBe(false)
    // Code öffnet den Schlüssel weiterhin
    expect((await C.unwrapWithSecret(C.normalizeRecoveryCode(recoveryCode), tk.wrapped_by_recovery!)).length).toBeGreaterThan(1000)

    // E-Mail bestätigen (Link aus der echten Mail), Schüler tritt aus, Abmelden
    const token = mail.sent.find((m) => m.to === 'v@schule.de')!.text.match(/token=([a-f0-9]{64})/)![1]
    await as(makeBrowser(), () => api.apiVerifyEmail(token))
    const me2 = await as(teacher, () => api.apiMe())
    expect(typeof (me2.user as { email_verified_at: number | null }).email_verified_at).toBe('number')
    await as(student, () => api.apiStudentLeave())
    expect((await as(teacher, () => api.apiTeacherGetStudents(cls.id))).students).toHaveLength(0)
    await as(teacher, () => api.apiLogout())
    await expect(as(teacher, () => api.apiMe())).rejects.toThrow()
  }, 60_000)

  it('fremder Origin wird abgelehnt (CSRF), auch für Client-Aufrufe', async () => {
    const evil = async (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      headers.set('origin', 'https://evil.example')
      return nativeFetch(base + input, { ...init, headers })
    }
    await expect(as(evil as never, () => api.apiLogin('v@schule.de', 'geheimnis123'))).rejects.toMatchObject({ status: 403 })
  })
})
