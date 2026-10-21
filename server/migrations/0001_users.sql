-- Migration 0001: Benutzerkonten
-- Schema nach K1 (Schueler) und K2 (Lehrkraft)

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Anmeldung
  username    TEXT    NOT NULL UNIQUE CHECK(username = lower(username)),
  -- Anzeigename (darf Gross-/Kleinbuchstaben und Sonderzeichen haben)
  display_name TEXT   NOT NULL,
  -- K1: optional; K2: Pflicht
  email       TEXT    UNIQUE,
  -- K2: Pflicht fuer Lehrkraefte
  name        TEXT,
  school      TEXT,
  -- 'student' oder 'teacher'
  role        TEXT    NOT NULL CHECK(role IN ('student', 'teacher')),
  -- PHC-Format (enthaelt Salt, Parameter, Hash)
  password_hash TEXT  NOT NULL,
  -- Erstellungstag UTC YYYY-MM-DD (wird als Associated-Data fuer Argon2 benoetigt, K3)
  created_day TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER,
  -- K2: Einverstaendnis Nutzungsbedingungen
  terms_accepted_at INTEGER
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_last_login_idx ON users(last_login_at);
