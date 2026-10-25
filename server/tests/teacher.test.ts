/**
 * P6 Lehrerbereich-API Tests
 *
 * Abgedeckt:
 * - Lehrkraft A sieht/aendert nichts von B (alle Endpunkte)
 * - Schueler kann keine /api/teacher-Endpunkte aufrufen
 * - Klasse loeschen entfernt alle Zeilen und Schueler (K8)
 * - Schueler entfernen loescht Fortschritt (K8)
 * - Einmal-Code durch Lehrkraft (K3)
 * - Hängt-fest-Regel (>= 3 Versuche oder Fehler > 5 min, has_error)
 * - Keine IP in DB (K10)
 * - GET /api/classes/mine fuer Schueler
 * - Dashboard-Endpunkt
 * - Matrix-Endpunkt
 * - Join-Code-Format (Wörter)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb, registerTeacher, createClass, joinStudent, C, type TestTeacher } from './helpers.js'
import type { Db } from '../src/db.js'
import { generateJoinCode } from '../src/routes/teacher.js'

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

interface SetupResult {
  db: Db
  app: FastifyInstance
  mail: InMemoryMailSender
}

async function setup(): Promise<SetupResult> {
  const db = testDb()
  const mail = new InMemoryMailSender()
  const app = await buildApp({ db, mail, skipCsrf: true })
  await app.ready()
  return { db, mail, app }
}

// ---------------------------------------------------------------------------
// Join-Code-Alphabet (Wort-Format)
// ---------------------------------------------------------------------------

describe('Join-Code-Format', () => {
  it('erzeugt Wort-Format mit drei Woertern und einer Zahl', () => {
    const code = generateJoinCode()
    // Format: wort-wort-wort-NN
    expect(code).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/)
  })

  it('enthaelt keine Grossbuchstaben im Code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode()
      expect(code).toMatch(/^[a-z-\d]+$/)
    }
  })
})

// ---------------------------------------------------------------------------
// Zugriffskontrolle: Schueler darf keine /api/teacher-Endpunkte aufrufen
// ---------------------------------------------------------------------------

describe('Zugriffskontrolle: Schueler', () => {
  it('Schueler erhaelt 403 bei GET /api/teacher/classes', async () => {
    const { app, db } = await setup()
    // Lehrkraft und Klasse anlegen, Schueler beitreten lassen
    const teacher = await registerTeacher(app, 'ctrl-lehrer@schule.de', 'sicheresPasswort1', 'Frau Ctrl')
    const cls = await createClass(app, teacher.cookie, 'CtrlKlasse')
    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler Ctrl', 'schuelerPw1')
    expect(jr.statusCode).toBe(201)

    const res = await app.inject({
      method: 'GET',
      url: '/api/teacher/classes',
      headers: { cookie: studentCookie },
    })
    expect(res.statusCode).toBe(403)

    await app.close()
    db.close()
  })

  it('Nicht angemeldeter Nutzer erhaelt 401', async () => {
    const { app, db } = await setup()

    const res = await app.inject({
      method: 'GET',
      url: '/api/teacher/classes',
    })
    expect(res.statusCode).toBe(401)

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Lehrkraft A sieht/aendert nichts von B
// ---------------------------------------------------------------------------

describe('Isolation: Lehrkraft A vs B', () => {
  it('Lehrkraft B sieht Klasse von A nicht (GET gibt 404)', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'iso-a@schule.de', 'sicheresPasswort1', 'Frau A')
    const teacherB = await registerTeacher(app, 'iso-b@schule.de', 'sicheresPasswort1', 'Frau B')
    const classIdA = await createClass(app, teacherA.cookie, 'Klasse von A')

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classIdA.id}`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })

  it('Lehrkraft B kann Klasse von A nicht loeschen', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'iso-c@schule.de', 'sicheresPasswort1', 'Frau C')
    const teacherB = await registerTeacher(app, 'iso-d@schule.de', 'sicheresPasswort1', 'Frau D')
    const classIdA = await createClass(app, teacherA.cookie, 'Klasse von C')

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/teacher/classes/${classIdA.id}`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    expect(db.prepare('SELECT id FROM classes WHERE id = ?').get(classIdA.id)).toBeTruthy()

    await app.close()
    db.close()
  })

  it('Lehrkraft B sieht keine Schueler aus Klasse von A', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'iso-e@schule.de', 'sicheresPasswort1', 'Frau E')
    const teacherB = await registerTeacher(app, 'iso-f@schule.de', 'sicheresPasswort1', 'Frau F')
    const classIdA = await createClass(app, teacherA.cookie, 'Klasse von E')

    await joinStudent(app, classIdA.code, 'Schueler X', 'passwortX1')

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classIdA.id}/students`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })

  it('Lehrkraft B sieht dashboard von A nicht', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'iso-g@schule.de', 'sicheresPasswort1', 'Frau G')
    const teacherB = await registerTeacher(app, 'iso-h@schule.de', 'sicheresPasswort1', 'Frau H')
    const classIdA = await createClass(app, teacherA.cookie, 'Klasse von G')

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classIdA.id}/dashboard`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })

  it('Lehrkraft B sieht matrix von A nicht', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'iso-i@schule.de', 'sicheresPasswort1', 'Frau I')
    const teacherB = await registerTeacher(app, 'iso-j@schule.de', 'sicheresPasswort1', 'Frau J')
    const classIdA = await createClass(app, teacherA.cookie, 'Klasse von I')

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classIdA.id}/matrix`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })

  it('Lehrkraft B kann last-attempt von Schueler in Klasse von A nicht sehen', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'iso-k@schule.de', 'sicheresPasswort1', 'Frau K')
    const teacherB = await registerTeacher(app, 'iso-l@schule.de', 'sicheresPasswort1', 'Frau L')
    const classIdA = await createClass(app, teacherA.cookie, 'Klasse von K')

    await joinStudent(app, classIdA.code, 'Schueler Y', 'passwortY1')

    const studentsRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classIdA.id}/students`,
      headers: { cookie: teacherA.cookie },
    })
    const students = JSON.parse(studentsRes.body).students as { id: number }[]
    expect(students.length).toBeGreaterThan(0)

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classIdA.id}/students/${students[0].id}/last-attempt`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })

  it('Lehrkraft B kann reset-code fuer Schueler von A nicht ausstellen', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'iso-m@schule.de', 'sicheresPasswort1', 'Frau M')
    const teacherB = await registerTeacher(app, 'iso-n@schule.de', 'sicheresPasswort1', 'Frau N')
    const classIdA = await createClass(app, teacherA.cookie, 'Klasse von M')

    await joinStudent(app, classIdA.code, 'Schueler Reset', 'passwortR1')

    const studentsRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classIdA.id}/students`,
      headers: { cookie: teacherA.cookie },
    })
    const students = JSON.parse(studentsRes.body).students as { id: number }[]

    const res = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${classIdA.id}/students/${students[0].id}/reset-code`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Klassen-CRUD
// ---------------------------------------------------------------------------

describe('Klassen-CRUD', () => {
  it('erstellt eine neue Klasse mit gueltigem Wort-Code', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-m@schule.de', 'sicheresPasswort1', 'Frau M')

    const res = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({ name: 'Meine Klasse' }),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.class.name).toBe('Meine Klasse')
    // Neues Format: wort-wort-wort-NN
    expect(body.class.join_code).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/)

    await app.close()
    db.close()
  })

  it('PATCH: Name der Klasse aendern', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-n@schule.de', 'sicheresPasswort1', 'Frau N')
    const cls = await createClass(app, teacher.cookie, 'Alt')

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/teacher/classes/${cls.id}`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({ name: 'Neu' }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).class.name).toBe('Neu')

    await app.close()
    db.close()
  })

  it('PATCH: Klasse archivieren', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-o@schule.de', 'sicheresPasswort1', 'Frau O')
    const cls = await createClass(app, teacher.cookie, 'Archivklasse')

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/teacher/classes/${cls.id}`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({ archived: true }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).class.archived).toBe(1)

    await app.close()
    db.close()
  })

  it('POST /code: neuer Join-Code wird erzeugt', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-p@schule.de', 'sicheresPasswort1', 'Frau P')
    const cls = await createClass(app, teacher.cookie, 'CodeKlasse')

    const res = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${cls.id}/code`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: '{}',
    })
    expect(res.statusCode).toBe(200)
    const newCode = JSON.parse(res.body).join_code
    expect(newCode).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/)

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// K8: Klasse loeschen entfernt alle Zeilen inkl. Schueler-Konten
// ---------------------------------------------------------------------------

describe('K8: Klasse loeschen', () => {
  it('loescht Klasse mit allen Mitgliedschaften, Fortschritt und Schueler-Konten', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-q@schule.de', 'sicheresPasswort1', 'Frau Q')
    const cls = await createClass(app, teacher.cookie, 'ZuLoeschKlasse')

    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler Z', 'passwortZ1')
    expect(jr.statusCode).toBe(201)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }
    expect(student).toBeTruthy()

    // Fortschritt eintragen
    await app.inject({
      method: 'PUT',
      url: '/api/progress',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({
        progress: [{ lesson_id: 'select-basics', step: 0, done: true, attempts: 2, updated_at: Math.floor(Date.now() / 1000) }],
        last_attempts: [{ lesson_id: 'select-basics', step: 0, sealed: '', has_error: false }],
      }),
    })

    // Klasse loeschen
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/teacher/classes/${cls.id}`,
      headers: { cookie: teacher.cookie },
    })
    expect(deleteRes.statusCode).toBe(200)

    // Alle Zeilen muessen weg sein (K8)
    expect(db.prepare('SELECT id FROM classes WHERE id = ?').get(cls.id)).toBeUndefined()
    expect(db.prepare('SELECT id FROM memberships WHERE class_id = ?').get(cls.id)).toBeUndefined()
    expect(db.prepare('SELECT id FROM lesson_settings WHERE class_id = ?').get(cls.id)).toBeUndefined()
    expect(db.prepare('SELECT id FROM progress WHERE user_id = ?').get(student.id)).toBeUndefined()
    expect(db.prepare('SELECT user_id FROM last_attempt WHERE user_id = ?').get(student.id)).toBeUndefined()
    // Schueler-Konto komplett weg (K8)
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(student.id)).toBeUndefined()

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// K8: Schueler entfernen loescht klassenbezogenen Fortschritt
// ---------------------------------------------------------------------------

describe('K8: Schueler aus Klasse entfernen', () => {
  it('loescht Mitgliedschaft und Fortschritt des Schuelers', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-r@schule.de', 'sicheresPasswort1', 'Frau R')
    const cls = await createClass(app, teacher.cookie, 'RemoveKlasse')

    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler W', 'passwortW1')
    expect(jr.statusCode).toBe(201)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    // Fortschritt eintragen
    await app.inject({
      method: 'PUT',
      url: '/api/progress',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({
        progress: [{ lesson_id: 'where-filters', step: 1, done: false, attempts: 5, updated_at: Math.floor(Date.now() / 1000) }],
        last_attempts: [{ lesson_id: 'where-filters', step: 1, sealed: '', has_error: true }],
      }),
    })

    expect(db.prepare('SELECT id FROM progress WHERE user_id = ?').get(student.id)).toBeTruthy()

    // Schueler entfernen
    const removeRes = await app.inject({
      method: 'DELETE',
      url: `/api/teacher/classes/${cls.id}/students/${student.id}`,
      headers: { cookie: teacher.cookie },
    })
    expect(removeRes.statusCode).toBe(200)

    // Mitgliedschaft weg
    expect(db.prepare('SELECT id FROM memberships WHERE class_id = ? AND user_id = ?').get(cls.id, student.id)).toBeUndefined()
    // Fortschritt weg (K8)
    expect(db.prepare('SELECT id FROM progress WHERE user_id = ?').get(student.id)).toBeUndefined()
    expect(db.prepare('SELECT user_id FROM last_attempt WHERE user_id = ?').get(student.id)).toBeUndefined()

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Einmal-Code durch Lehrkraft (K3, Nachfolger von password-reset)
// ---------------------------------------------------------------------------

describe('K3: Einmal-Code durch Lehrkraft', () => {
  it('Lehrkraft stellt Einmal-Code aus', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-s@schule.de', 'sicheresPasswort1', 'Frau S')
    const cls = await createClass(app, teacher.cookie, 'ResetKlasse')

    await joinStudent(app, cls.code, 'Schueler Reset', 'altesPasswort1')

    const studentsRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/students`,
      headers: { cookie: teacher.cookie },
    })
    const students = JSON.parse(studentsRes.body).students as { id: number }[]
    expect(students.length).toBeGreaterThan(0)
    const studentId = students[0].id

    // Einmal-Code ausstellen
    const resetRes = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${cls.id}/students/${studentId}/reset-code`,
      headers: { cookie: teacher.cookie },
    })
    expect(resetRes.statusCode).toBe(200)
    const body = JSON.parse(resetRes.body)
    expect(body.code).toBeTruthy()
    // Code: 8 Zeichen aus sicherem Alphabet
    expect(body.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/)

    await app.close()
    db.close()
  })

  it('Lehrkraft B kann Einmal-Code fuer Schueler von A nicht ausstellen', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'cls-t1@schule.de', 'sicheresPasswort1', 'Frau T1')
    const teacherB = await registerTeacher(app, 'cls-t2@schule.de', 'sicheresPasswort1', 'Frau T2')
    const cls = await createClass(app, teacherA.cookie, 'Klasse von T1')

    await joinStudent(app, cls.code, 'Schueler T', 'passwortT1')

    const studentsRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/students`,
      headers: { cookie: teacherA.cookie },
    })
    const students = JSON.parse(studentsRes.body).students as { id: number }[]

    const res = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${cls.id}/students/${students[0].id}/reset-code`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Hängt-fest-Regel
// ---------------------------------------------------------------------------

describe('Dashboard: Haengt-fest-Regel', () => {
  it('markiert Schueler als haengt_fest wenn >= 3 Versuche ohne Erfolg', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-u@schule.de', 'sicheresPasswort1', 'Frau U')
    const cls = await createClass(app, teacher.cookie, 'StuckKlasse')

    // Fokus-Lektion setzen
    await app.inject({
      method: 'PUT',
      url: `/api/teacher/classes/${cls.id}/lessons`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({
        lessons: [{ lesson_id: 'select-basics', unlocked: true, sort_order: 0, is_focus: true }],
      }),
    })

    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler Stuck', 'passwortS1')
    expect(jr.statusCode).toBe(201)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    // Fortschritt mit >= 3 Fehlversuchen (done=0, attempts=3)
    const nowTs = Math.floor(Date.now() / 1000)
    await app.inject({
      method: 'PUT',
      url: '/api/progress',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({
        progress: [{ lesson_id: 'select-basics', step: 0, done: false, attempts: 3, updated_at: nowTs }],
      }),
    })

    const dashRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/dashboard`,
      headers: { cookie: teacher.cookie },
    })
    expect(dashRes.statusCode).toBe(200)
    const body = JSON.parse(dashRes.body)
    const studentEntry = body.students.find((s: { user_id: number }) => s.user_id === student.id)
    expect(studentEntry).toBeTruthy()
    expect(studentEntry.status).toBe('haengt_fest')

    await app.close()
    db.close()
  })

  it('markiert Schueler als haengt_fest wenn Fehler (has_error) > 5 min zurueck', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-v@schule.de', 'sicheresPasswort1', 'Frau V')
    const cls = await createClass(app, teacher.cookie, 'StuckKlasse2')

    await app.inject({
      method: 'PUT',
      url: `/api/teacher/classes/${cls.id}/lessons`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({
        lessons: [{ lesson_id: 'where-filters', unlocked: true, sort_order: 0, is_focus: true }],
      }),
    })

    const { res: jr } = await joinStudent(app, cls.code, 'Schueler Stuck2', 'passwortS2')
    expect(jr.statusCode).toBe(201)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    // Fortschritt mit 1 Versuch (kein haengt_fest durch Versuche)
    const oldTs = Math.floor(Date.now() / 1000) - 400 // vor 6+ Minuten
    db.prepare(`
      INSERT INTO progress (user_id, lesson_id, step, done, attempts, updated_at)
      VALUES (?, 'where-filters', 0, 0, 1, ?)
    `).run(student.id, oldTs)

    // Last attempt mit has_error=1 vor > 5 min
    db.prepare(`
      INSERT INTO last_attempt (user_id, lesson_id, step, has_error, sealed, updated_at)
      VALUES (?, 'where-filters', 0, 1, '', ?)
    `).run(student.id, oldTs)

    const dashRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/dashboard`,
      headers: { cookie: teacher.cookie },
    })
    expect(dashRes.statusCode).toBe(200)
    const body = JSON.parse(dashRes.body)
    const studentEntry = body.students.find((s: { user_id: number }) => s.user_id === student.id)
    expect(studentEntry.status).toBe('haengt_fest')

    await app.close()
    db.close()
  })

  it('markiert Schueler als dran wenn Fortschritt vorhanden aber nicht fertig und nicht stuck', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-w@schule.de', 'sicheresPasswort1', 'Frau W')
    const cls = await createClass(app, teacher.cookie, 'DranKlasse')

    await app.inject({
      method: 'PUT',
      url: `/api/teacher/classes/${cls.id}/lessons`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({
        lessons: [{ lesson_id: 'select-columns', unlocked: true, sort_order: 0, is_focus: true }],
      }),
    })

    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler Dran', 'passwortD1')
    expect(jr.statusCode).toBe(201)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    const nowTs = Math.floor(Date.now() / 1000)
    await app.inject({
      method: 'PUT',
      url: '/api/progress',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({
        progress: [{ lesson_id: 'select-columns', step: 0, done: false, attempts: 1, updated_at: nowTs }],
      }),
    })

    const dashRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/dashboard`,
      headers: { cookie: teacher.cookie },
    })
    const body = JSON.parse(dashRes.body)
    const entry = body.students.find((s: { user_id: number }) => s.user_id === student.id)
    expect(entry.status).toBe('dran')

    await app.close()
    db.close()
  })

  it('markiert Schueler als fertig wenn alle Schritte done', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-x@schule.de', 'sicheresPasswort1', 'Frau X')
    const cls = await createClass(app, teacher.cookie, 'FertigKlasse')

    await app.inject({
      method: 'PUT',
      url: `/api/teacher/classes/${cls.id}/lessons`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({
        lessons: [{ lesson_id: 'aggregates', unlocked: true, sort_order: 0, is_focus: true }],
      }),
    })

    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler Fertig', 'passwortF1')
    expect(jr.statusCode).toBe(201)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    const nowTs = Math.floor(Date.now() / 1000)
    await app.inject({
      method: 'PUT',
      url: '/api/progress',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({
        progress: Array.from({ length: 12 }, (_, i) => ({
          lesson_id: 'aggregates', step: i, done: true, attempts: 1, updated_at: nowTs,
        })),
      }),
    })

    const dashRes = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/dashboard`,
      headers: { cookie: teacher.cookie },
    })
    const body = JSON.parse(dashRes.body)
    const entry = body.students.find((s: { user_id: number }) => s.user_id === student.id)
    expect(entry.status).toBe('fertig')

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Lektionseinstellungen
// ---------------------------------------------------------------------------

describe('Lektionseinstellungen', () => {
  it('PUT /lessons speichert Einstellungen und setzt Fokus-Lektion', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-y@schule.de', 'sicheresPasswort1', 'Frau Y')
    const cls = await createClass(app, teacher.cookie, 'LektionsKlasse')

    const res = await app.inject({
      method: 'PUT',
      url: `/api/teacher/classes/${cls.id}/lessons`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({
        lessons: [
          { lesson_id: 'select-basics', unlocked: true, sort_order: 0, is_focus: false },
          { lesson_id: 'where-filters', unlocked: true, sort_order: 1, is_focus: true },
          { lesson_id: 'order-limit', unlocked: false, sort_order: 2, is_focus: false },
        ],
      }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).focus_lesson).toBe('where-filters')

    const cls2 = db.prepare('SELECT focus_lesson FROM classes WHERE id = ?').get(cls.id) as { focus_lesson: string }
    expect(cls2.focus_lesson).toBe('where-filters')

    const settings = db.prepare('SELECT lesson_id, unlocked, is_focus FROM lesson_settings WHERE class_id = ? ORDER BY sort_order').all(cls.id) as { lesson_id: string; unlocked: number; is_focus: number }[]
    expect(settings).toHaveLength(3)
    expect(settings[0].lesson_id).toBe('select-basics')
    expect(settings[1].is_focus).toBe(1)
    expect(settings[2].unlocked).toBe(0)

    await app.close()
    db.close()
  })

  it('lehnt mehr als eine Fokus-Lektion ab', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-z@schule.de', 'sicheresPasswort1', 'Frau Z')
    const cls = await createClass(app, teacher.cookie, 'ZweiFokusKlasse')

    const res = await app.inject({
      method: 'PUT',
      url: `/api/teacher/classes/${cls.id}/lessons`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({
        lessons: [
          { lesson_id: 'select-basics', unlocked: true, sort_order: 0, is_focus: true },
          { lesson_id: 'where-filters', unlocked: true, sort_order: 1, is_focus: true },
        ],
      }),
    })
    expect(res.statusCode).toBe(400)

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// GET /api/classes/mine (Schueler per Klassen-Login)
// ---------------------------------------------------------------------------

describe('GET /api/classes/mine', () => {
  it('gibt eigene Klassen mit Fokus-Lektion und Lektionseinstellungen zurueck', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-aa@schule.de', 'sicheresPasswort1', 'Frau AA')
    const cls = await createClass(app, teacher.cookie, 'MeineSchuelerKlasse')

    // Lektionseinstellungen
    await app.inject({
      method: 'PUT',
      url: `/api/teacher/classes/${cls.id}/lessons`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({
        lessons: [
          { lesson_id: 'select-basics', unlocked: true, sort_order: 0, is_focus: true },
          { lesson_id: 'where-filters', unlocked: false, sort_order: 1, is_focus: false },
        ],
      }),
    })

    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler Mine', 'passwortM1')
    expect(jr.statusCode).toBe(201)

    const res = await app.inject({
      method: 'GET',
      url: '/api/classes/mine',
      headers: { cookie: studentCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.classes).toHaveLength(1)
    expect(body.classes[0].focus_lesson).toBe('select-basics')
    expect(body.classes[0].lessons).toHaveLength(2)
    expect(body.classes[0].lessons[1].unlocked).toBe(false)

    await app.close()
    db.close()
  })

  it('gibt leere Liste fuer Schueler ohne Klasse zurueck', async () => {
    // Schuelerkonto ohne Klasse: nicht mit Klassen-Login moeglich (immer mit Klasse).
    // Wir pruefen stattdessen eine Lehrkraft ohne Schueler-Rolle - oder einen
    // Schueler, der ausgetreten ist.
    // Hier: Lehrkraft ruft /api/classes/mine auf (gibt 403 oder leere Liste)
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-mine2@schule.de', 'sicheresPasswort1', 'Frau Mine2')

    const res = await app.inject({
      method: 'GET',
      url: '/api/classes/mine',
      headers: { cookie: teacher.cookie },
    })
    // Lehrkraft bekommt 403 oder leere Liste
    expect([200, 403]).toContain(res.statusCode)
    if (res.statusCode === 200) {
      expect(JSON.parse(res.body).classes).toHaveLength(0)
    }

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Matrix-Endpunkt
// ---------------------------------------------------------------------------

describe('Matrix-Endpunkt', () => {
  it('gibt korrekte Matrix fuer Schueler x Lektionen zurueck', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-bb@schule.de', 'sicheresPasswort1', 'Frau BB')
    const cls = await createClass(app, teacher.cookie, 'MatrixKlasse')

    const { res: jr, cookie: studentCookie } = await joinStudent(app, cls.code, 'Schueler Matrix', 'passwortMx1')
    expect(jr.statusCode).toBe(201)

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    const nowTs = Math.floor(Date.now() / 1000)
    await app.inject({
      method: 'PUT',
      url: '/api/progress',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({
        progress: [
          { lesson_id: 'joins', step: 0, done: true, attempts: 1, updated_at: nowTs },
          { lesson_id: 'joins', step: 1, done: false, attempts: 2, updated_at: nowTs },
        ],
      }),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/matrix`,
      headers: { cookie: teacher.cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.matrix['joins'][student.id]).toBe('begonnen')

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// K10: Keine IP in Datenbank
// ---------------------------------------------------------------------------

describe('K10: Keine IP in Klassen-Tabellen', () => {
  it('speichert keine IP in classes-Tabelle', async () => {
    const { app, db } = await setup()

    const tableInfo = db.prepare('PRAGMA table_info(classes)').all() as { name: string }[]
    const columns = tableInfo.map(c => c.name)
    expect(columns.find(c => c.toLowerCase().includes('ip'))).toBeUndefined()
    expect(columns.find(c => c.toLowerCase().includes('address'))).toBeUndefined()

    await app.close()
    db.close()
  })

  it('speichert keine IP in memberships-Tabelle', async () => {
    const { app, db } = await setup()

    const tableInfo = db.prepare('PRAGMA table_info(memberships)').all() as { name: string }[]
    const columns = tableInfo.map(c => c.name)
    expect(columns.find(c => c.toLowerCase().includes('ip'))).toBeUndefined()

    await app.close()
    db.close()
  })

  it('speichert keine IP in lesson_settings-Tabelle', async () => {
    const { app, db } = await setup()

    const tableInfo = db.prepare('PRAGMA table_info(lesson_settings)').all() as { name: string }[]
    const columns = tableInfo.map(c => c.name)
    expect(columns.find(c => c.toLowerCase().includes('ip'))).toBeUndefined()

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Kein Abfragetext in Logs (Strukturtest)
// ---------------------------------------------------------------------------

describe('Kein Abfragetext in Logs', () => {
  it('Fortschritt mit letzter Abfrage und Lehrer-Abruf schreiben weder Abfrage noch Fehlermeldung ins Log', async () => {
    const lines: string[] = []
    const db = testDb()
    const app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true, logStream: { write: (m) => { lines.push(m) } } })
    await app.ready()
    const teacher = await registerTeacher(app, 'log@schule.de')
    const cls = await createClass(app, teacher.cookie, 'LogKlasse')
    const j = await joinStudent(app, cls.code, 'Lina Log', 'passwort123')
    const sealed = await C.sealForTeacher(await C.importPublicKey(j.info.public_key), JSON.stringify({ q: 'SELECT geheim FROM tabelle', e: 'no such column: geheim' }))
    const put = await app.inject({
      method: 'PUT', url: '/api/progress', headers: { 'content-type': 'application/json', cookie: j.cookie },
      payload: { progress: [{ lesson_id: 'select-basics', step: 1, done: false, attempts: 3, updated_at: 1 }], last_attempts: [{ lesson_id: 'select-basics', step: 1, sealed, has_error: true }] },
    })
    expect(put.statusCode).toBe(200)
    const sid = (db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }).id
    const la = await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/students/${sid}/last-attempt`, headers: { cookie: teacher.cookie } })
    expect(la.statusCode).toBe(200)
    expect(lines.length).toBeGreaterThan(0)
    const log = lines.join('\n')
    for (const s of ['SELECT geheim', 'no such column', 'Lina', sealed.slice(3, 40)]) expect(log, s).not.toContain(s)
    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Schuelerliste: enc_name statt display_name
// ---------------------------------------------------------------------------

describe('Schuelerliste: enc_name', () => {
  it('Lehrkraft sieht enc_name statt display_name in der Schuelerliste', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-cc@schule.de', 'sicheresPasswort1', 'Frau CC')
    const cls = await createClass(app, teacher.cookie, 'EncNameKlasse')

    await joinStudent(app, cls.code, 'Max Mustermann', 'passwortMM1')

    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${cls.id}/students`,
      headers: { cookie: teacher.cookie },
    })
    expect(res.statusCode).toBe(200)
    const students = JSON.parse(res.body).students as Record<string, unknown>[]
    expect(students.length).toBe(1)
    // enc_name vorhanden, display_name nicht (oder leer)
    expect(students[0].enc_name).toBeTruthy()
    expect(String(students[0].enc_name)).toMatch(/^h1\./)
    // Der Klarname ist verschluesselt, nicht im Klartext
    const asString = JSON.stringify(students[0])
    expect(asString).not.toContain('Max')
    expect(asString).not.toContain('Mustermann')
    // Lehrkraft entschluesselt
    const name = await C.openForTeacher(teacher.privateKey, students[0].enc_name as string)
    expect(name).toBe('Max Mustermann')

    await app.close()
    db.close()
  })
})

// ---------------------------------------------------------------------------
// Als erledigt markieren (complete endpoint)
// ---------------------------------------------------------------------------

describe('Als erledigt markieren (complete endpoint)', () => {
  it('Lehrkraft kann Schritt eines Schuelers als erledigt markieren', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-complete@schule.de', 'sicheresPasswort1', 'Frau Complete')
    const cls = await createClass(app, teacher.cookie, 'CompleteKlasse')

    await joinStudent(app, cls.code, 'Schueler Complete', 'passwortC1')

    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    const res = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${cls.id}/students/${student.id}/complete`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({ lesson_id: 'select-basics', step: 0 }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })

    const row = db.prepare(
      'SELECT done FROM progress WHERE user_id = ? AND lesson_id = ? AND step = ?'
    ).get(student.id, 'select-basics', 0) as { done: number } | undefined
    expect(row?.done).toBe(1)

    await app.close()
    db.close()
  })

  it('Fremde Klasse liefert 404 (K4)', async () => {
    const { app, db } = await setup()
    const teacher1 = await registerTeacher(app, 'cls-complA@schule.de', 'sicheresPasswort1', 'Frau ComplA')
    const teacher2 = await registerTeacher(app, 'cls-complB@schule.de', 'sicheresPasswort1', 'Frau ComplB')
    const cls = await createClass(app, teacher1.cookie, 'ComplKlasseA')

    await joinStudent(app, cls.code, 'Schueler ComplB', 'passwortCB1')
    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    const res = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${cls.id}/students/${student.id}/complete`,
      headers: { 'content-type': 'application/json', cookie: teacher2.cookie },
      body: JSON.stringify({ lesson_id: 'select-basics', step: 0 }),
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })

  it('Schueler ausserhalb der Klasse liefert 404', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'cls-complC@schule.de', 'sicheresPasswort1', 'Frau ComplC')
    const cls = await createClass(app, teacher.cookie, 'ComplKlasseC')

    // Schueler in einer anderen Klasse des selben Lehrers
    const cls2 = await createClass(app, teacher.cookie, 'AndereKlasse')
    await joinStudent(app, cls2.code, 'Schueler AndereKlasse', 'passwortA1')
    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get() as { id: number }

    const res = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${cls.id}/students/${student.id}/complete`,
      headers: { 'content-type': 'application/json', cookie: teacher.cookie },
      body: JSON.stringify({ lesson_id: 'select-basics', step: 0 }),
    })
    expect(res.statusCode).toBe(404)

    await app.close()
    db.close()
  })
})
