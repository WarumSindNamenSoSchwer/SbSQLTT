/**
 * Klassen-Login (docs/KLASSEN-LOGIN.md, K1): Ende-zu-Ende mit der echten Browser-Kryptografie
 * (src/lib/tabula/crypto.ts) gegen den echten Server.
 *
 * Kernaussage: Der Server bekommt und speichert nie Namen oder Passwörter von Schülern.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import type { Db } from '../src/db.js'
import {
  C, testDb, registerTeacher, createClass, joinStudent, loginStudent, lookup, cookieOf, studentId,
  type TestTeacher,
} from './helpers.js'

let db: Db
let app: FastifyInstance
let teacher: TestTeacher
let cls: { id: number; code: string }
const logLines: string[] = []
const NAME = 'Lena Schröder'
const PW = 'meinGeheimesPw9'

beforeEach(async () => {
  db = testDb()
  logLines.length = 0
  app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true, logStream: { write: (m) => { logLines.push(m) } } })
  await app.ready()
  teacher = await registerTeacher(app)
  cls = await createClass(app, teacher.cookie, '10b Informatik')
})
afterEach(async () => { await app.close(); db.close() })

/** Alles, was der Server je gesehen oder gespeichert hat: alle Tabellen, alle Zeilen, als Text */
function wholeDatabase(): string {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name)
  return tables.map((t) => JSON.stringify(db.prepare(`SELECT * FROM "${t}"`).all())).join('\n')
}

describe('Klassencode', () => {
  it('besteht aus Wörtern und einer Zahl', () => {
    expect(cls.code).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/)
  })
  it('Nachschlagen liefert Klasse, Lehrkraft, Salz und öffentlichen Schlüssel, unabhängig von Schreibweise', async () => {
    const info = await lookup(app, '  ' + cls.code.toUpperCase().replace(/-/g, ' ') + ' ')
    expect(info.class_name).toBe('10b Informatik')
    expect(info.teacher_name).toBe('Frau Mustermann')
    expect(info.class_salt).toMatch(/^[0-9a-f]{32}$/)
    expect(info.public_key.length).toBeGreaterThan(300)
  })
  it('unbekannter Code: 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/class-login/lookup?code=gibt-es-nicht-11' })
    expect(res.statusCode).toBe(404)
  })
})

describe('Beitritt und Anmeldung', () => {
  it('Beitritt, Abmelden, Anmelden an einem anderen PC: gleicher Schüler, Klasse bleibt', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    expect(j.res.statusCode).toBe(201)
    const id = await studentId(db, j.key)

    await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie: j.cookie } })
    // "anderer PC": Name mit anderer Groß-/Kleinschreibung und Leerzeichen
    const l = await loginStudent(app, cls.code, '  lena   SCHRÖDER ', PW)
    expect(l.res.statusCode).toBe(200)
    expect(await studentId(db, l.key)).toBe(id)

    const me = JSON.parse((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: l.cookie } })).body).user
    expect(me.role).toBe('student')
    expect(me.class.name).toBe('10b Informatik')
    expect(me.class.teacher_name).toBe('Frau Mustermann')
    expect(JSON.stringify(me)).not.toContain('Lena')
  })

  it('falsches Passwort oder falscher Name: 401 mit gleicher Meldung', async () => {
    await joinStudent(app, cls.code, NAME, PW)
    const a = await loginStudent(app, cls.code, NAME, 'falschesPw123')
    const b = await loginStudent(app, cls.code, 'Lena Schroeder', PW)
    expect(a.res.statusCode).toBe(401)
    expect(b.res.statusCode).toBe(401)
    expect(JSON.parse(a.res.body).fehler).toBe(JSON.parse(b.res.body).fehler)
  })

  it('gleicher Name mit anderem Passwort ist ein anderer Schüler, gleicher Name und Passwort wird abgelehnt', async () => {
    expect((await joinStudent(app, cls.code, 'Max', 'passwortEins1')).res.statusCode).toBe(201)
    expect((await joinStudent(app, cls.code, 'Max', 'passwortZwei2')).res.statusCode).toBe(201)
    const dup = await joinStudent(app, cls.code, 'max', 'passwortEins1')
    expect(dup.res.statusCode).toBe(409)
    expect(JSON.parse(dup.res.body).fehler).toBe('Bitte wähle ein anderes Passwort.')
  })

  it('Login gilt nur in der eigenen Klasse', async () => {
    await joinStudent(app, cls.code, NAME, PW)
    const other = await createClass(app, teacher.cookie, 'Andere Klasse')
    expect((await loginStudent(app, other.code, NAME, PW)).res.statusCode).toBe(401)
  })

  it('neuer Klassencode: Schüler meldet sich mit dem neuen Code an, alter Code geht nicht mehr', async () => {
    await joinStudent(app, cls.code, NAME, PW)
    const res = await app.inject({ method: 'POST', url: `/api/teacher/classes/${cls.id}/code`, headers: { cookie: teacher.cookie } })
    const newCode = JSON.parse(res.body).join_code
    expect((await loginStudent(app, newCode, NAME, PW)).res.statusCode).toBe(200)
    const old = await app.inject({ method: 'GET', url: `/api/class-login/lookup?code=${cls.code}` })
    expect(old.statusCode).toBe(404)
  })

  it('Fehlversuche je Klasse werden gebremst (429), ohne IP', async () => {
    await joinStudent(app, cls.code, NAME, PW)
    const info = await lookup(app, cls.code)
    let last = 0
    for (let i = 0; i < 61; i++) {
      const res = await app.inject({
        method: 'POST', url: '/api/class-login/login', headers: { 'content-type': 'application/json' },
        payload: { code: cls.code, key: i.toString(16).padStart(64, '0') },
      })
      last = res.statusCode
    }
    expect(last).toBe(429)
    // Auch der richtige Schlüssel wird jetzt gebremst
    const key = await C.deriveStudentKey(info.class_salt, NAME, PW)
    const res = await app.inject({ method: 'POST', url: '/api/class-login/login', headers: { 'content-type': 'application/json' }, payload: { code: cls.code, key } })
    expect(res.statusCode).toBe(429)
  })
})

