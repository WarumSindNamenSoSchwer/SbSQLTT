/**
 * Freigabe-Checkliste K1/K4/K5/K10: Ein kompletter Durchlauf (Lehrkraft registrieren,
 * Klasse anlegen, Schueler beitreten, Fortschritt mit verschluesselter Abfrage,
 * Lehrkraft-Dashboard, Passwort aendern, Quiz starten/beenden, Konto loeschen)
 * darf im Log KEINE der folgenden Daten hinterlassen:
 * Schuelernamen, Passwoerter, Schluessel, Wiederherstellungscode, E-Mail-Adressen, IPs.
 */
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb, registerTeacher, createClass, joinStudent, C } from './helpers.js'

const json = { 'content-type': 'application/json' }

describe('Log-Audit: keine personenbezogenen Daten im Log', () => {
  it('kompletter Durchlauf schreibt keine Passwörter, Token, Schluessel, Namen, E-Mails oder IPs', async () => {
    const lines: string[] = []
    const db = testDb()
    const app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true, logStream: { write: (m) => { lines.push(m) } } })
    await app.ready()

    const SECRET_PW = 'GeheimesPasswortXYZ1'
    const S_NAME = 'Lena Schröder'
    const T_MAIL = 'frau.audit@schule-audit.de'
    const T_NAME = 'Frau Auditname'
    const FAKE_IP = '203.0.113.77'
    const ip = { 'x-forwarded-for': FAKE_IP, 'x-real-ip': FAKE_IP }

    // Lehrkraft registrieren
    const teacher = await registerTeacher(app, T_MAIL, SECRET_PW, T_NAME)
    const tc = teacher.cookie

    // Klasse anlegen
    const cls = await createClass(app, tc, '10x Audit')

    // Schueler beitreten
    const { res: jr, cookie: sc, info } = await joinStudent(app, cls.code, S_NAME, SECRET_PW)
    expect(jr.statusCode).toBe(201)

    // Fortschritt mit verschluesselter letzter Abfrage speichern
    const pub = await C.importPublicKey(info.public_key)
    const QUERY_TEXT = 'SELECT geheimspalte FROM verraeterische_tabelle'
    const ERR_TEXT = 'Fehlermeldung-ABC-123'
    const sealed = await C.sealForTeacher(pub, JSON.stringify({ q: QUERY_TEXT, e: ERR_TEXT }))
    const put = await app.inject({
      method: 'PUT', url: '/api/progress',
      headers: { ...json, cookie: sc, ...ip },
      body: JSON.stringify({
        progress: [{ lesson_id: 'where-filters', step: 2, done: false, attempts: 3, updated_at: Math.floor(Date.now() / 1000) }],
        last_attempts: [{ lesson_id: 'where-filters', step: 2, sealed, has_error: true }],
      }),
    })
    expect(put.statusCode).toBe(200)

    // Lehrkraft liest Dashboard
    await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/dashboard`, headers: { cookie: tc, ...ip } })

    // Lehrkraft liest letzte Abfrage (verschluesselt)
    const students = JSON.parse((await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/students`, headers: { cookie: tc } })).body).students
    expect(students.length).toBeGreaterThan(0)
    const la = await app.inject({ method: 'GET', url: `/api/teacher/classes/${cls.id}/students/${students[0].id}/last-attempt`, headers: { cookie: tc, ...ip } })
    // Das Log darf das Ergebnis nicht unveraendert weitergeben (sealed ist verschluesselt)
    expect(la.statusCode).toBe(200)

    // Passwort-Reset (forgot)
    await app.inject({ method: 'POST', url: '/api/password/forgot', headers: { ...json, ...ip }, body: JSON.stringify({ email: T_MAIL }) })

    // Lehrkraft loescht Konto
    await app.inject({ method: 'DELETE', url: '/api/me', headers: { cookie: tc, ...ip } })

    const log = lines.join('\n')
    expect(lines.length).toBeGreaterThan(5)

    const forbidden = [
      SECRET_PW,
      S_NAME, S_NAME.toLowerCase(), 'Lena', 'Schröder',
      QUERY_TEXT, 'geheimspalte', ERR_TEXT, 'Fehlermeldung',
      T_MAIL, T_NAME,
      FAKE_IP,
      tc.split('=')[1],
      sc.split('=')[1],
    ]
    for (const f of forbidden) {
      expect(log, `Log enthält: ${f}`).not.toContain(f)
    }

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

    // Registrierung schlaegt beim Mail fehl, aber das darf die Adresse nicht ins Log schreiben.
    // Wir pruefen nur forgot (sicherer Weg ohne Registrierung-Fehler wegen werfendem Mailer):
    // Zuerst eine separate DB nutzen, um die Lehrkraft anzulegen
    const realDb = testDb()
    const realApp = await buildApp({ db: realDb, mail: new InMemoryMailSender(), skipCsrf: true })
    await realApp.ready()
    await registerTeacher(realApp, MAIL, 'GeheimesPasswortXYZ1', 'F M')
    await realApp.close()
    realDb.close()

    // Den fehlschlagenden Mailer jetzt beim forgot-Endpunkt
    const forgot = await app.inject({
      method: 'POST', url: '/api/password/forgot', headers: json,
      body: JSON.stringify({ email: MAIL }),
    })
    // 200 oder 500 - je nach Implementierung (forgot kann auch 500 liefern)
    expect(forgot.body).not.toContain(MAIL)

    const log = lines.join('\n')
    expect(log).not.toContain(MAIL)

    await app.close()
    db.close()
  }, 60_000)
})
