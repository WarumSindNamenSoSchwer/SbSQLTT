-- Migration 0005: Passwort-Zuruecksetzen (K7)
-- Token: zufaellig 32 Byte, NUR SHA-256 gespeichert, 1 Stunde gueltig, einmalig

CREATE TABLE IF NOT EXISTS password_resets (
  -- SHA-256 des zufaelligen Tokens (Hex, 64 Zeichen)
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  -- Einmalig: nach Nutzung auf 1 gesetzt
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS password_resets_expires_idx ON password_resets(expires_at);
