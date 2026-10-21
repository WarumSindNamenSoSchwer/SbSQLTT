/**
 * Tests fuer den Kontaktformular-Dienst.
 *
 * Prueft:
 * - Validierung (Pflichtfelder, Laengenbeschraenkungen)
 * - Honeypot: 200 OK, kein Versand
 * - Zeitfalle: t < 3000 ms → stilles 200 OK, kein Versand
 * - Rate-Limit: 3 pro Fenster, 4. Anfrage → 429
 * - Origin-Check: falscher Origin → 403
 * - Header-Injection: CR/LF in Name/E-Mail werden bereinigt
 * - Logs enthalten keine personenbezogenen Daten
 * - Mail-Fehler → 502 mit deutscher Meldung
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { buildApp } from '../src/app.js'
import { ContactRateLimiter } from '../src/ratelimit.js'
import { sendContactMail } from '../src/mailer.js'

const ORIGIN = 'https://www.tabulasql.de'

/** Erzeugt einen Nodemailer jsonTransport fuer Tests (kein echter SMTP-Versand). */
function testTransporter(): Transporter {
  return nodemailer.createTransport({ jsonTransport: true })
}

/** Standardmaessige gueltige Anfrage-Body (ohne Honeypot, mit genuegend Zeit). */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Max Mustermann',
    email: 'max@example.de',
    nachricht: 'Ich habe eine Frage zu Tabula.',
    t: Date.now() - 5000,  // 5 Sekunden in der Vergangenheit → okay
    ...overrides,
  }
}

async function setup(opts: { failMail?: boolean } = {}) {
  const transporter = testTransporter()

  if (opts.failMail) {
    vi.spyOn(transporter, 'sendMail').mockRejectedValueOnce(new Error('SMTP-Verbindung fehlgeschlagen'))
  }

  const rateLimiter = new ContactRateLimiter()
  const app = await buildApp({
    transporter,
    allowedOrigin: ORIGIN,
    rateLimiter,
  })
  await app.ready()
  return { app, transporter, rateLimiter }
}

