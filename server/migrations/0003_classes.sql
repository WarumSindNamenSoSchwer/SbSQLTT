-- Migration 0003: Klassen und Mitgliedschaften (K4)

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  -- 6-stelliger alphanumerischer Code fuer Beitritt
  join_code   TEXT    NOT NULL UNIQUE,
  -- Aktive Fokus-Lektion (z.B. 'lesson-3')
  focus_lesson TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS classes_teacher_idx ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS classes_join_code_idx ON classes(join_code);

-- Mitgliedschaften: Schueler <-> Klasse (K4)
CREATE TABLE IF NOT EXISTS memberships (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(class_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_class_idx ON memberships(class_id);
