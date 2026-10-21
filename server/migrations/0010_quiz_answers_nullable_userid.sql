-- Migration 0010: quiz_answers.user_id optional machen (K5: participant_id ist der neue FK)
--
-- Die 0006-Migration hatte user_id NOT NULL. Da wir jetzt quiz_participants verwenden,
-- ist user_id nur noch Legacy-Spalte. Mit participant_id als Pflichtfeld.
-- SQLite: Tabelle neu erstellen.

CREATE TABLE IF NOT EXISTS quiz_answers_backup AS SELECT * FROM quiz_answers;

DROP INDEX IF EXISTS quiz_answers_room_idx;
DROP INDEX IF EXISTS quiz_answers_participant_idx;
DROP TABLE IF EXISTS quiz_answers;

CREATE TABLE IF NOT EXISTS quiz_answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id       INTEGER NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  -- participant_id: neues Pflichtfeld (ab P7)
  participant_id INTEGER REFERENCES quiz_participants(id) ON DELETE CASCADE,
  -- user_id: Legacy, optional
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES quiz_questions(id),
  chosen_idx    INTEGER,
  answer_ms     INTEGER,
  points        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(room_id, participant_id, question_id)
);

CREATE INDEX IF NOT EXISTS quiz_answers_room_idx ON quiz_answers(room_id);
CREATE INDEX IF NOT EXISTS quiz_answers_participant_idx ON quiz_answers(participant_id) WHERE participant_id IS NOT NULL;

-- Backup-Daten zurueckkopieren (participant_id kann NULL sein fuer alte Daten)
INSERT INTO quiz_answers
  (id, room_id, participant_id, user_id, question_id, chosen_idx, answer_ms, points, created_at)
SELECT
  id,
  room_id,
  participant_id,
  user_id,
  question_id,
  chosen_idx,
  answer_ms,
  points,
  created_at
FROM quiz_answers_backup;

DROP TABLE IF EXISTS quiz_answers_backup;
