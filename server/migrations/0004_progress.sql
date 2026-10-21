-- Migration 0004: Lernfortschritt (K4)
-- Fortschritt je Benutzer, Lektion und Schritt

CREATE TABLE IF NOT EXISTS progress (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   TEXT    NOT NULL,
  step        INTEGER NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  attempts    INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, lesson_id, step)
);

CREATE INDEX IF NOT EXISTS progress_user_idx ON progress(user_id);

-- Letzter Versuch je Uebung (K4: nur letzte Abfrage + Fehler, wird ueberschrieben)
CREATE TABLE IF NOT EXISTS last_attempt (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   TEXT    NOT NULL,
  step        INTEGER NOT NULL,
  -- Letzte SQL-Abfrage des Schuelers
  query       TEXT    NOT NULL DEFAULT '',
  -- Letzte Fehlermeldung (leer wenn kein Fehler)
  error_msg   TEXT    NOT NULL DEFAULT '',
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY(user_id, lesson_id, step)
);
