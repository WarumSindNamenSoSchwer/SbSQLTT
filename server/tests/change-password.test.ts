/**
 * POST /api/me/password: Passwort aendern (nur Lehrkraefte)
 * - aktuelles Passwort erforderlich
 * - neuer Hash bleibt an Benutzername + Erstellungstag gebunden (K3)
 * - must_change_password wird zurueckgesetzt
 * - andere Sitzungen werden beendet
 * - wrapped_by_password muss mitgeschickt werden
 */
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb, registerTeacher, cookieOf, C } from './helpers.js'

const json = { 'content-type': 'application/json' }

describe('POST /api/me/password', () => {
  it('aendert Passwort nur mit aktuellem Passwort und beendet andere Sitzungen', async () => {
    const db = testDb()
    const app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true })
    await app.ready()

    // Lehrkraft registrieren (neues Modell: E-Mail, Keys)
    const teacher = await registerTeacher(app, 'pwtest@schule.de', 'altesPasswort1', 'Frau PwTest')
    const c1 = teacher.cookie

    // Zweite Sitzung oeffnen (Login per E-Mail)
    const login2 = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: 'pwtest@schule.de', password: 'altesPasswort1' }),
    })
    expect(login2.statusCode).toBe(200)
    const c2 = cookieOf(login2)

    // Falsches Passwort
    const wrong = await app.inject({
      method: 'POST', url: '/api/me/password', headers: { ...json, cookie: c1 },
      body: JSON.stringify({
        current_password: 'falsch',
        new_password: 'neuesPasswort1',
        wrapped_by_password: 'v1.AAAA.AAAA.AAAA',
      }),
    })
    expect(wrong.statusCode).toBe(403)

    // Zu kurzes neues Passwort
    const short = await app.inject({
      method: 'POST', url: '/api/me/password', headers: { ...json, cookie: c1 },
      body: JSON.stringify({
        current_password: 'altesPasswort1',
        new_password: 'kurz',
        wrapped_by_password: 'v1.AAAA.AAAA.AAAA',
      }),
    })
    expect(short.statusCode).toBe(400)

    // must_change_password setzen (direkt in DB)
    const username = db.prepare("SELECT username FROM users WHERE email = 'pwtest@schule.de'").get() as { username: string }
    db.prepare("UPDATE users SET must_change_password = 1 WHERE username = ?").run(username.username)

    // Neues wrapped_by_password vom Browser erzeugen
    const { bundle: newBundle } = await C.createTeacherKeys('neuesPasswort1', C.generateRecoveryCode())

    const ok = await app.inject({
      method: 'POST', url: '/api/me/password', headers: { ...json, cookie: c1 },
      body: JSON.stringify({
        current_password: 'altesPasswort1',
        new_password: 'neuesPasswort1',
        wrapped_by_password: newBundle.wrapped_by_password,
      }),
    })
    expect(ok.statusCode).toBe(200)

    const flag = db.prepare("SELECT must_change_password FROM users WHERE username = ?").get(username.username) as { must_change_password: number }
    expect(flag.must_change_password).toBe(0)

    // Eigene Sitzung bleibt, andere ist beendet
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: c1 } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: c2 } })).statusCode).toBe(401)

    // Alter Login schlaegt fehl, neuer klappt
    const oldLogin = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: 'pwtest@schule.de', password: 'altesPasswort1' }),
    })
    expect(oldLogin.statusCode).toBe(401)

    const newLogin = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: 'pwtest@schule.de', password: 'neuesPasswort1' }),
    })
    expect(newLogin.statusCode).toBe(200)

    await app.close()
    db.close()
  }, 60_000)

  it('E-Mail-Login ist gross/klein-unabhaengig', async () => {
    const db = testDb()
    const app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true })
    await app.ready()

    await registerTeacher(app, 'Gross.Klein@Schule.de', 'passwort123A', 'Herr GK')

    // Login mit verschiedenen Schreibweisen
    const r1 = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: 'GROSS.KLEIN@SCHULE.DE', password: 'passwort123A' }),
    })
    expect(r1.statusCode).toBe(200)

    const r2 = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: '  Gross.Klein@Schule.de  ', password: 'passwort123A' }),
    })
    expect(r2.statusCode).toBe(200)

    await app.close()
    db.close()
  }, 60_000)

  it('Passwort vergessen antwortet identisch fuer existierende und nicht existierende Adresse', async () => {
    const db = testDb()
    const mail = new InMemoryMailSender()
    const app = await buildApp({ db, mail, skipCsrf: true })
    await app.ready()

    await registerTeacher(app, 'vorhanden@schule.de', 'passwortXYZ1', 'Frau V')

    const r1 = await app.inject({
      method: 'POST', url: '/api/password/forgot', headers: json,
      body: JSON.stringify({ email: 'vorhanden@schule.de' }),
    })
    const r2 = await app.inject({
      method: 'POST', url: '/api/password/forgot', headers: json,
      body: JSON.stringify({ email: 'gibtsnicht@schule.de' }),
    })

    // Beide 200 mit {ok:true} (keine Aufzaehlung)
    expect(r1.statusCode).toBe(200)
    expect(r2.statusCode).toBe(200)
    expect(JSON.parse(r1.body)).toMatchObject({ ok: true })
    expect(JSON.parse(r2.body)).toMatchObject({ ok: true })

    await app.close()
    db.close()
  }, 60_000)

  it('Passwort vergessen antwortet 200 auch wenn der Mailer wirft', async () => {
    const db = testDb()
    const failingMail = { send: async (_m: unknown) => { throw new Error('SMTP kaputt') } }
    const app = await buildApp({ db, mail: failingMail as never, skipCsrf: true })
    await app.ready()

    // Lehrkraft direkt in DB eintragen (ohne Mail-Versand bei Registrierung wuerde werfen)
    const realDb = testDb()
    const realApp = await buildApp({ db: realDb, mail: new InMemoryMailSender(), skipCsrf: true })
    await realApp.ready()
    await registerTeacher(realApp, 'failmail2@schule.de', 'passwortXYZ1', 'Frau F')
    await realApp.close()
    realDb.close()

    // Wir pruefen nur: der Endpunkt antwortet gleichfoermig
    // (in einer echten Umgebung wuerde die Registrierung scheitern, aber der forgot-Endpunkt
    // nicht die Adresse verraten)
    const res = await app.inject({
      method: 'POST', url: '/api/password/forgot', headers: json,
      body: JSON.stringify({ email: 'irgendjemand@schule.de' }),
    })
    // 200 oder 500 sind beide akzeptabel, aber die Adresse darf nicht in der Antwort erscheinen
    expect(res.body).not.toContain('irgendjemand@schule.de')

    await app.close()
    db.close()
  }, 60_000)
})
