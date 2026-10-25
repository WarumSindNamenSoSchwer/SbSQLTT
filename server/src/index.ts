/**
 * Einstiegspunkt: Datenbank oeffnen, App starten, Jobs registrieren.
 *
 * Umgebungsvariablen:
 * - DB_PATH       Pfad zur SQLite-Datenbankdatei (Standard: /data/tabula.db)
 * - PORT          Port fuer den HTTP-Server (Standard: 3000)
 * - HOST          Bind-Adresse (Standard: 0.0.0.0)
 * - ALLOWED_ORIGIN Origin fuer CSRF-Check (Standard: https://www.tabulasql.de)
 * - SITE_URL      Basis-URL fuer Links in E-Mails (Standard: https://www.tabulasql.de)
 * - LOG_LEVEL     Pino-Log-Level (Standard: info)
 */
import { openDb } from './db.js'
import { buildApp } from './app.js'
import { createMailSender } from './mail.js'
import { startJobs } from './jobs.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_PATH   = process.env['DB_PATH']   ?? '/data/tabula.db'
const PORT      = parseInt(process.env['PORT'] ?? '3000', 10)
const HOST      = process.env['HOST']      ?? '0.0.0.0'
const SITE_URL  = process.env['SITE_URL']  ?? 'https://www.tabulasql.de'

// Migrations-Ordner relativ zum dist/-Ordner
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

async function main() {
  const db = openDb(DB_PATH, MIGRATIONS_DIR)

  // SMTP über noreply@, wenn /run/secrets/smtp_noreply vorhanden ist, sonst NOOP
  const mail = createMailSender()

  const app = await buildApp({ db, mail, siteUrl: SITE_URL })

  const stopJobs = startJobs({ db, mail, siteUrl: SITE_URL })

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Server wird heruntergefahren ...')
    stopJobs()
    await app.close()
    db.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))

  await app.listen({ port: PORT, host: HOST })
  app.log.info({ port: PORT, host: HOST, db: DB_PATH }, 'Tabula API gestartet')
}

main().catch(err => {
  console.error('Fataler Fehler beim Start:', err)
  process.exit(1)
})
