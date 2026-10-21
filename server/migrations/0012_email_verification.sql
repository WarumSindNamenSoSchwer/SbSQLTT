-- Migration 0012: Bestätigung der E-Mail-Adresse von Lehrkräften (K7)
--
-- email_verified_at: Zeitpunkt der Bestätigung (NULL = noch nicht bestätigt).
-- email_verifications: einmalige Bestätigungs-Token, nur SHA-256 gespeichert, 24 Stunden gültig.
-- Keine IP-Spalten (K10).

ALTER TABLE users ADD COLUMN email_verified_at INTEGER;

CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS email_verifications_user_idx ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS email_verifications_expires_idx ON email_verifications(expires_at);
