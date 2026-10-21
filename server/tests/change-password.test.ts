/**
 * POST /api/me/password: Passwort aendern
 * - aktuelles Passwort erforderlich
 * - neuer Hash bleibt an Benutzername + Erstellungstag gebunden (K3)
 * - must_change_password wird zurueckgesetzt
 * - andere Sitzungen werden beendet
 */
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'
import { InMemoryMailSender } from '../src/mail.js'
import { testDb } from './helpers.js'

async function setup() {
  const db = testDb()
  const app = await buildApp({ db, mail: new InMemoryMailSender(), skipCsrf: true })
  await app.ready()
  return { db, app }
}

function cookieOf(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'] as string | string[]
  return (Array.isArray(raw) ? raw[0] : raw).split(';')[0]
}

const json = { 'content-type': 'application/json' }

describe('POST /api/me/password', () => {
  it('aendert Passwort nur mit aktuellem Passwort und beendet andere Sitzungen', async () => {
    const { db, app } = await setup()
    const reg = await app.inject({
      method: 'POST', url: '/api/register', headers: json,
      body: JSON.stringify({ role: 'student', username: 'pwtest', display_name: 'P', password: 'altesPasswort1' }),
    })
    expect(reg.statusCode).toBe(201)
    const c1 = cookieOf(reg)
    const login2 = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: 'pwtest', password: 'altesPasswort1' }),
    })
    const c2 = cookieOf(login2)

    const wrong = await app.inject({
      method: 'POST', url: '/api/me/password', headers: { ...json, cookie: c1 },
      body: JSON.stringify({ current_password: 'falsch', new_password: 'neuesPasswort1' }),
    })
    expect(wrong.statusCode).toBe(403)

    const short = await app.inject({
      method: 'POST', url: '/api/me/password', headers: { ...json, cookie: c1 },
      body: JSON.stringify({ current_password: 'altesPasswort1', new_password: 'kurz' }),
    })
    expect(short.statusCode).toBe(400)

    db.prepare("UPDATE users SET must_change_password = 1 WHERE username = 'pwtest'").run()
    const ok = await app.inject({
      method: 'POST', url: '/api/me/password', headers: { ...json, cookie: c1 },
      body: JSON.stringify({ current_password: 'altesPasswort1', new_password: 'neuesPasswort1' }),
    })
    expect(ok.statusCode).toBe(200)

    const flag = db.prepare("SELECT must_change_password FROM users WHERE username = 'pwtest'").get() as { must_change_password: number }
    expect(flag.must_change_password).toBe(0)

    // eigene Sitzung bleibt, andere ist beendet
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: c1 } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: c2 } })).statusCode).toBe(401)

    const oldLogin = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: 'pwtest', password: 'altesPasswort1' }),
    })
    expect(oldLogin.statusCode).toBe(401)
    const newLogin = await app.inject({
      method: 'POST', url: '/api/login', headers: json,
      body: JSON.stringify({ login: 'pwtest', password: 'neuesPasswort1' }),
    })
    expect(newLogin.statusCode).toBe(200)

    await app.close()
    db.close()
  }, 60_000)
})
