/**
 * Freigabe-Checkliste K3/K4/K5/K10: Ein kompletter Durchlauf (Registrieren, Anmelden,
 * Passwort ändern, Fortschritt mit Abfrage + Fehlermeldung, Klasse, Lehrkraft-Dashboard,
 * letzte Abfrage, Konto löschen) darf im Log KEINE der folgenden Daten hinterlassen:
 * Passwörter, Sitzungs-Token, SQL-Abfragetexte, Fehlermeldungen der Schüler,
 * E-Mail-Adressen, Anzeigenamen, Benutzernamen, IP-Adressen.
 */
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb } from './helpers.js'

const json = { 'content-type': 'application/json' }
const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers['set-cookie'] as string | string[]
  return (Array.isArray(raw) ? raw[0] : raw).split(';')[0]
}

describe('Log-Audit: keine personenbezogenen Daten im Log', () => {
  it('kompletter Durchlauf schreibt keine Passwörter, Token, Abfragen, Namen, E-Mails oder IPs', async () => {
    const lines: string[] = []
    const db = testDb()
    const app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true, logStream: { write: (m) => { lines.push(m) } } })
    await app.ready()

    const SECRET_PW = 'GeheimesPasswortXYZ1'
    const NEW_PW = 'NochGeheimer987'
    const QUERY = 'SELECT geheimspalte FROM verraeterische_tabelle'
    const ERR = 'Fehlermeldung-ABC-123'
    const T_MAIL = 'frau.audit@schule-audit.de'
    const T_NAME = 'Frau Auditname'
    const S_NAME = 'Schuelerin Auditname'
    const S_USER = 'auditschueler'
    const FAKE_IP = '203.0.113.77'
    const ip = { 'x-forwarded-for': FAKE_IP, 'x-real-ip': FAKE_IP }

    const t = await app.inject({ method: 'POST', url: '/api/register', headers: { ...json, ...ip },
      body: JSON.stringify({ role: 'teacher', username: 'auditlehrer', display_name: T_NAME, name: T_NAME, email: T_MAIL, password: SECRET_PW, terms_accepted: true }) })
    expect(t.statusCode).toBe(201)
    const tc = cookieOf(t)
    const cls = JSON.parse((await app.inject({ method: 'POST', url: '/api/teacher/classes', headers: { ...json, cookie: tc, ...ip }, body: JSON.stringify({ name: '10x' }) })).body).class

    const s = await app.inject({ method: 'POST', url: '/api/register', headers: { ...json, ...ip },
      body: JSON.stringify({ role: 'student', username: S_USER, display_name: S_NAME, password: SECRET_PW }) })
    const sc = cookieOf(s)
    await app.inject({ method: 'POST', url: '/api/login', headers: { ...json, ...ip }, body: JSON.stringify({ login: S_USER, password: 'falschesPasswort' }) })
    await app.inject({ method: 'POST', url: '/api/login', headers: { ...json, ...ip }, body: JSON.stringify({ login: S_USER, password: SECRET_PW }) })
    expect((await app.inject({ method: 'POST', url: '/api/classes/join', headers: { ...json, cookie: sc, ...ip }, body: JSON.stringify({ code: cls.join_code }) })).statusCode).toBe(200)
    await app.inject({ method: 'PUT', url: '/api/progress', headers: { ...json, cookie: sc, ...ip }, body: JSON.stringify({
      progress: [{ lesson_id: 'where-filters', step: 2, done: false, attempts: 3, updated_at: Math.floor(Date.now() / 1000) }],
      last_attempts: [{ lesson_id: 'where-filters', step: 2, query: QUERY, error_msg: ERR }],
    }) })
    await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/dashboard`, headers: { cookie: tc, ...ip } })
    const uid = (db.prepare('SELECT id FROM users WHERE username = ?').get(S_USER) as { id: number }).id
    const la = await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/students/${uid}/last-attempt`, headers: { cookie: tc, ...ip } })
    expect(la.body).toContain('geheimspalte') // Lehrkraft sieht sie (K4), das Log nicht
    await app.inject({ method: 'POST', url: '/api/me/password', headers: { ...json, cookie: sc, ...ip }, body: JSON.stringify({ current_password: SECRET_PW, new_password: NEW_PW }) })
    await app.inject({ method: 'POST', url: '/api/password/forgot', headers: { ...json, ...ip }, body: JSON.stringify({ email: T_MAIL }) })
    await app.inject({ method: 'DELETE', url: '/api/me', headers: { cookie: sc, ...ip } })

    const log = lines.join('\n')
    expect(lines.length).toBeGreaterThan(10)
    const forbidden = [SECRET_PW, NEW_PW, 'geheimspalte', 'verraeterische', ERR, T_MAIL, T_NAME, S_NAME, S_USER, FAKE_IP,
      tc.split('=')[1], sc.split('=')[1]]
    for (const f of forbidden) expect(log, `Log enthält: ${f}`).not.toContain(f)
    // Kein Remote-Adressfeld
    expect(log).not.toMatch(/"remoteAddress"|"remotePort"|"ip"\s*:/)

    await app.close()
    db.close()
  }, 60_000)

  it('fehlschlagender Mailversand schreibt keine E-Mail-Adresse ins Log', async () => {
    const lines: string[] = []
    const db = testDb()
    const failing = { send: async (m: { to: string }) => { throw new Error(`Mailbox unavailable: ${m.to}`) } }
    const app = await buildApp({ db, mail: failing as never, skipCsrf: true, logStream: { write: (m) => { lines.push(m) } } })
    await app.ready()
    const MAIL = 'geheim.adresse@schule-audit.de'
    const reg = await app.inject({ method: 'POST', url: '/api/register', headers: json, body: JSON.stringify({
      role: 'teacher', username: 'failmail', display_name: 'F', name: 'F M', email: MAIL, password: 'GeheimesPasswortXYZ1', terms_accepted: true }) })
    expect(reg.statusCode).toBe(201) // Registrierung klappt trotz Mailfehler
    const forgot = await app.inject({ method: 'POST', url: '/api/password/forgot', headers: json, body: JSON.stringify({ email: MAIL }) })
    expect(forgot.statusCode).toBe(500)
    expect(forgot.body).not.toContain(MAIL)
    const log = lines.join('\n')
    expect(log).not.toContain(MAIL)
    expect(log).toContain('unhandled_error')
    await app.close()
    db.close()
  }, 60_000)
})