describe('K1: Der Server sieht nie Name oder Passwort', () => {
  it('weder in der Datenbank noch im Protokoll, auch nicht in Kleinbuchstaben', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    await loginStudent(app, cls.code, NAME, PW)
    // Fortschritt mit verschlüsselter letzter Abfrage
    const pub = await C.importPublicKey(j.info.public_key)
    const sealed = await C.sealForTeacher(pub, JSON.stringify({ q: 'SELECT name FROM schueler', e: 'no such column' }))
    const put = await app.inject({
      method: 'PUT', url: '/api/progress', headers: { 'content-type': 'application/json', cookie: j.cookie },
      payload: { progress: [{ lesson_id: 'select-basics', step: 2, done: false, attempts: 3, updated_at: 1 }], last_attempts: [{ lesson_id: 'select-basics', step: 2, sealed, has_error: true }] },
    })
    expect(put.statusCode).toBe(200)

    const everything = wholeDatabase() + '\n' + logLines.join('\n')
    for (const secret of [NAME, NAME.toLowerCase(), 'Lena', 'Schröder', PW, 'SELECT name FROM schueler', 'no such column', j.key]) {
      expect(everything, secret).not.toContain(secret)
    }
  })

  it('der Schüler-Datensatz enthält nur Nummer, Prüfwert, verschlüsselten Namen und Zeiten', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const row = db.prepare("SELECT * FROM users WHERE role = 'student'").get() as Record<string, unknown>
    expect(row.email).toBeNull()
    expect(row.name).toBeNull()
    expect(row.school).toBeNull()
    expect(row.display_name).toBe('')
    expect(row.password_hash).toBe('')
    expect(String(row.username)).toMatch(/^s_[0-9a-f]{24}$/)
    expect(String(row.login_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(row.login_hash).not.toBe(j.key)
    expect(String(row.enc_name)).toMatch(/^h1\./)
  })
})

