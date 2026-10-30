/**
 * Fastify-App-Factory.
 *
 * Pino-Logger mit redact-Konfiguration (K3, K10):
 * - Passwortfelder werden niemals protokolliert
 * - Keine Request-Bodies im Log
 * - Log-Level: info
 */
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import type { Db } from './db.js'
import type { MailSender } from './mail.js'
import { createRateLimiters } from './plugins/ratelimit.js'
import authRoutes from './routes/auth.js'
import emailVerifyRoutes from './routes/email-verify.js'
import passwordRoutes from './routes/password.js'
import progressRoutes from './routes/progress.js'
import classLoginRoutes from './routes/class-login.js'
import teacherRoutes from './routes/teacher.js'
import studentClassesRoutes from './routes/student-classes.js'
import quizRoutes from './routes/quiz.js'
import quizWsPlugin from './routes/quiz-ws.js'

export interface AppConfig {
  db: Db
  mail: MailSender
  /** https://app.tabulasql.de (die App; die Website www.* ruft die Konten-API nicht auf) */
  allowedOrigin?: string
  siteUrl?: string
  /** Nur fuer Tests: true deaktiviert den Origin-Check */
  skipCsrf?: boolean
  /** Nur fuer Tests: Log-Ausgabe in diesen Stream schreiben (Pruefung "nichts Persoenliches im Log") */
  logStream?: { write(msg: string): void }
}

export async function buildApp(cfg: AppConfig) {
  const allowedOrigin = cfg.allowedOrigin ?? process.env['ALLOWED_ORIGIN'] ?? 'https://app.tabulasql.de'
  const siteUrl = cfg.siteUrl ?? process.env['SITE_URL'] ?? 'https://app.tabulasql.de'

  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      ...(cfg.logStream ? { stream: cfg.logStream } : {}),
      redact: {
        // Passwortfelder und Token aus Log-Ausgaben entfernen (K3, K10)
        paths: [
          'req.body.password',
          'req.body.current_password',
          'req.body.new_password',
          'req.body.token',
          'req.body.key',
          'req.body.old_key',
          'req.body.new_key',
          'req.body.reset_code',
          'req.headers.authorization',
          'req.headers.cookie',
        ],
        censor: '[ENTFERNT]',
      },
      // Request-Bodies nicht protokollieren
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            // Keine IP-Adressen speichern (K10) - nur gekuerzte Variante
            // (Caddy kuerzt auf /24 bzw. /48 vor Weitergabe)
          }
        },
        res(res) {
          return { statusCode: res.statusCode }
        },
      },
    },
  })

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  await app.register(fastifyCookie)

  // Unerwartete Fehler: nur Fehlerart protokollieren, keine Meldung (sie kann z. B. bei
  // SMTP-Fehlern eine E-Mail-Adresse enthalten, K10). Antwort ohne Interna.
  app.setErrorHandler((err: Error & { statusCode?: number; code?: string; validation?: unknown }, req, reply) => {
    const status = err.statusCode ?? 500
    if (status >= 500) req.log.error({ event: 'unhandled_error', type: err.name, code: err.code ?? null }, 'Fehler')
    if (status < 500 && err.validation) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    }
    reply.code(status >= 400 ? status : 500).send({ fehler: status >= 500 ? 'Interner Fehler. Bitte später erneut versuchen.' : 'Anfrage nicht möglich.' })
  })

  // CSRF-Origin-Check fuer schreibende Anfragen
  if (!cfg.skipCsrf) {
    const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT'])
    app.addHook('onRequest', async (request, reply) => {
      if (!WRITE_METHODS.has(request.method)) return
      // Health-Endpunkt ausnehmen
      if (request.url === '/api/health') return

      const origin = request.headers['origin']
      if (!origin || origin !== allowedOrigin) {
        reply.code(403).send({ fehler: 'Ungültige Herkunft (Origin).' })
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Rate-Limiters
  // ---------------------------------------------------------------------------

  const limits = createRateLimiters()

  // ---------------------------------------------------------------------------
  // Routen unter /api
  // ---------------------------------------------------------------------------

  await app.register(async (api) => {
    // Gesundheitspruefung
    api.get('/health', async () => ({ ok: true }))

    // Auth-Routen
    await api.register(authRoutes, { db: cfg.db, mail: cfg.mail, limits, siteUrl })

    // E-Mail-Bestaetigung fuer Lehrkraefte (K7): POST /api/email/verify, /api/email/resend
    await api.register(emailVerifyRoutes, { db: cfg.db, mail: cfg.mail, siteUrl })

    // Passwort-Routen unter /api/password/...
    await api.register(async (pwApi) => {
      await pwApi.register(passwordRoutes, { db: cfg.db, mail: cfg.mail, limits, siteUrl })
    }, { prefix: '/password' })

    // Fortschritt unter /api/progress (GET, PUT)
    await api.register(progressRoutes, { db: cfg.db })
    // Klassen-Login der Schüler (K1): /api/class-login/*, /api/student/*
    await api.register(classLoginRoutes, { db: cfg.db })
    // Schüler-Klasse mit Fokus und Lektionen: GET /api/classes/mine
    await api.register(async (classApi) => {
      await classApi.register(studentClassesRoutes, { db: cfg.db })
    }, { prefix: '/classes' })

    // Lehrkraft-API unter /api/teacher
    await api.register(async (teacherApi) => {
      await teacherApi.register(teacherRoutes, { db: cfg.db })
    }, { prefix: '/teacher' })

    // Quiz: REST unter /api/teacher/quizzes und /api/teacher/quiz-sessions
    await api.register(async (teacherApi) => {
      await teacherApi.register(quizRoutes, { db: cfg.db })
    }, { prefix: '/teacher' })

    // Quiz: WebSocket unter /api/quiz/ws
    await api.register(async (quizApi) => {
      await quizApi.register(quizWsPlugin, {
        db: cfg.db,
        allowedOrigin,
        skipOriginCheck: cfg.skipCsrf,
      })
    }, { prefix: '/quiz' })
  }, { prefix: '/api' })

  return app
}
