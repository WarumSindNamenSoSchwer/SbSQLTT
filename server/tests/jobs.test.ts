/**
 * K8: Jobs-Tests - Inaktivitaets-Loeschung
 */
import { describe, it, expect } from 'vitest'
import { testDb } from './helpers.js'
import { runCleanupJob, runInactivityDeletionJob, runInactivityReminderJob, runQuizCleanupJob } from '../src/jobs.js'
import { InMemoryMailSender } from '../src/mail.js'

const YEAR_S = 365 * 24 * 60 * 60

function insertUser(db: ReturnType<typeof testDb>, opts: {
  username: string
  lastLoginAt?: number | null
  email?: string | null
}) {
  return db.prepare(
    `INSERT INTO users (username, display_name, email, role, password_hash, created_day, last_login_at)
     VALUES (?, ?, ?, 'student', 'hash', '2024-01-01', ?)`
  ).run(opts.username, opts.username, opts.email ?? null, opts.lastLoginAt ?? null)
}

describe('K8: Inaktivitaets-Loeschung', () => {
  it('loescht Konten nach 12 Monaten Inaktivitaet', () => {
    const db = testDb()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    // Inaktives Konto (13 Monate zurueck)
    insertUser(db, { username: 'inaktiv', lastLoginAt: nowTs - (13 * 30 * 24 * 3600) })
    // Aktives Konto (vor 1 Monat)
    insertUser(db, { username: 'aktiv', lastLoginAt: nowTs - (30 * 24 * 3600) })
    // Konto ohne last_login (noch nie angemeldet)
    insertUser(db, { username: 'neukonto', lastLoginAt: null })

    const deleted = runInactivityDeletionJob(db, now)

    expect(deleted).toBe(1)
    expect(db.prepare("SELECT id FROM users WHERE username = 'inaktiv'").get()).toBeUndefined()
    expect(db.prepare("SELECT id FROM users WHERE username = 'aktiv'").get()).toBeTruthy()
    expect(db.prepare("SELECT id FROM users WHERE username = 'neukonto'").get()).toBeTruthy()

    db.close()
  })

  it('versendet Erinnerungs-E-Mail 30 Tage vor Loeschung', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    // Konto: letzte Anmeldung vor 11.5 Monaten (in Erinnerungs-Fenster)
    const elevenHalfMonthsAgo = nowTs - Math.floor(11.5 * 30 * 24 * 3600)
    insertUser(db, { username: 'bald_inaktiv', lastLoginAt: elevenHalfMonthsAgo, email: 'bald@schule.de' })

    // Konto ohne E-Mail (kein Erinnerungs-Mail moeglich)
    insertUser(db, { username: 'kein_mail', lastLoginAt: elevenHalfMonthsAgo, email: null })

    const sent = await runInactivityReminderJob({ db, mail, siteUrl: 'https://test.de' }, now)

    expect(sent).toBe(1)
    expect(mail.sent.length).toBe(1)
    expect(mail.sent[0]!.to).toBe('bald@schule.de')
    expect(mail.sent[0]!.subject).toContain('geloescht')

    db.close()
  })
})

describe('Cleanup-Jobs', () => {
  it('loescht abgelaufene Sitzungen', () => {
    const db = testDb()
    const now = Date.now()
    const nowTs = Math.floor(now / 1000)

    // User anlegen
    const user = db.prepare(
      "INSERT INTO users (username, display_name, role, password_hash, created_day) VALUES ('s1', 's1', 'student', 'h', '2024-01-01')"
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
      "INSERT INTO users (username, display_name, role, password_hash, created_day) VALUES ('s2', 's2', 'student', 'h', '2024-01-01')"
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