describe('Lehrkraft liest Namen und letzte Abfrage', () => {
  it('Dashboard, Schülerliste und letzte Abfrage: nur verschlüsselt, die Lehrkraft entschlüsselt', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const pub = await C.importPublicKey(j.info.public_key)
    const sealed = await C.sealForTeacher(pub, JSON.stringify({ q: 'SELECT * FROM kurs', e: '' }))
    await app.inject({
      method: 'PUT', url: '/api/progress', headers: { 'content-type': 'application/json', cookie: j.cookie },
      payload: { progress: [], last_attempts: [{ lesson_id: 'select-basics', step: 1, sealed, has_error: false }] },
    })
    const students = JSON.parse((await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/students`, headers: { cookie: teacher.cookie } })).body).students
    expect(students).toHaveLength(1)
    expect(students[0].display_name).toBeUndefined()
    expect(await C.openForTeacher(teacher.privateKey, students[0].enc_name)).toBe(NAME)

    const la = JSON.parse((await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/students/${students[0].id}/last-attempt`, headers: { cookie: teacher.cookie } })).body)
    expect(la.last_attempts[0].query).toBeUndefined()
    expect(JSON.parse((await C.openForTeacher(teacher.privateKey, la.last_attempts[0].sealed))!)).toEqual({ q: 'SELECT * FROM kurs', e: '' })
  })

  it('eine andere Lehrkraft kann den Namen nicht entschlüsseln', async () => {
    await joinStudent(app, cls.code, NAME, PW)
    const other = await registerTeacher(app, 'andere@schule.de')
    const enc = (db.prepare("SELECT enc_name FROM users WHERE role = 'student'").get() as { enc_name: string }).enc_name
    expect(await C.openForTeacher(other.privateKey, enc)).toBeNull()
  })

  it('hängt fest: Server erkennt es am Fehler-Kennzeichen ohne die Abfrage zu kennen', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    await app.inject({ method: 'PUT', url: `/api/teacher/classes/${cls.id}/lessons`, headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      payload: { lessons: [{ lesson_id: 'select-basics', unlocked: true, sort_order: 0, is_focus: true }] } })
    await app.inject({ method: 'PUT', url: '/api/progress', headers: { 'content-type': 'application/json', cookie: j.cookie },
      payload: { progress: [{ lesson_id: 'select-basics', step: 1, done: false, attempts: 1, updated_at: 1 }], last_attempts: [{ lesson_id: 'select-basics', step: 1, sealed: '', has_error: true }] } })
    db.prepare('UPDATE last_attempt SET updated_at = updated_at - 600').run()
    const dash = JSON.parse((await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/dashboard`, headers: { cookie: teacher.cookie } })).body)
    expect(dash.students[0].status).toBe('haengt_fest')
  })
})

describe('Name oder Passwort ändern, austreten', () => {
  it('Passwort ändern: alter Login geht nicht mehr, neuer schon, Fortschritt bleibt', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const id = await studentId(db, j.key)
    db.prepare("INSERT INTO progress (user_id, lesson_id, step, done, attempts) VALUES (?, 'select-basics', 1, 1, 1)").run(id)
    const newKey = await C.deriveStudentKey(j.info.class_salt, NAME, 'neuesPasswort7')
    const enc_name = await C.sealForTeacher(await C.importPublicKey(j.info.public_key), NAME)
    const res = await app.inject({ method: 'POST', url: '/api/student/rekey', headers: { 'content-type': 'application/json', cookie: j.cookie }, payload: { old_key: j.key, new_key: newKey, enc_name } })
    expect(res.statusCode).toBe(200)
    expect((await loginStudent(app, cls.code, NAME, PW)).res.statusCode).toBe(401)
    const l = await loginStudent(app, cls.code, NAME, 'neuesPasswort7')
    expect(await studentId(db, l.key)).toBe(id)
    expect(db.prepare('SELECT COUNT(*) n FROM progress WHERE user_id = ?').get(id)).toEqual({ n: 1 })
  })

  it('Name ändern: Lehrkraft sieht den neuen Namen, Login mit neuem Namen', async () => {
    const j = await joinStudent(app, cls.code, 'Lenna', PW)
    const newKey = await C.deriveStudentKey(j.info.class_salt, NAME, PW)
    const enc_name = await C.sealForTeacher(await C.importPublicKey(j.info.public_key), NAME)
    expect((await app.inject({ method: 'POST', url: '/api/student/rekey', headers: { 'content-type': 'application/json', cookie: j.cookie }, payload: { old_key: j.key, new_key: newKey, enc_name } })).statusCode).toBe(200)
    expect((await loginStudent(app, cls.code, NAME, PW)).res.statusCode).toBe(200)
    const enc = (db.prepare("SELECT enc_name FROM users WHERE role = 'student'").get() as { enc_name: string }).enc_name
    expect(await C.openForTeacher(teacher.privateKey, enc)).toBe(NAME)
  })

  it('falsches altes Passwort: 403', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const wrong = await C.deriveStudentKey(j.info.class_salt, NAME, 'falsch12345')
    const res = await app.inject({ method: 'POST', url: '/api/student/rekey', headers: { 'content-type': 'application/json', cookie: j.cookie }, payload: { old_key: wrong, new_key: wrong, enc_name: await C.sealForTeacher(await C.importPublicKey(j.info.public_key), NAME) } })
    expect(res.statusCode).toBe(403)
  })

  it('K8: Austreten löscht den Schüler mit allen Daten', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const id = await studentId(db, j.key)
    db.prepare("INSERT INTO progress (user_id, lesson_id, step, done, attempts) VALUES (?, 'x', 1, 1, 1)").run(id)
    expect((await app.inject({ method: 'POST', url: '/api/student/leave', headers: { cookie: j.cookie } })).statusCode).toBe(200)
    for (const t of ['users', 'memberships', 'progress', 'last_attempt', 'sessions']) {
      const col = t === 'users' ? 'id' : 'user_id'
      expect(db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${col} = ?`).get(id), t).toEqual({ n: 0 })
    }
  })
})