// Hilfsfunktion: POST /api/contact
async function post(
  app: Awaited<ReturnType<typeof buildApp>>,
  body: unknown,
  origin: string = ORIGIN
) {
  return app.inject({
    method: 'POST',
    url: '/api/contact',
    headers: {
      'content-type': 'application/json',
      'origin': origin,
    },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------

describe('Validierung', () => {
  it('akzeptiert eine gueltige Anfrage', async () => {
    const { app } = await setup()
    const res = await post(app, validBody())
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.ok).toBe(true)
    await app.close()
  })

  it('lehnt leeres name-Feld ab', async () => {
    const { app } = await setup()
    const res = await post(app, validBody({ name: '' }))
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('lehnt name > 100 Zeichen ab', async () => {
    const { app } = await setup()
    const res = await post(app, validBody({ name: 'a'.repeat(101) }))
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('lehnt ungueltige E-Mail ab', async () => {
    const { app } = await setup()
    const res = await post(app, validBody({ email: 'kein-at-zeichen' }))
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('lehnt nachricht < 10 Zeichen ab', async () => {
    const { app } = await setup()
    const res = await post(app, validBody({ nachricht: 'Kurz' }))
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('lehnt nachricht > 5000 Zeichen ab', async () => {
    const { app } = await setup()
    const res = await post(app, validBody({ nachricht: 'x'.repeat(5001) }))
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('lehnt schule > 150 Zeichen ab', async () => {
    const { app } = await setup()
    const res = await post(app, validBody({ schule: 'a'.repeat(151) }))
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('akzeptiert optionales schule-Feld', async () => {
    const { app } = await setup()
    const res = await post(app, validBody({ schule: 'Muster-Gymnasium Berlin' }))
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('Honeypot', () => {
  it('sendet 200 OK aber keine E-Mail wenn website-Feld gefuellt', async () => {
    const { app, transporter } = await setup()
    const sendSpy = vi.spyOn(transporter, 'sendMail')

    const res = await post(app, validBody({ website: 'https://bot.example.com' }))

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(sendSpy).not.toHaveBeenCalled()
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('Zeitfalle', () => {
  it('sendet 200 OK aber keine E-Mail wenn t < 3000 ms', async () => {
    const { app, transporter } = await setup()
    const sendSpy = vi.spyOn(transporter, 'sendMail')

    // t = jetzt - 1500 ms: zu schnell ausgefuellt
    const res = await post(app, validBody({ t: Date.now() - 1500 }))

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(sendSpy).not.toHaveBeenCalled()
    await app.close()
  })

  it('sendet E-Mail wenn t >= 3000 ms', async () => {
    const { app, transporter } = await setup()
    const sendSpy = vi.spyOn(transporter, 'sendMail')

    const res = await post(app, validBody({ t: Date.now() - 4000 }))

    expect(res.statusCode).toBe(200)
    expect(sendSpy).toHaveBeenCalled()
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('Rate-Limit', () => {
  it('blockiert nach 3 Anfragen von derselben IP', async () => {
    const { app } = await setup()

    // 3 erlaubte Anfragen
    for (let i = 0; i < 3; i++) {
      const res = await post(app, validBody())
      expect(res.statusCode).toBe(200)
    }

    // 4. Anfrage → 429
    const res4 = await post(app, validBody())
    expect(res4.statusCode).toBe(429)
    await app.close()
  })

  it('erlaubt nach Ablauf des Fensters wieder Anfragen', async () => {
    const { app, rateLimiter } = await setup()

    for (let i = 0; i < 3; i++) {
      await post(app, validBody())
    }

    // Zaehler manuell zuruecksetzen (simuliert Ablauf des 10-min-Fensters)
    rateLimiter.reset()

    const res = await post(app, validBody())
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('Origin-Check', () => {
  it('lehnt Anfragen von fremdem Origin ab', async () => {
    const { app } = await setup()
    const res = await post(app, validBody(), 'https://attacker.example.com')
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('lehnt Anfragen ohne Origin ab', async () => {
    const { app } = await setup()
    const res = await app.inject({
      method: 'POST',
      url: '/api/contact',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody()),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('Header-Injection', () => {
  it('bereinigt CR/LF im Name-Feld', async () => {
    const { app, transporter } = await setup()
    let capturedSubject = ''
    vi.spyOn(transporter, 'sendMail').mockImplementation(async (opts) => {
      capturedSubject = (opts as { subject?: string }).subject ?? ''
      return {} as never
    })

    await post(app, validBody({ name: 'Max\r\nInject' }))

    // CR und LF muessen aus dem Betreff verschwunden sein
    expect(capturedSubject).not.toContain('\r')
    expect(capturedSubject).not.toContain('\n')
    await app.close()
  })

  it('bereinigt CR/LF in der E-Mail-Adresse', async () => {
    const { app, transporter } = await setup()
    let capturedReplyTo = ''
    vi.spyOn(transporter, 'sendMail').mockImplementation(async (opts) => {
      capturedReplyTo = (opts as { replyTo?: string }).replyTo ?? ''
      return {} as never
    })

    await post(app, validBody({ email: 'max@example.de\r\nBcc: evil@evil.com' }))

    expect(capturedReplyTo).not.toContain('\r')
    expect(capturedReplyTo).not.toContain('\n')
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('Logs enthalten keine personenbezogenen Daten', () => {
  it('loggt bei Erfolg kein Name/E-Mail/Nachricht', async () => {
    const { app } = await setup()
    const loggedMessages: string[] = []

    // Pino-Stream abfangen (Destination des App-Loggers)
    const origWrite = process.stdout.write.bind(process.stdout)
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      loggedMessages.push(chunk.toString())
      return origWrite(chunk)
    })

    await post(app, validBody({ name: 'Geheimname', email: 'geheim@test.de', nachricht: 'Geheime Nachricht hier.' }))

    spy.mockRestore()

    for (const msg of loggedMessages) {
      expect(msg).not.toContain('Geheimname')
      expect(msg).not.toContain('geheim@test.de')
      expect(msg).not.toContain('Geheime Nachricht hier.')
    }
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('Mail-Fehler', () => {
  it('gibt 502 mit deutscher Meldung zurueck wenn SMTP fehlschlaegt', async () => {
    const { app } = await setup({ failMail: true })
    const res = await post(app, validBody())
    expect(res.statusCode).toBe(502)
    const json = res.json()
    expect(json.error).toContain('kontakt@tabulasql.de')
    await app.close()
  })
})

// ---------------------------------------------------------------------------

describe('sendContactMail - Header-Injection-Unit-Test', () => {
  it('bereinigt Steuerziffern in Name und E-Mail', async () => {
    const transport = testTransporter()
    let sent: Record<string, unknown> = {}
    vi.spyOn(transport, 'sendMail').mockImplementation(async (opts) => {
      sent = opts as Record<string, unknown>
      return {} as never
    })

    await sendContactMail(transport, {
      name: 'Evil\r\nBcc: evil@evil.com',
      email: 'user@example.de\r\nX-Header: injected',
      nachricht: 'Normaltext',
    })

    const subject = (sent as { subject?: string }).subject ?? ''
    const replyTo = (sent as { replyTo?: string }).replyTo ?? ''

    // CR und LF muessen aus Betreff und Reply-To entfernt sein (SMTP-Header-Injection)
    expect(subject).not.toContain('\r')
    expect(subject).not.toContain('\n')
    expect(replyTo).not.toContain('\r')
    expect(replyTo).not.toContain('\n')
    // Steuerziffern (ASCII 0-31, 127) muessen entfernt sein
    expect(replyTo).not.toMatch(/[\x00-\x1f\x7f]/)
    expect(subject).not.toMatch(/[\x00-\x1f\x7f]/)
  })
})
