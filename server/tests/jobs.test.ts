/**
 * K8: Jobs-Tests - Inaktivitaets-Loeschung
 */
import { describe, it, expect } from 'vitest'
import { testDb, registerTeacher, createClass, joinStudent } from './helpers.js'
import { buildApp } from '../src/app.js'
import { runCleanupJob, runInactivityDeletionJob, runInactivityReminderJob, runQuizCleanupJob } from '../src/jobs.js'
import { InMemoryMailSender } from '../src/mail.js'

const YEAR_S = 365 * 24 * 60 * 60

function insertTeacher(db: ReturnType<typeof testDb>, opts: {
  username: string
  lastLoginAt?: number | null
  email?: string | null
  displayName?: string
}) {
  return db.prepare(
    `INSERT INTO users (username, display_name, email, name, role, password_hash, created_day, last_login_at)
     VALUES (?, ?, ?, ?, 'teacher', 'hash', '2024-01-01', ?)`
  ).run(opts.username, opts.displayName ?? opts.username, opts.email ?? null, opts.displayName ?? opts.username, opts.lastLoginAt ?? null)
}

describe('K8: Inaktivitaets-Loeschung', () => {
  it('loescht Lehrkraft-Konten nach 12 Monaten Inaktivitaet', () => {
    const db = testDb()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    // Inaktive Lehrkraft (13 Monate zurueck)
    insertTeacher(db, { username: 'inaktiv@schule.de', lastLoginAt: nowTs - (13 * 30 * 24 * 3600), email: 'inaktiv@schule.de' })
    // Aktive Lehrkraft (vor 1 Monat)
    insertTeacher(db, { username: 'aktiv@schule.de', lastLoginAt: nowTs - (30 * 24 * 3600), email: 'aktiv@schule.de' })
    // Konto ohne last_login (noch nie angemeldet) - nicht geloescht
    insertTeacher(db, { username: 'neukonto@schule.de', lastLoginAt: null, email: 'neukonto@schule.de' })

    const deleted = runInactivityDeletionJob(db, now)

    expect(deleted).toBeGreaterThanOrEqual(1)
    expect(db.prepare("SELECT id FROM users WHERE username = 'inaktiv@schule.de'").get()).toBeUndefined()
    expect(db.prepare("SELECT id FROM users WHERE username = 'aktiv@schule.de'").get()).toBeTruthy()
    expect(db.prepare("SELECT id FROM users WHERE username = 'neukonto@schule.de'").get()).toBeTruthy()

    db.close()
  })

  it('versendet Erinnerungs-E-Mail 30 Tage vor Loeschung (nur an Lehrkraefte)', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    // Lehrkraft: letzte Anmeldung vor 11.5 Monaten (in Erinnerungs-Fenster)
    const elevenHalfMonthsAgo = nowTs - Math.floor(11.5 * 30 * 24 * 3600)
    insertTeacher(db, { username: 'bald_inaktiv@schule.de', lastLoginAt: elevenHalfMonthsAgo, email: 'bald@schule.de', displayName: 'Frau Bald' })

    // Lehrkraft ohne E-Mail (kein Erinnerungs-Mail moeglich)
    insertTeacher(db, { username: 'kein_mail@schule.de', lastLoginAt: elevenHalfMonthsAgo, email: null })

    const sent = await runInactivityReminderJob({ db, mail, siteUrl: 'https://test.de' }, now)

    expect(sent).toBe(1)
    expect(mail.sent.length).toBe(1)
    expect(mail.sent[0]!.to).toBe('bald@schule.de')
    // Betreff enthält "gelöscht" (echte Umlaute)
    expect(mail.sent[0]!.subject).toContain('gelöscht')

    // Am nächsten Tag keine zweite Erinnerung (nur einmal je Inaktivitätsphase)
    expect(await runInactivityReminderJob({ db, mail, siteUrl: 'https://test.de' }, now + 24 * 3600 * 1000)).toBe(0)
    // Nach erneuter Anmeldung und wieder 11,5 Monaten Pause gibt es wieder genau eine Erinnerung
    db.prepare("UPDATE users SET last_login_at = ? WHERE email = 'bald@schule.de'").run(nowTs + 2 * 24 * 3600)
    const later = (nowTs + 2 * 24 * 3600 + Math.floor(11.5 * 30 * 24 * 3600)) * 1000
    expect(await runInactivityReminderJob({ db, mail, siteUrl: 'https://test.de' }, later)).toBe(1)

    db.close()
  })

  it('Inaktivitaetsmail enthaelt echte Umlaute im Betreff', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    const elevenHalfMonthsAgo = nowTs - Math.floor(11.5 * 30 * 24 * 3600)
    insertTeacher(db, { username: 'umlaut@schule.de', lastLoginAt: elevenHalfMonthsAgo, email: 'umlaut@schule.de', displayName: 'Herr Müller' })

    await runInactivityReminderJob({ db, mail, siteUrl: 'https://test.de' }, now)

    expect(mail.sent.length).toBe(1)
    // Betreff muss echten Umlaut enthalten, kein HTML-Entity oder Ersatz
    const subj = mail.sent[0]!.subject
    expect(subj).toContain('ö') // "gelöscht"
    expect(subj).not.toContain('&ouml;')
    expect(subj).not.toContain('oe')

    db.close()
  })

  it('Inaktivitaetsjob loescht mit einer inaktiven Lehrkraft auch deren Schueler', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const app = await buildApp({ db, mail, skipCsrf: true })
    await app.ready()

    const now = Date.now()
    const nowTs = Math.floor(now / 1000)
    const thirteenMonthsAgo = nowTs - (13 * 30 * 24 * 3600)

    // Lehrkraft anlegen und Klasse + Schueler erstellen
    const teacher = await registerTeacher(app, 'inactive-teacher@schule.de', 'passwortXYZ1', 'Frau Inaktiv')
    const cls = await createClass(app, teacher.cookie, 'InaktivKlasse')
    const { res: j1 } = await joinStudent(app, cls.code, 'Schueler A', 'passwort111')
    expect(j1.statusCode).toBe(201)

    const teacherRow = db.prepare("SELECT id FROM users WHERE email = 'inactive-teacher@schule.de'").get() as { id: number }
    const students = db.prepare("SELECT id FROM users WHERE role = 'student'").all() as { id: number }[]
    expect(students.length).toBeGreaterThanOrEqual(1)

    // Lehrkraft auf inaktiv setzen (13 Monate zurueck)
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(thirteenMonthsAgo, teacherRow.id)

    const deleted = runInactivityDeletionJob(db, now)

    // Lehrkraft geloescht
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(teacherRow.id)).toBeUndefined()
    // Schueler der Klasse ebenfalls geloescht
    for (const s of students) {
      expect(db.prepare('SELECT id FROM users WHERE id = ?').get(s.id)).toBeUndefined()
    }

    await app.close()
    db.close()
  }, 60_000)

  it('Klasse loeschen loescht ihre Schueler komplett (users-Zeile weg)', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const app = await buildApp({ db, mail, skipCsrf: true })
    await app.ready()

    const teacher = await registerTeacher(app, 'cls-delete@schule.de', 'passwortXYZ1', 'Frau ClsDelete')
    const cls = await createClass(app, teacher.cookie, 'DeleteKlasse')

    const { res: j1 } = await joinStudent(app, cls.code, 'Schueler Del', 'passwort111')
    expect(j1.statusCode).toBe(201)

    const students = db.prepare("SELECT id FROM users WHERE role = 'student'").all() as { id: number }[]
    expect(students.length).toBeGreaterThanOrEqual(1)

    // Klasse loeschen
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/teacher/classes/${cls.id}`,
      headers: { cookie: teacher.cookie },
    })
    expect(delRes.statusCode).toBe(200)

    // Schueler-Zeilen muessen komplett weg sein
    for (const s of students) {
      expect(db.prepare('SELECT id FROM users WHERE id = ?').get(s.id), `Schueler ${s.id} sollte geloescht sein`).toBeUndefined()
    }

    await app.close()
    db.close()
  }, 60_000)
})

describe('Cleanup-Jobs', () => {
  it('loescht abgelaufene Sitzungen', () => {
    const db = testDb()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    // Lehrkraft anlegen
    const user = db.prepare(
      "INSERT INTO users (username, display_name, role, password_hash, created_day) VALUES ('s1@schule.de', 's1', 'teacher', 'h', '2024-01-01')"
    ).run()

    // Abgelaufene Session
    db.prepare(
      'INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)'
    ).run('abgelaufenhash', user.lastInsertRowid, nowTs - 1000)

    // Gueltige Session
    db.prepare(
      'INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)'
    ).run('gueltigehash', user.lastInsertRowid, nowTs + 100000)

    const result = runCleanupJob(db, now)

    expect(result.sessions).toBe(1)
    expect(db.prepare("SELECT id_hash FROM sessions WHERE id_hash = 'abgelaufenhash'").get()).toBeUndefined()
    expect(db.prepare("SELECT id_hash FROM sessions WHERE id_hash = 'gueltigehash'").get()).toBeTruthy()

    db.close()
  })

  it('loescht abgelaufene Passwort-Reset-Token', () => {
    const db = testDb()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    const user = db.prepare(
      "INSERT INTO users (username, display_name, role, password_hash, created_day) VALUES ('s2@schule.de', 's2', 'teacher', 'h', '2024-01-01')"
    ).run()

    db.prepare(
      'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
    ).run('abgelaufenreset', user.lastInsertRowid, nowTs - 1)

    db.prepare(
      'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
    ).run('gueltigereset', user.lastInsertRowid, nowTs + 10000)

    const result = runCleanupJob(db, now)

    expect(result.resets).toBe(1)
    expect(db.prepare("SELECT token_hash FROM password_resets WHERE token_hash = 'abgelaufenreset'").get()).toBeUndefined()
    expect(db.prepare("SELECT token_hash FROM password_resets WHERE token_hash = 'gueltigereset'").get()).toBeTruthy()

    db.close()
  })
})