describe('Passwort vergessen: Einmal-Code der Lehrkraft', () => {
  it('Code setzt neues Passwort, Fortschritt bleibt, Code nur einmal gültig', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const id = await studentId(db, j.key)
    db.prepare("INSERT INTO progress (user_id, lesson_id, step, done, attempts) VALUES (?, 'x', 1, 1, 1)").run(id)
    const rc = JSON.parse((await app.inject({ method: 'POST', url: `/api/teacher/classes/${cls.id}/students/${id}/reset-code`, headers: { cookie: teacher.cookie } })).body)
    expect(rc.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/)
    expect(JSON.stringify(db.prepare('SELECT * FROM student_reset_codes').all())).not.toContain(rc.code)

    const key = await C.deriveStudentKey(j.info.class_salt, NAME, 'ganzNeu2026')
    const enc_name = await C.sealForTeacher(await C.importPublicKey(j.info.public_key), NAME)
    const res = await app.inject({ method: 'POST', url: '/api/class-login/reset', headers: { 'content-type': 'application/json' }, payload: { code: cls.code, reset_code: rc.code.toLowerCase(), key, enc_name } })
    expect(res.statusCode).toBe(200)
    expect(await studentId(db, (await loginStudent(app, cls.code, NAME, 'ganzNeu2026')).key)).toBe(id)
    expect(db.prepare('SELECT COUNT(*) n FROM progress WHERE user_id = ?').get(id)).toEqual({ n: 1 })
    // zweites Mal: ungültig
    const again = await app.inject({ method: 'POST', url: '/api/class-login/reset', headers: { 'content-type': 'application/json' }, payload: { code: cls.code, reset_code: rc.code, key, enc_name } })
    expect(again.statusCode).toBe(400)
  })

  it('abgelaufener Code (15 Minuten) wird abgelehnt', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const id = await studentId(db, j.key)
    const rc = JSON.parse((await app.inject({ method: 'POST', url: `/api/teacher/classes/${cls.id}/students/${id}/reset-code`, headers: { cookie: teacher.cookie } })).body)
    db.prepare('UPDATE student_reset_codes SET expires_at = expires_at - 901').run()
    const key = await C.deriveStudentKey(j.info.class_salt, NAME, 'ganzNeu2026')
    const res = await app.inject({ method: 'POST', url: '/api/class-login/reset', headers: { 'content-type': 'application/json' }, payload: { code: cls.code, reset_code: rc.code, key, enc_name: await C.sealForTeacher(await C.importPublicKey(j.info.public_key), NAME) } })
    expect(res.statusCode).toBe(400)
  })

  it('fremde Lehrkraft kann keinen Code erzeugen (404)', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const other = await registerTeacher(app, 'b@schule.de')
    const res = await app.inject({ method: 'POST', url: `/api/teacher/classes/${cls.id}/students/${await studentId(db, j.key)}/reset-code`, headers: { cookie: other.cookie } })
    expect(res.statusCode).toBe(404)
  })
})

