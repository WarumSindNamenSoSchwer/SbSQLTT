-- Migration 0008: Quiz-Vollimplementierung (K5, P7)
--
-- Erweitert den Platzhalter aus 0006:
--   - quiz_rooms: PIN/Raumcode, optionale Klasse, erweiterter Status (lobby/question/reveal/ended)
--   - quiz_participants: Gast-Teilnehmer (Spitzname ohne Konto) oder registrierter Nutzer
--   - quiz_question_stats: aggregierte Frage-Auswertung ohne Namen (nach 24h Loeschung K5)
--
-- Keine IP-Spalten (K10). Kein echter Name gespeichert, nur Anzeigenamen (K5).

-- ---------------------------------------------------------------------------
-- 1. quiz_rooms erweitern: PIN, optionale Klasse, erweiterter Status
-- ---------------------------------------------------------------------------

-- Neue Spalten (SQLite ADD COLUMN in Transaktion erlaubt)
-- pin: 6-stelliger Code fuer Schuelerbeitritt (ohne verwechselbare Zeichen)
ALTER TABLE quiz_rooms ADD COLUMN pin TEXT;
-- class_id war NOT NULL - fuer Gaeste-Support machen wir es optional per neuer Spalte
-- (die alte class_id bleibt fuer Rueckwaertskompatibilitaet mit 0006-Daten)
-- state in 0006: 'lobby','running','ended' - wir brauchen auch 'question' und 'reveal'
-- SQLite CHECK kann nicht nachtraeglich geaendert werden; der App-Layer erzwingt die Werte.
-- current_question_started_at: Startzeitpunkt der aktuellen Frage (fuer serverseitigen Timer)
ALTER TABLE quiz_rooms ADD COLUMN current_question_started_at INTEGER;
-- Fuer Lehrkraft-WebSocket-Kontrolle: welche question_id gerade aktiv ist
ALTER TABLE quiz_rooms ADD COLUMN current_question_id INTEGER REFERENCES quiz_questions(id);

-- Eindeutiger PIN-Index
CREATE UNIQUE INDEX IF NOT EXISTS quiz_rooms_pin_idx ON quiz_rooms(pin) WHERE pin IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. quiz_participants: ein Eintrag je Teilnehmer und Raum
--    Entweder registrierter Nutzer (user_id) ODER Gast (guest_name)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quiz_participants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     INTEGER NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  -- Registrierter Nutzer (optional - Gast hat NULL)
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  -- Anzeigename (Spitzname des Gastes oder display_name des registrierten Nutzers)
  -- K5: nur Anzeigename, kein echter Name, keine E-Mail
  display_name TEXT NOT NULL,
  -- Gesamtpunkte (wird inkrementell aktualisiert)
  total_points INTEGER NOT NULL DEFAULT 0,
  joined_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(room_id, user_id),        -- ein registrierter Nutzer je Raum
  UNIQUE(room_id, display_name)    -- eindeutiger Anzeigename je Raum
);

CREATE INDEX IF NOT EXISTS quiz_participants_room_idx ON quiz_participants(room_id);
CREATE INDEX IF NOT EXISTS quiz_participants_user_idx ON quiz_participants(user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. quiz_answers migrieren: participant_id statt user_id
--    Die alte Tabelle bleibt; wir fuegen participant_id hinzu und nutzen sie kuenftig.
--    Alte user_id-Spalte bleibt fuer Rueckwaertskompatibilitaet (0006-Daten).
-- ---------------------------------------------------------------------------

ALTER TABLE quiz_answers ADD COLUMN participant_id INTEGER REFERENCES quiz_participants(id) ON DELETE CASCADE;

-- Index fuer den Loeschjob (24h nach Ende, K5)
CREATE INDEX IF NOT EXISTS quiz_answers_participant_idx ON quiz_answers(participant_id) WHERE participant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. quiz_question_stats: aggregierte Auswertung ohne Namen (K5)
--    Wird befuellt bevor quiz_answers und quiz_participants geloescht werden.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quiz_question_stats (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id         INTEGER NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  question_id     INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  -- Anzahl Antworten je Antwortoption (JSON-Array, z.B. [3,1,8,2])
  answer_counts   TEXT    NOT NULL DEFAULT '[]',
  -- Anteil richtig (0.0 - 1.0)
  correct_ratio   REAL    NOT NULL DEFAULT 0,
  -- Anzahl Teilnehmende die geantwortet haben
  answer_count    INTEGER NOT NULL DEFAULT 0,
  -- Durchschnittliche Antwortzeit in ms
  avg_ms          INTEGER,
  aggregated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(room_id, question_id)
);

CREATE INDEX IF NOT EXISTS quiz_question_stats_room_idx ON quiz_question_stats(room_id);
