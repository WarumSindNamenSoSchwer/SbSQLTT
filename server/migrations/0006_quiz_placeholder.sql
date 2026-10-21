-- Migration 0006: Quiz-Tabellen (Platzhalter, kommt spaeter - K5)
-- Diese Migration reserviert die Tabellennamen und legt die Grundstruktur fest.
-- Inhalt folgt in einer separaten Migration wenn die Quiz-Funktionalitaet implementiert wird.

-- Fragensaetze
CREATE TABLE IF NOT EXISTS quiz_question_sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  lesson_id   TEXT,
  title       TEXT    NOT NULL,
  -- 'auto' = automatisch aus Lektion erzeugt, 'custom' = manuell erstellt
  source      TEXT    NOT NULL DEFAULT 'auto',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Einzelne Fragen
CREATE TABLE IF NOT EXISTS quiz_questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      INTEGER NOT NULL REFERENCES quiz_question_sets(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  question    TEXT    NOT NULL,
  -- JSON-Array mit 4 Antwortoptionen
  options     TEXT    NOT NULL DEFAULT '[]',
  correct_idx INTEGER NOT NULL DEFAULT 0,
  time_limit  INTEGER NOT NULL DEFAULT 20
);

-- Quiz-Raeume (aktive Quiz-Sessions)
CREATE TABLE IF NOT EXISTS quiz_rooms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  set_id      INTEGER NOT NULL REFERENCES quiz_question_sets(id),
  state       TEXT    NOT NULL DEFAULT 'lobby' CHECK(state IN ('lobby','running','ended')),
  current_q   INTEGER NOT NULL DEFAULT 0,
  started_at  INTEGER,
  ended_at    INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Quiz-Teilnahme (K5: 24h nach Ende loeschen)
CREATE TABLE IF NOT EXISTS quiz_answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     INTEGER NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  chosen_idx  INTEGER,
  answer_ms   INTEGER,
  points      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(room_id, user_id, question_id)
);

CREATE INDEX IF NOT EXISTS quiz_answers_room_idx ON quiz_answers(room_id);
CREATE INDEX IF NOT EXISTS quiz_rooms_ended_idx ON quiz_rooms(ended_at) WHERE ended_at IS NOT NULL;
