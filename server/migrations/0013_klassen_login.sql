-- Migration 0013: Klassen-Login (docs/KLASSEN-LOGIN.md, Vorgaben K1, K2, K4, K5)
--
-- Schüler haben kein Konto mehr. Ein Schüler ist eine Zeile in users mit role='student' ohne
-- Klardaten: username ist ein zufälliger Platzhalter, password_hash leer, display_name leer.
-- Angemeldet wird mit login_hash = SHA-256 des im Browser abgeleiteten Schlüssels.
-- enc_name ist der Name, im Browser mit dem öffentlichen Schlüssel der Lehrkraft verschlüsselt.

-- Alte Schülerkonten (Benutzername, Anzeigename, E-Mail im Klartext) passen nicht zum neuen
-- Modell und werden entfernt. Es waren nie echte Schüler online (Konten nie freigeschaltet).
DELETE FROM users WHERE role = 'student';

-- Schüler
ALTER TABLE users ADD COLUMN login_hash TEXT;
ALTER TABLE users ADD COLUMN enc_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_login_hash_idx ON users(login_hash) WHERE login_hash IS NOT NULL;

-- Lehrkraft: Schlüsselpaar (öffentlich offen, privat nur verschlüsselt)
ALTER TABLE users ADD COLUMN public_key TEXT;
ALTER TABLE users ADD COLUMN wrapped_key_pw TEXT;
ALTER TABLE users ADD COLUMN wrapped_key_recovery TEXT;

-- Klassen: Zufalls-Salz für die Schlüsselableitung (Klassencode bleibt dadurch änderbar)
ALTER TABLE classes ADD COLUMN class_salt TEXT;
UPDATE classes SET class_salt = lower(hex(randomblob(16))) WHERE class_salt IS NULL;
UPDATE classes SET join_code = lower(join_code);

-- Letzte Abfrage: nur noch verschlüsselt (sealed) plus Kennzeichen, ob sie einen Fehler hatte.
-- Die alten Klartextspalten query/error_msg bleiben leer.
ALTER TABLE last_attempt ADD COLUMN sealed TEXT NOT NULL DEFAULT '';
ALTER TABLE last_attempt ADD COLUMN has_error INTEGER NOT NULL DEFAULT 0;
UPDATE last_attempt SET query = '', error_msg = '';

-- Einmal-Codes der Lehrkraft für Schüler, die ihr Passwort vergessen haben (15 Minuten, nur Hash)
CREATE TABLE IF NOT EXISTS student_reset_codes (
  code_hash   TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS student_reset_codes_user_idx ON student_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS student_reset_codes_expires_idx ON student_reset_codes(expires_at);

-- Quiz-Teilnehmer: kein Name mehr beim Server (display_name ist nur noch ein Platzhalter)
UPDATE quiz_participants SET display_name = '#' || id;
