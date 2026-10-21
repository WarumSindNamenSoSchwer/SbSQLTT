/**
 * Einstiegspunkt fuer den Kontaktformular-Dienst.
 * Port: 3001 (oder PORT-Umgebungsvariable)
 */
import { buildApp } from './app.js'
import { createTransporter } from './mailer.js'

const PORT = parseInt(process.env['PORT'] ?? '3001', 10)
const HOST = process.env['HOST'] ?? '0.0.0.0'

let transporter
try {
  transporter = createTransporter()
} catch (err) {
  console.error('[contact] SMTP-Transporter konnte nicht erstellt werden:', err instanceof Error ? err.message : err)
  process.exit(1)
}

const app = await buildApp({ transporter })

try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info({ event: 'started', port: PORT })
} catch (err) {
  app.log.error({ event: 'startup_error', err: err instanceof Error ? err.message : 'unbekannt' })
  process.exit(1)
}
