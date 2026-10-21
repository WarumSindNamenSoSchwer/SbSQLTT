-- Migration 0009: quiz_rooms.class_id optional machen (K5: Gast-Modus ohne Klasse)
--
-- SQLite unterstuetzt kein ALTER COLUMN, daher: Tabelle umbenennen,
-- neu anlegen mit class_id NULL, Daten kopieren, alte loeschen.
-- Indizes werden neu erstellt (aus 0006 und 0008 bekannte Indizes).

-- Daten sichern
CREATE TABLE IF NOT EXISTS quiz_rooms_backup AS SELECT * FROM quiz_rooms;

-- Alte Tabelle und Indizes droppen
DROP INDEX IF EXISTS quiz_rooms_ended_idx;
DROP INDEX IF EXISTS quiz_rooms_pin_idx;
DROP TABLE IF EXISTS quiz_rooms;

-- Neu anlegen mit class_id NULL (Gast-Modus)
CREATE TABLE IF NOT EXISTS quiz_rooms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Klasse optional (NULL = Gast-Modus ohne Klassenzugehoerigkeit, K5)
  class_id    INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  set_id      INTEGER NOT NULL REFERENCES quiz_question_sets(id),
  state       TEXT    NOT NULL DEFAULT 'lobby',
  current_q   INTEGER NOT NULL DEFAULT 0,
  -- PIN fuer Schuelerbeitritt (6 Zeichen, ohne verwechselbare Zeichen)
  pin         TEXT,
  -- Startzeitpunkt der aktuellen Frage (fuer serverseitigen Timer)
  current_question_started_at INTEGER,
  -- Aktuell laufende Frage
  current_question_id INTEGER REFERENCES quiz_questions(id),
  started_at  INTEGER,
  ended_at    INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Daten zurueckkopieren (class_id bleibt NULL wenn das Backup NULL hatte oder Backup leer ist)
INSERT INTO quiz_rooms
  (id, class_id, set_id, state, current_q, pin, current_question_started_at,
   current_question_id, started_at, ended_at, created_at)
SELECT
  id,
  class_id,
  set_id,
  state,
  current_q,
  pin,
  current_question_started_at,
  current_question_id,
  started_at,
  ended_at,
  created_at
FROM quiz_rooms_backup;

DROP TABLE IF EXISTS quiz_rooms_backup;

-- Indizes neu erstellen
CREATE INDEX IF NOT EXISTS quiz_rooms_ended_idx ON quiz_rooms(ended_at) WHERE ended_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quiz_rooms_pin_idx ON quiz_rooms(pin) WHERE pin IS NOT NULL;
