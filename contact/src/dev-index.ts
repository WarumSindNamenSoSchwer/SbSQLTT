/**
 * Entwicklungs-Einstiegspunkt: verwendet nodemailer JSON-Transport (kein SMTP).
 * NUR fuer lokale Tests / Playwright. Nicht in Produktion verwenden.
 */
import nodemailer from 'nodemailer'
import { buildApp } from './app.js'

const PORT = parseInt(process.env['PORT'] ?? '3001', 10)
const HOST = process.env['HOST'] ?? '127.0.0.1'
const ALLOWED_ORIGIN = process.env['ALLOWED_ORIGIN'] ?? 'http://localhost:5173'

// JSON-Transport: loggt Mails als JSON, versendet nichts
const transporter = nodemailer.createTransport({ jsonTransport: true })

const app = await buildApp({ transporter, allowedOrigin: ALLOWED_ORIGIN })

try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`[contact-dev] läuft auf http://${HOST}:${PORT} (JSON-Transport, Origin: ${ALLOWED_ORIGIN})`)
} catch (err) {
  console.error('[contact-dev] Startfehler:', err)
  process.exit(1)
}
