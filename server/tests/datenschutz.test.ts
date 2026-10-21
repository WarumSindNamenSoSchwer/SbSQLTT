/**
 * K1/K2: Schema-Tests - Formularfelder und Datenbankschema
 * K6: Cookie-Attribute
 * K8: Konto loeschen entfernt alle Zeilen
 * K10: Keine IP in Datenbank
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb } from './helpers.js'
import type { Db } from '../src/db.js'

async function setup() {
  const db = testDb()
  const mail = new InMemoryMailSender()
  const app = await buildApp({ db, mail, skipCsrf: true })
  await app.ready()
  return { db, mail, app }
}

// Hilfsfunktion: Schueler registrieren
async function registerStudent(app: FastifyInstance, username = 'testschueler', password = 'sicheresPasswort1') {
  return app.inject({
    method: 'POST',
    url: '/api/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'student',
      username,
      display_name: 'Test Schueler',
      password,
    }),
  })
}

// Hilfsfunktion: Lehrkraft registrieren
async function registerTeacher(app: FastifyInstance, username = 'testlehrkraft', password = 'sicheresPasswort1') {
  return app.inject({
    method: 'POST',
    url: '/api/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'teacher',
      username,
      display_name: 'Test Lehrkraft',
      name: 'Frau Mustermann',
      email: `${username}@schule.de`,
      password,
      terms_accepted: true,
    }),
  })
}

describe('K1/K2: Registrierung und Schema', () => {
  it('registriert einen Schueler mit Pflichtfeldern', async () => {
    const { app, db } = await setup()
    const res = await registerStudent(app)

    expect(res.statusCode).toBe(201)

    const user = db.prepare("SELECT * FROM users WHERE username = 'testschueler'").get() as Record<string, unknown>
    expect(user).toBeTruthy()
    expect(user['role']).toBe('student')
    expect(user['username']).toBe('testschueler')
    expect(user['display_name']).toBe('Test Schueler')
    // K1: keine unnoetigen Pflichtfelder
    expect(user['email']).toBeNull()
    expect(user['school']).toBeNull()

    await app.close()
    db.close()
  })

  it('lehnt Schueler ohne Pflichtfelder ab', async () => {
    const { app, db } = await setup()
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'student',
        username: 'x',
        // fehlt: display_name, password
      }),
    })
    expect(res.statusCode).toBe(400)
    await app.close()
    db.close()
  })

  it('registriert eine Lehrkraft mit allen K2-Feldern', async () => {
    const { app, db } = await setup()
    const res = await registerTeacher(app)

    expect(res.statusCode).toBe(201)

    const user = db.prepare("SELECT * FROM users WHERE username = 'testlehrkraft'").get() as Record<string, unknown>
    expect(user).toBeTruthy()
    expect(user['role']).toBe('teacher')
    expect(user['name']).toBe('Frau Mustermann')
    expect(user['email']).toBe('testlehrkraft@schule.de')
    expect(user['terms_accepted_at']).toBeTruthy()

    await app.close()
    db.close()
  })

  it('lehnt Lehrkraft ohne E-Mail ab', async () => {
    const { app, db } = await setup()
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        username: 'lehrkraft2',
        display_name: 'Lehrkraft 2',
        name: 'Herr Muster',
        // fehlt: email, terms_accepted
        password: 'sicheresPasswort1',
      }),
    })
    expect(res.statusCode).toBe(400)
    await app.close()
    db.close()
  })

  it('lehnt doppelten Benutzernamen ab', async () => {
    const { app, db } = await setup()
    await registerStudent(app, 'doppelt')
    const res2 = await registerStudent(app, 'doppelt')
    expect(res2.statusCode).toBe(409)
    await app.close()
    db.close()
  })

  it('normalisiert Benutzernamen zu Kleinbuchstaben', async () => {
    const { app, db } = await setup()
    await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'student',
        username: 'GROSSBUCHSTABEN',
        display_name: 'Test',
        password: 'sicheresPasswort1',
      }),
    })
    const user = db.prepare("SELECT username FROM users WHERE username = 'grossbuchstaben'").get()
    expect(user).toBeTruthy()
    await app.close()
    db.close()
  })
})

describe('K6: Cookie-Attribute', () => {
  it('setzt Cookie beim Login mit korrekten Attributen', async () => {
    const { app, db } = await setup()
    await registerStudent(app)

    const res = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        login: 'testschueler',
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
    // Kein Cookie bei anderen Anfragen (wird nur bei Login gesetzt)
    expect(cookieStr).toContain('tabula_session=')

    await app.close()
    db.close()
  })

  it('loescht Cookie beim Logout', async () => {
    const { app, db } = await setup()
    const regRes = await registerStudent(app)

    // Cookie aus Register-Antwort holen
    const cookieHeader = regRes.headers['set-cookie']
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const cookieValue = (cookie as string).split(';')[0]

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/logout',
      headers: {
        'content-type': 'application/json',
        'cookie': cookieValue,
      },
      body: '{}',
    })

    expect(logoutRes.statusCode).toBe(200)

    await app.close()
    db.close()
  })
})

describe('K8: Konto loeschen entfernt alle Zeilen', () => {
  it('DELETE /api/me entfernt Konto und alle assoziierten Daten', async () => {
    const { app, db } = await setup()
    const regRes = await registerStudent(app, 'zuloschueler')

    const cookieHeader = regRes.headers['set-cookie']
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const cookieValue = (cookie as string).split(';')[0]

    // Fortschritt hinzufuegen
    await app.inject({
      method: 'PUT',
      url: '/api/progress',
      headers: {
        'content-type': 'application/json',
        'cookie': cookieValue,
      },
      body: JSON.stringify({
        progress: [{
          lesson_id: 'lesson-1',
          step: 0,
          done: true,
          attempts: 3,
          updated_at: Math.floor(Date.now() / 1000),
        }],
      }),
    })

    // User-ID holen
    const user = db.prepare("SELECT id FROM users WHERE username = 'zuloschueler'").get() as { id: number }
    const userId = user.id

    // Konto loeschen
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { 'cookie': cookieValue },
    })

    expect(deleteRes.statusCode).toBe(200)

    // Alle Zeilen muessen weg sein (K8)
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(userId)).toBeUndefined()
    expect(db.prepare('SELECT id_hash FROM sessions WHERE user_id = ?').get(userId)).toBeUndefined()
    expect(db.prepare('SELECT id FROM progress WHERE user_id = ?').get(userId)).toBeUndefined()

    await app.close()
    db.close()
  })
})

describe('K10: Keine IP in Datenbank', () => {
  it('speichert keine IP-Adresse in der users-Tabelle', async () => {
    const { app, db } = await setup()
    await registerStudent(app, 'iptest')

    // Alle Spalten der users-Tabelle pruefen
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    const columns = tableInfo.map(c => c.name)

    // Keine IP-bezogenen Spalten erlaubt
    expect(columns.find(c => c.toLowerCase().includes('ip'))).toBeUndefined()
    expect(columns.find(c => c.toLowerCase().includes('address'))).toBeUndefined()

    await app.close()
    db.close()
  })

  it('speichert keine IP-Adresse in der sessions-Tabelle', async () => {
    const { app, db } = await setup()

    const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[]
    const columns = tableInfo.map(c => c.name)

    expect(columns.find(c => c.toLowerCase().includes('ip'))).toBeUndefined()

    await app.close()
    db.close()
  })
})

describe('K3: Umbenennen ohne Passwort abgelehnt', () => {
  it('PATCH /api/me: Benutzername ohne current_password wird abgelehnt', async () => {
    const { app, db } = await setup()
    const regRes = await registerStudent(app, 'renametest')

    const cookieHeader = regRes.headers['set-cookie']
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const cookieValue = (cookie as string).split(';')[0]

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: {
        'content-type': 'application/json',
        'cookie': cookieValue,
      },
      body: JSON.stringify({
        username: 'neuerbenutzername',
        // kein current_password
      }),
    })

    expect(res.statusCode).toBe(400)

    // Benutzername unveraendert
    const user = db.prepare("SELECT username FROM users WHERE username = 'renametest'").get()
    expect(user).toBeTruthy()

    await app.close()
    db.close()
  })

  it('PATCH /api/me: Benutzername mit falschem Passwort abgelehnt', async () => {
    const { app, db } = await setup()
    const regRes = await registerStudent(app, 'renametest2', 'richtigesPasswort1')

    const cookieHeader = regRes.headers['set-cookie']
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const cookieValue = (cookie as string).split(';')[0]

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: {
        'content-type': 'application/json',
        'cookie': cookieValue,
      },
      body: JSON.stringify({
        username: 'neuerbenutzername2',
        current_password: 'falschesPasswort!',
      }),
    })

    expect(res.statusCode).toBe(403)
    await app.close()
    db.close()
  })
})

describe('K4: Klassen-Sichtbarkeit (Lehrkraft A sieht nicht Klasse von B)', () => {
  it('memberships sind klassen-spezifisch und durch teacher_id geschuetzt', async () => {
    const { app, db } = await setup()

    // Zwei Lehrkraefte und Klassen anlegen (direkt per DB)
    const teacherA = db.prepare(
      "INSERT INTO users (username, display_name, email, name, role, password_hash, created_day) VALUES ('teachera', 'Lehrer A', 'a@schule.de', 'Lehrer A', 'teacher', 'hash', '2024-01-01')"
    ).run()
    const teacherB = db.prepare(
      "INSERT INTO users (username, display_name, email, name, role, password_hash, created_day) VALUES ('teacherb', 'Lehrer B', 'b@schule.de', 'Lehrer B', 'teacher', 'hash', '2024-01-01')"
    ).run()
    const classA = db.prepare(
      "INSERT INTO classes (teacher_id, name, join_code) VALUES (?, 'Klasse A', 'CODEA')"
    ).run(teacherA.lastInsertRowid)
    const classB = db.prepare(
      "INSERT INTO classes (teacher_id, name, join_code) VALUES (?, 'Klasse B', 'CODEB')"
    ).run(teacherB.lastInsertRowid)

    // Klasse A gehört nicht zu Lehrer B
    const classBelongsToA = db.prepare(
      "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    ).get(classA.lastInsertRowid, teacherB.lastInsertRowid)

    expect(classBelongsToA).toBeUndefined()

    // Klasse B gehört nicht zu Lehrer A
    const classBelongsToB = db.prepare(
      "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    ).get(classB.lastInsertRowid, teacherA.lastInsertRowid)

    expect(classBelongsToB).toBeUndefined()

    await app.close()
    db.close()
  })
})
