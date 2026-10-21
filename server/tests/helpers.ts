/**
 * Test-Hilfsfunktionen: In-Memory-Datenbank fuer jeden Test
 */
import { openDb } from '../src/db.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

/** Oeffnet eine frische In-Memory-Datenbank mit allen Migrationen */
export function testDb() {
  return openDb(':memory:', MIGRATIONS_DIR)
}
