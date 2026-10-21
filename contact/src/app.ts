/**
 * Fastify-Anwendung fuer den Kontaktformular-Dienst.
 *
 * Datenschutz:
 * - Logging: nur HTTP-Status und Fehlerart, NIE Name/E-Mail/Nachricht/IP.
 * - Rate-Limit im Arbeitsspeicher: 3 pro 10 min je IP (nur als Hash).
 * - Honeypot-Feld 'website': stilles 200 OK, kein Versand.
 * - Zeitfalle: Formular-Ladezeit 't' < 3000 ms → wie Honeypot.
 * - Origin-Check: ALLOWED_ORIGIN Env-Variable.
 */
import Fastify from 'fastify'
import { z } from 'zod'
import type { Transporter } from 'nodemailer'
import { ContactRateLimiter } from './ratelimit.js'
import { sendContactMail } from './mailer.js'

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  schule: z.string().max(150).optional(),
  nachricht: z.string().min(10).max(5000),
  /** Honeypot: Roboter fuellen dieses Feld aus, Menschen nicht. */
  website: z.string().optional(),
  /**
   * Zeitstempel des Seitenladens (ms seit Epoch), vom Browser gesetzt.
   * Ausfuellen unter 3 Sekunden → Bot-Verdacht.
   */
  t: z.number().int().optional(),
})

export interface AppConfig {
  /** Nodemailer-Transporter (oder Test-Transporter) */
  transporter: Transporter
  /** Erlaubter Origin fuer CORS/Origin-Check. Default: ALLOWED_ORIGIN env oder https://www.tabulasql.de */
  allowedOrigin?: string
  /** Rate-Limiter-Instanz (zum Ueberschreiben in Tests) */
  rateLimiter?: ContactRateLimiter
}

export async function buildApp(config: AppConfig) {
  const allowedOrigin = config.allowedOrigin
    ?? process.env['ALLOWED_ORIGIN']
    ?? 'https://www.tabulasql.de'

  const rateLimiter = config.rateLimiter ?? new ContactRateLimiter()

  const app = Fastify({
    // Kein Zugriffslog (kein logger mit request-Details)
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      // Serializer: Request-Body und IP nie loggen
      serializers: {
        req(req) {
          return { method: req.method, url: req.url }
        },
        res(res) {
          return { statusCode: res.statusCode }
        },
      },
    },
  })

  app.post('/api/contact', async (request, reply) => {
    // 1. Origin-Check
    const origin = request.headers['origin'] ?? ''
    if (origin !== allowedOrigin) {
      app.log.warn({ event: 'origin_rejected' })
      return reply.status(403).send({ error: 'Nicht erlaubter Ursprung.' })
    }

    // 2. Body parsen und validieren
    const parseResult = ContactSchema.safeParse(request.body)
    if (!parseResult.success) {
      app.log.info({ event: 'validation_error' })
      return reply.status(400).send({ error: 'Ungueltige Eingabe.' })
    }

    const body = parseResult.data

    // 3. Honeypot pruefen
    if (body.website) {
      app.log.info({ event: 'honeypot_triggered' })
      return reply.status(200).send({ ok: true })
    }

    // 4. Zeitfalle pruefen (< 3000 ms seit Seitenladen)
    if (body.t != null) {
      const elapsed = Date.now() - body.t
      if (elapsed < 3000) {
        app.log.info({ event: 'timing_trap' })
        return reply.status(200).send({ ok: true })
      }
    }

    // 5. Rate-Limit (IP als Hash)
    const rawIp = (request.headers['x-real-ip'] as string | undefined)
      ?? request.socket.remoteAddress
      ?? '0.0.0.0'
    const hashedIp = ContactRateLimiter.hashIp(rawIp)

    if (!rateLimiter.check(hashedIp)) {
      app.log.warn({ event: 'rate_limited' })
      return reply.status(429).send({ error: 'Zu viele Anfragen. Bitte warte einige Minuten.' })
    }

    // 6. Mail senden
    try {
      await sendContactMail(config.transporter, {
        name: body.name,
        email: body.email,
        schule: body.schule,
        nachricht: body.nachricht,
      })
      app.log.info({ event: 'mail_sent' })
      return reply.status(200).send({ ok: true })
    } catch (err) {
      // Fehler loggen, aber keine personenbezogenen Daten
      app.log.error({ event: 'mail_error', err: err instanceof Error ? err.message : 'unbekannt' })
      return reply.status(502).send({
        error: 'Nachricht konnte nicht gesendet werden. Bitte schreib direkt an kontakt@tabulasql.de.',
      })
    }
  })

  return app
}
