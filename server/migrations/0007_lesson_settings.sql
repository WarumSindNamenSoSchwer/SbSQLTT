-- Migration 0007: Lektions-Einstellungen je Klasse (Freischaltung, Reihenfolge, Fokus)
-- und Einmal-Passwort-Reset-Flag fuer Lehrkraft-initiierte Resets (K3)

-- Lektions-Einstellungen je Klasse:
-- Welche Lektionen freigeschaltet sind, in welcher Reihenfolge, welche die Fokus-Lektion ist.
-- Jede Zeile = eine sichtbare Lektion in dieser Klasse.
CREATE TABLE IF NOT EXISTS lesson_settings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id   TEXT    NOT NULL,
  -- Freigeschaltet (1) oder gesperrt (0) fuer Schueler
  unlocked    INTEGER NOT NULL DEFAULT 1,
  -- Anzeigereihenfolge (aufsteigend); Standard = Katalogreihenfolge
  sort_order  INTEGER NOT NULL DEFAULT 0,
  -- Fokus-Lektion (nur eine je Klasse, wird durch Constraint sichergestellt via App-Logik)
  is_focus    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(class_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_settings_class_idx ON lesson_settings(class_id);

-- must_change_password: Schuelerkonto muss beim naechsten Login Passwort aendern
-- (wird von Lehrkraft-initiiertem Reset gesetzt, K3)
-- ALTER TABLE users: Spalte hinzufuegen falls noch nicht vorhanden.
-- SQLite erlaubt ADD COLUMN in Migrations-Transaktionen.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
