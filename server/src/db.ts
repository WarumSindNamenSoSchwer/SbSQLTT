/**
 * Datenbankzugriff: better-sqlite3 im WAL-Modus.
 * Migrationen werden beim Start aus dem Ordner migrations/ angewendet.
 *
 * Wahl der Bibliothek: better-sqlite3 ist synchron, schnell und bewaehrt
 * fuer SQLite in Node-Containern. WAL erlaubt gleichzeitige Lesezugriffe.
 */
import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type Db = Database.Database

// Internes Migrations-Schema
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

/**
 * Oeffnet (oder erstellt) die SQLite-Datenbank und fuehrt alle ausstehenden
 * Migrationen in alphabetischer Reihenfolge aus.
 *
 * @param dbPath Pfad zur .db-Datei. ':memory:' fuer Tests.
 * @param migrationsDir Optionaler Pfad zum Migrations-Ordner (Standard: ../../migrations).
 */
export function openDb(dbPath: string, migrationsDir?: string): Db {
  const db = new Database(dbPath)

  // WAL-Modus fuer bessere Parallelitaet
  db.pragma('journal_mode = WAL')
  // Foreign Keys aktivieren
  db.pragma('foreign_keys = ON')
  // Leicht haertere Synchronisierung (Normal ist fuer WAL empfohlen)
  db.pragma('synchronous = NORMAL')

  // Migrations-Tabelle anlegen
  db.exec(MIGRATIONS_TABLE)

  // Migrationsordner bestimmen
  const migrDir = migrationsDir ?? join(__dirname, '..', 'migrations')

  // Alle .sql-Dateien alphabetisch sortiert anwenden
  const files = readdirSync(migrDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  const alreadyApplied = db
    .prepare('SELECT filename FROM _migrations')
    .all() as { filename: string }[]
  const applied = new Set(alreadyApplied.map(r => r.filename))

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (filename) VALUES (?)'
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrDir, file), 'utf-8')
    db.transaction(() => {
      db.exec(sql)
      insertMigration.run(file)
    })()
  }

  return db
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** SHA-256 eines Strings als Hex-String */
export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Löscht alle Fragensätze einer Lehrkraft samt Fragen, Quiz-Räumen, Teilnahmen, Antworten und Statistik.
 * Aufruf beim Löschen des Kontos (DELETE /api/me) und bei der Löschung nach Inaktivität (jobs.ts).
 * Nötig, weil quiz_question_sets.teacher_id beim Löschen der Lehrkraft nur auf NULL gesetzt würde
 * und quiz_rooms.set_id kein ON DELETE CASCADE hat. Automatische Sätze aus der Quiz-Bank
 * (source = 'auto') gehören der Lehrkraft ebenfalls und werden mitgelöscht.
 */
export function deleteTeacherQuizzes(db: Db, teacherId: number): void {
  const sets = db.prepare('SELECT id FROM quiz_question_sets WHERE teacher_id = ?').all(teacherId) as { id: number }[]
  for (const { id } of sets) {
    // Räume zuerst: Teilnahmen, Antworten und Statistik hängen per CASCADE an quiz_rooms
    db.prepare('DELETE FROM quiz_rooms WHERE set_id = ?').run(id)
    db.prepare('DELETE FROM quiz_question_sets WHERE id = ?').run(id)
  }
}
