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
import passwordRoutes from './routes/password.js'
import progressRoutes from './routes/progress.js'
import classesRoutes from './routes/classes.js'

export interface AppConfig {
  db: Db
  mail: MailSender
  /** https://www.tabulasql.de */
  allowedOrigin?: string
  siteUrl?: string
  /** Nur fuer Tests: true deaktiviert den Origin-Check */
  skipCsrf?: boolean
}

export async function buildApp(cfg: AppConfig) {
  const allowedOrigin = cfg.allowedOrigin ?? process.env['ALLOWED_ORIGIN'] ?? 'https://www.tabulasql.de'
  const siteUrl = cfg.siteUrl ?? process.env['SITE_URL'] ?? 'https://www.tabulasql.de'

  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      redact: {
        // Passwortfelder und Token aus Log-Ausgaben entfernen (K3, K10)
        paths: [
          'req.body.password',
          'req.body.current_password',
          'req.body.token',
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

  // CSRF-Origin-Check fuer schreibende Anfragen
  if (!cfg.skipCsrf) {
    const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT'])
    app.addHook('onRequest', async (request, reply) => {
      if (!WRITE_METHODS.has(request.method)) return
      // Health-Endpunkt ausnehmen
      if (request.url === '/api/health') return

      const origin = request.headers['origin']
      if (!origin || origin !== allowedOrigin) {
        reply.code(403).send({ fehler: 'Ungueltige Herkunft (Origin).' })
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
    await api.register(authRoutes, { db: cfg.db, mail: cfg.mail, limits })

    // Passwort-Routen unter /api/password/...
    await api.register(async (pwApi) => {
      await pwApi.register(passwordRoutes, { db: cfg.db, mail: cfg.mail, limits, siteUrl })
    }, { prefix: '/password' })

    // Fortschritt unter /api/progress (GET, PUT)
    await api.register(progressRoutes, { db: cfg.db })
    // Klassen-Beitritt: POST /api/classes/join
    await api.register(classesRoutes, { db: cfg.db })
  }, { prefix: '/api' })

  return app
}
