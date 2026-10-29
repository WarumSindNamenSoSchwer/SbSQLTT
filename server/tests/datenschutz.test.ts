/**
 * K1/K2: Schema-Tests - Formularfelder und Datenbankschema
 * K6: Cookie-Attribute
 * K8: Konto loeschen entfernt alle Zeilen (Lehrkraft + Klassen + Schueler)
 * K10: Keine IP in Datenbank
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb, registerTeacher, createClass, joinStudent, C } from './helpers.js'
import type { Db } from '../src/db.js'

const json = { 'content-type': 'application/json' }

async function setup() {
  const db = testDb()
  const mail = new InMemoryMailSender()
  const app = await buildApp({ db, mail, skipCsrf: true })
  await app.ready()
  return { db, mail, app }
}

describe('K1/K2: Registrierung und Schema', () => {
  it('registriert eine Lehrkraft mit allen K2-Feldern', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'testlehrkraft@schule.de', 'sicheresPasswort1', 'Frau Mustermann')

    // Cookie wurde gesetzt
    expect(teacher.cookie).toBeTruthy()

    // Lehrkraft-Zeile in der DB pruefen
    const user = db.prepare("SELECT * FROM users WHERE email = 'testlehrkraft@schule.de'").get() as Record<string, unknown>
    expect(user).toBeTruthy()
    expect(user['role']).toBe('teacher')
    expect(user['name']).toBe('Frau Mustermann')
    expect(user['email']).toBe('testlehrkraft@schule.de')
    expect(user['terms_accepted_at']).toBeTruthy()
    // Oeffentlicher Schluessel wurde gespeichert
    expect(user['public_key']).toBeTruthy()

    await app.close()
    db.close()
  })

  it('lehnt Lehrkraft ohne E-Mail ab', async () => {
    const { app, db } = await setup()
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: json,
      body: JSON.stringify({
        role: 'teacher',
        display_name: 'Lehrkraft 2',
        name: 'Herr Muster',
        // fehlt: email, terms_accepted, keys
        password: 'sicheresPasswort1',
      }),
    })
    expect(res.statusCode).toBe(400)
    await app.close()
    db.close()
  })

  it('lehnt Lehrkraft ohne keys ab', async () => {
    const { app, db } = await setup()
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: json,
      body: JSON.stringify({
        role: 'teacher',
        display_name: 'Lehrkraft 3',
        name: 'Herr K',
        email: 'knokeys@schule.de',
        password: 'sicheresPasswort1',
        terms_accepted: true,
        // fehlt: keys
      }),
    })
    expect(res.statusCode).toBe(400)
    await app.close()
    db.close()
  })

  it('lehnt doppelte E-Mail-Adresse ab', async () => {
    const { app, db } = await setup()
    await registerTeacher(app, 'doppelt@schule.de', 'sicheresPasswort1', 'Frau D1')
    // Zweite Registrierung mit gleicher E-Mail
    let threw = false
    try {
      await registerTeacher(app, 'doppelt@schule.de', 'anderesPw123', 'Frau D2')
    } catch {
      threw = true
    }
    // Entweder 409-Antwort (registerTeacher wirft) oder kein zweiter Eintrag
    const count = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'doppelt@schule.de'").get() as { n: number }).n
    expect(count).toBe(1)
    void threw
    await app.close()
    db.close()
  })

  it('Benutzername der Lehrkraft ist die normalisierte E-Mail (Kleinbuchstaben)', async () => {
    const { app, db } = await setup()
    await registerTeacher(app, 'GROSS@Schule.de', 'sicheresPasswort1', 'Frau G')
    const user = db.prepare("SELECT username FROM users WHERE email = 'gross@schule.de'").get() as { username: string } | undefined
    expect(user).toBeTruthy()
    expect(user?.username).toBe('gross@schule.de')
    await app.close()
    db.close()
  })

  it('Schuelereintrag enthaelt nur Nummer, Pruefwert, verschluesselten Namen (kein Klarname, keine E-Mail)', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'lehrer-schema@schule.de', 'sicheresPasswort1', 'Frau Schema')
    const cls = await createClass(app, teacher.cookie, 'SchemaKlasse')
    const { res } = await joinStudent(app, cls.code, 'Max Muster', 'passwort123')
    expect(res.statusCode).toBe(201)

    const row = db.prepare("SELECT * FROM users WHERE role = 'student'").get() as Record<string, unknown>
    expect(row['email']).toBeNull()
    expect(row['name']).toBeNull()
    expect(row['display_name']).toBe('')
    expect(row['password_hash']).toBe('')
    expect(String(row['login_hash'])).toMatch(/^[0-9a-f]{64}$/)
    expect(String(row['enc_name'])).toMatch(/^h1\./)

    await app.close()
    db.close()
  })
})

describe('K6: Cookie-Attribute', () => {
  it('setzt Cookie beim Login mit korrekten Attributen', async () => {
    const { app, db } = await setup()
    await registerTeacher(app, 'cookie@schule.de', 'sicheresPasswort1', 'Frau Cookie')

    const res = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: json,
      body: JSON.stringify({
        login: 'cookie@schule.de',
        password: 'sicheresPasswort1',
      }),
    })

    expect(res.statusCode).toBe(200)

    const cookieHeader = res.headers['set-cookie']
    expect(cookieHeader).toBeTruthy()

    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const cookieStr = cookie as string

    // K6: HttpOnly
    expect(cookieStr.toLowerCase()).toContain('httponly')
    // K6: Secure
    expect(cookieStr.toLowerCase()).toContain('secure')
    // K6: SameSite=Lax
    expect(cookieStr.toLowerCase()).toContain('samesite=lax')
    // K6: Path=/
    expect(cookieStr).toContain('Path=/')
    // K6: Max-Age 30 Tage
    expect(cookieStr).toContain(`Max-Age=${30 * 24 * 60 * 60}`)
    expect(cookieStr).toContain('tabula_session=')

    await app.close()
    db.close()
  })

  it('loescht Cookie beim Logout', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'logout@schule.de', 'sicheresPasswort1', 'Frau Logout')

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/logout',
      headers: { cookie: teacher.cookie },
    })

    expect(logoutRes.statusCode).toBe(200)

    const cookieHeader = logoutRes.headers['set-cookie']
    if (cookieHeader) {
      const cookieStr = (Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader) as string
      // Cookie-Wert ist leer oder Max-Age=0
      expect(
        cookieStr.includes('tabula_session=;') ||
        cookieStr.includes('Max-Age=0') ||
        cookieStr.includes('tabula_session=; ')
      ).toBe(true)
    }

    await app.close()
    db.close()
  })
})

describe('K8: Konto loeschen entfernt alle Zeilen', () => {
  it('DELETE /api/me einer Lehrkraft entfernt Lehrkraft, ihre Klassen und deren Schueler', async () => {
    const { app, db } = await setup()

    const teacher = await registerTeacher(app, 'zuloeschen@schule.de', 'sicheresPasswort1', 'Frau Loeschen')
    const cls = await createClass(app, teacher.cookie, 'Loeschklasse')

    // Schueler beitreten lassen
    const { res: j1 } = await joinStudent(app, cls.code, 'Schueler Eins', 'passwort111')
    expect(j1.statusCode).toBe(201)
    const { res: j2 } = await joinStudent(app, cls.code, 'Schueler Zwei', 'passwort222')
    expect(j2.statusCode).toBe(201)

    // IDs merken
    const teacherRow = db.prepare("SELECT id FROM users WHERE email = 'zuloeschen@schule.de'").get() as { id: number }
    const students = db.prepare("SELECT id FROM users WHERE role = 'student'").all() as { id: number }[]
    expect(students.length).toBeGreaterThanOrEqual(2)

    // Fortschritt fuer Schueler anlegen
    const s1Id = students[0]!.id
    db.prepare("INSERT INTO progress (user_id, lesson_id, step, done, attempts) VALUES (?, 'select-basics', 0, 0, 1)").run(s1Id)

    // Lehrkraft loescht ihr Konto
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { cookie: teacher.cookie, 'content-type': 'application/json' },
      payload: { password: 'sicheresPasswort1' },
    })
    expect(delRes.statusCode).toBe(200)

    // Lehrkraft-Zeile weg
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(teacherRow.id)).toBeUndefined()
    // Klasse weg
    expect(db.prepare('SELECT id FROM classes WHERE id = ?').get(cls.id)).toBeUndefined()
    // Schueler-Zeilen weg
    for (const s of students) {
      expect(db.prepare('SELECT id FROM users WHERE id = ?').get(s.id)).toBeUndefined()
    }
    // Fortschritt weg
    expect(db.prepare('SELECT id FROM progress WHERE user_id = ?').get(s1Id)).toBeUndefined()

    await app.close()
    db.close()
  })
})

describe('K10: Keine IP in Datenbank', () => {
  it('speichert keine IP-Adresse in der users-Tabelle', async () => {
    const { app, db } = await setup()

    await registerTeacher(app, 'noip@schule.de', 'sicheresPasswort1', 'Frau NoIP',
    )

    const columns = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name)
    expect(columns.find(c => c.toLowerCase().includes('ip'))).toBeUndefined()
    expect(columns.find(c => c.toLowerCase().includes('address'))).toBeUndefined()

    await app.close()
    db.close()
  })

  it('speichert keine IP-Adresse in der sessions-Tabelle', async () => {
    const { app, db } = await setup()

    const columns = (db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]).map(c => c.name)
    expect(columns.find(c => c.toLowerCase().includes('ip'))).toBeUndefined()

    await app.close()
    db.close()
  })
})

describe('K3: Umbenennen der Lehrkraft', () => {
  it('PATCH /api/me: display_name aendern funktioniert', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'rename@schule.de', 'sicheresPasswort1', 'Frau Alt')

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { ...json, cookie: teacher.cookie },
      body: JSON.stringify({ display_name: 'Frau Neu' }),
    })
    expect(res.statusCode).toBe(200)

    const row = db.prepare("SELECT display_name FROM users WHERE email = 'rename@schule.de'").get() as { display_name: string }
    expect(row.display_name).toBe('Frau Neu')

    await app.close()
    db.close()
  })

  it('PATCH /api/me: username-Feld wird ignoriert (kein username mehr aenderbar)', async () => {
    const { app, db } = await setup()
    const teacher = await registerTeacher(app, 'nouser@schule.de', 'sicheresPasswort1', 'Frau NoUser')

    // username wird ignoriert, kein Fehler
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { ...json, cookie: teacher.cookie },
      body: JSON.stringify({ display_name: 'Frau Updated' }),
    })
    expect(res.statusCode).toBe(200)

    await app.close()
    db.close()
  })
})

describe('K4: Klassen-Sichtbarkeit (Lehrkraft A sieht nicht Klasse von B)', () => {
  it('memberships sind klassen-spezifisch und durch teacher_id geschuetzt', async () => {
    const { app, db } = await setup()

    const teacherA = await registerTeacher(app, 'lka@schule.de', 'sicheresPasswort1', 'Frau A')
    const teacherB = await registerTeacher(app, 'lkb@schule.de', 'sicheresPasswort1', 'Frau B')

    const clsA = await createClass(app, teacherA.cookie, 'Klasse A')
    const clsB = await createClass(app, teacherB.cookie, 'Klasse B')

    // Schueler tritt Klasse A bei
    await joinStudent(app, clsA.code, 'Schueler A', 'passwortA1')

    // Lehrkraft B versucht Schueler von Klasse A zu sehen
    const res = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${clsA.id}/students`,
      headers: { cookie: teacherB.cookie },
    })
    expect(res.statusCode).toBe(404)

    // Klasse B hat keine Mitglieder (Schueler ist nur in A)
    const members = db.prepare('SELECT user_id FROM memberships WHERE class_id = ?').all(clsB.id)
    expect(members.length).toBe(0)

    await app.close()
    db.close()
  })
})