describe('Lehrkraft: Schlüssel und Passwort', () => {
  it('Passwort ändern: privater Schlüssel neu verpackt, alte Namen bleiben lesbar', async () => {
    await joinStudent(app, cls.code, NAME, PW)
    const me = JSON.parse((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: teacher.cookie } })).body).user
    const pk = await C.unwrapWithSecret(teacher.password, me.keys.wrapped_by_password)
    const rewrapped = await C.wrapWithSecret('neuesLehrerPw1', pk)
    const res = await app.inject({ method: 'POST', url: '/api/me/password', headers: { 'content-type': 'application/json', cookie: teacher.cookie }, payload: { current_password: teacher.password, new_password: 'neuesLehrerPw1', wrapped_by_password: rewrapped } })
    expect(res.statusCode).toBe(200)
    const me2 = JSON.parse((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: teacher.cookie } })).body).user
    const key = await C.unlockTeacherKey('neuesLehrerPw1', me2.keys.wrapped_by_password)
    const enc = (db.prepare("SELECT enc_name FROM users WHERE role = 'student'").get() as { enc_name: string }).enc_name
    expect(await C.openForTeacher(key, enc)).toBe(NAME)
  })

  it('Passwort vergessen + Wiederherstellungscode: Namen sofort wieder lesbar', async () => {
    await joinStudent(app, cls.code, NAME, PW)
    const me = JSON.parse((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: teacher.cookie } })).body).user
    // Browser: mit Code entpacken, mit neuem Passwort neu verpacken
    const pk = await C.unwrapWithSecret(C.normalizeRecoveryCode(teacher.recoveryCode.toUpperCase().replace(/-/g, ' ')), me.keys.wrapped_by_recovery)
    const keys = { public_key: me.keys.public_key, wrapped_by_password: await C.wrapWithSecret('resetPw12345', pk), wrapped_by_recovery: me.keys.wrapped_by_recovery }
    const res = await app.inject({ method: 'POST', url: '/api/me/keys', headers: { 'content-type': 'application/json', cookie: teacher.cookie }, payload: { keys } })
    expect(JSON.parse(res.body)).toEqual({ ok: true, new_pair: false })
    const key = await C.unlockTeacherKey('resetPw12345', keys.wrapped_by_password)
    const enc = (db.prepare("SELECT enc_name FROM users WHERE role = 'student'").get() as { enc_name: string }).enc_name
    expect(await C.openForTeacher(key, enc)).toBe(NAME)
  })

  it('Passwort vergessen ohne Code: neues Schlüsselpaar, Namen kommen mit der nächsten Schüler-Anmeldung zurück', async () => {
    const j = await joinStudent(app, cls.code, NAME, PW)
    const fresh = await C.createTeacherKeys('resetPw12345', C.generateRecoveryCode())
    const res = await app.inject({ method: 'POST', url: '/api/me/keys', headers: { 'content-type': 'application/json', cookie: teacher.cookie }, payload: { keys: fresh.bundle } })
    expect(JSON.parse(res.body)).toEqual({ ok: true, new_pair: true })
    expect((db.prepare("SELECT enc_name FROM users WHERE role = 'student'").get() as { enc_name: string | null }).enc_name).toBeNull()
    // Schüler meldet sich an, Browser schreibt den Namen für den neuen Schlüssel
    const info = await lookup(app, cls.code)
    const enc_name = await C.sealForTeacher(await C.importPublicKey(info.public_key), NAME)
    const l = await app.inject({ method: 'POST', url: '/api/class-login/login', headers: { 'content-type': 'application/json' }, payload: { code: cls.code, key: j.key, enc_name } })
    expect(l.statusCode).toBe(200)
    const enc = (db.prepare("SELECT enc_name FROM users WHERE role = 'student'").get() as { enc_name: string }).enc_name
    expect(await C.openForTeacher(fresh.privateKey, enc)).toBe(NAME)
  })

  it('Wiederherstellungscode und Passwort erreichen den Server nie im Klartext', async () => {
    const all = wholeDatabase() + logLines.join('\n')
    expect(all).not.toContain(teacher.recoveryCode)
    expect(all).not.toContain(teacher.password)
  })
})

describe('Echte Parameter (wie im Browser)', () => {
  it('Argon2id 64 MiB, 3 Durchgänge, Ergebnis 32 Byte, ändert sich mit jedem Bestandteil', async () => {
    C.__setTestKdfScale(1)
    try {
      expect(C.STUDENT_KDF).toEqual({ memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 32 })
      const a = await C.deriveStudentKey('salz1', 'Lena', 'pw123456')
      expect(a).toMatch(/^[0-9a-f]{64}$/)
      expect(await C.deriveStudentKey('salz1', ' LENA ', 'pw123456')).toBe(a)
      expect(await C.deriveStudentKey('salz2', 'Lena', 'pw123456')).not.toBe(a)
      expect(await C.deriveStudentKey('salz1', 'Lea', 'pw123456')).not.toBe(a)
      expect(await C.deriveStudentKey('salz1', 'Lena', 'pw123457')).not.toBe(a)
    } finally {
      C.__setTestKdfScale(16)
    }
  })
})
