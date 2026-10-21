-- Migration 0002: Sitzungen (K6)
-- id = zufaellige 32 Byte als Hex (64 Zeichen) - NUR SHA-256 davon wird gespeichert
-- Das rohe Token wird nur einmalig per Cookie uebertragen.

CREATE TABLE IF NOT EXISTS sessions (
  -- SHA-256 des zufaelligen 32-Byte-Tokens (Hex, 64 Zeichen)
  id_hash     TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Unix-Timestamp: Ablauf nach 30 Tagen (K6)
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
