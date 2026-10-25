/**
 * K7: Bestätigung der E-Mail-Adresse von Lehrkräften
 * - Registrierung einer Lehrkraft verschickt einen Link an die angegebene Adresse
 * - Token ist einmalig nutzbar und nur als SHA-256 gespeichert
 * - /api/me zeigt email_verified_at
 * - Schüler (Klassen-Login) bekommen keine Bestätigungsmail
 */
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb, registerTeacher, createClass, joinStudent } from './helpers.js'

const json = { 'content-type': 'application/json' }

describe('K7: E-Mail-Bestätigung Lehrkraft', () => {
  it('verschickt Link, bestätigt einmalig, speichert nur den Hash', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const app = await buildApp({ db, mail, skipCsrf: true, siteUrl: 'https://www.tabulasql.de' })
    await app.ready()

    const teacher = await registerTeacher(app, 'vera@schule.de', 'sicheresPasswort1', 'Vera V')
    const c = teacher.cookie

    expect(mail.sent.length).toBe(1)
    expect(mail.sent[0].to).toBe('vera@schule.de')
    const m = mail.sent[0].text.match(/email-bestaetigen\?token=([a-f0-9]{64})/)
    expect(m).not.toBeNull()
    const token = m![1]

    // Nur Hash in der DB, nie der Klartext
    const rows = db.prepare('SELECT token_hash FROM email_verifications').all() as { token_hash: string }[]
    expect(rows.length).toBe(1)
    expect(rows[0].token_hash).not.toBe(token)

    let me = JSON.parse((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: c } })).body)
    expect(me.user.email_verified_at).toBeNull()

    const ok = await app.inject({ method: 'POST', url: '/api/email/verify', headers: json, body: JSON.stringify({ token }) })
    expect(ok.statusCode).toBe(200)
    me = JSON.parse((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: c } })).body)
    expect(typeof me.user.email_verified_at).toBe('number')

    // Zweite Nutzung schlägt fehl
    const again = await app.inject({ method: 'POST', url: '/api/email/verify', headers: json, body: JSON.stringify({ token }) })
    expect(again.statusCode).toBe(400)

    // Schon bestätigt: resend verschickt nichts mehr
    const before = mail.sent.length
    const r = await app.inject({ method: 'POST', url: '/api/email/resend', headers: { cookie: c } })
    expect(JSON.parse(r.body).already).toBe(true)
    expect(mail.sent.length).toBe(before)

    await app.close()
    db.close()
  }, 60_000)

  it('Schueler (Klassen-Login) bekommen keine Bestätigungsmail', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const app = await buildApp({ db, mail, skipCsrf: true })
    await app.ready()

    // Lehrkraft registrieren (verschickt 1 Mail)
    const teacher = await registerTeacher(app, 'lehrer-verify@schule.de', 'sicheresPasswort1', 'Herr Lehrer')
    const sentAfterTeacher = mail.sent.length
    expect(sentAfterTeacher).toBe(1)

    // Klasse anlegen und Schueler beitreten lassen
    const cls = await createClass(app, teacher.cookie, 'VerifyKlasse')
    await joinStudent(app, cls.code, 'Schueler Mustermann', 'schuelerPw1')

    // Kein weiteres Mail fuer den Schueler
    expect(mail.sent.length).toBe(sentAfterTeacher)

    await app.close()
    db.close()
  }, 60_000)
})
