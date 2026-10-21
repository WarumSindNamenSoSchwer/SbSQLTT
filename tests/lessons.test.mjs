// Prueft jede Lektion: Musterloesung wird akzeptiert, typische Fehler nicht. Laeuft mit node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
const { LESSONS } = await import('../src/lib/tabula/lessons.ts');
const { compare } = await import('../src/lib/tabula/sql.ts');

const SQL = await initSqlJs();
const run = (db, q) => { const r = db.exec(q); const l = r[r.length - 1]; return l ? { columns: l.columns, rows: l.values } : { columns: [], rows: [] }; };
const WRONG = {
	'Alle Verlage': 'SELECT * FROM books;',
	'Nur eine Spalte': 'SELECT title, year FROM books;',
	'Zwei Spalten': 'SELECT title FROM books;',
	'Deutsche Namen': 'SELECT id, name FROM publishers;',
	'Bücher nach 2010': 'SELECT title, year FROM books WHERE year > 2010;',
	'Bedingungen kombinieren': 'SELECT title FROM books WHERE publisher_id = 2;',
	'Nach Titel sortieren': 'SELECT title, year FROM books ORDER BY year;',
	'Das älteste Buch': 'SELECT title, year FROM books ORDER BY year DESC LIMIT 1;',
	'Neue Bücher zählen': 'SELECT COUNT(*) AS anzahl FROM books;',
	'Durchschnittsjahr': 'SELECT MAX(year) AS schnitt FROM books;',
	'Neuestes Buch pro Verlag': 'SELECT publisher_id, MIN(year) AS neuestes FROM books GROUP BY publisher_id;',
	'Gruppen filtern': 'SELECT publisher_id FROM books GROUP BY publisher_id;',
	'Neue Bücher mit Verlag': 'SELECT b.title, p.name FROM books b JOIN publishers p ON b.publisher_id = p.id;',
	'Auch ohne Partner': 'SELECT p.name, b.title FROM publishers p JOIN books b ON b.publisher_id = p.id;',
	'Das neueste Buch': 'SELECT title, year FROM books WHERE year = (SELECT MIN(year) FROM books);',
	'Nach Verlagsname': 'SELECT title FROM books WHERE publisher_id = 2;',
	'Tabelle schueler': 'CREATE TABLE schueler (id INTEGER PRIMARY KEY, name TEXT, klasse_id INTEGER);',
	'Schüler eintragen': "CREATE TABLE schueler (id INTEGER PRIMARY KEY, name TEXT NOT NULL, klasse_id INTEGER REFERENCES klassen(id)); INSERT INTO schueler VALUES (1, 'Mia', 1), (2, 'Jonas', 2);"
};
const exec = (db, q, check) => {
	db.run('SAVEPOINT t');
	try {
		const a = run(db, q);
		return check ? run(db, check) : a;
	} finally {
		db.run('ROLLBACK TO t; RELEASE t');
	}
};
for (const L of Object.values(LESSONS)) {
	test(`${L.no} ${L.title}`, () => {
		const db = new SQL.Database(); db.run(L.db.seed);
		for (const s of L.steps) {
			if (s.kind === 'example') assert.ok(s.msg(exec(db, s.code), 6).length > 0);
			if (s.kind === 'exercise') {
				const want = exec(db, s.solution, s.check);
				assert.ok(want.rows.length > 0, `${s.name}: Loesung leer`);
				assert.equal(compare(exec(db, s.solution, s.check), want, s.ordered).ok, true, `${s.name}: Loesung abgelehnt`);
				// Zweimal hintereinander ausfuehren darf nicht scheitern (keine Reste in der DB)
				assert.equal(compare(exec(db, s.solution, s.check), want, s.ordered).ok, true, `${s.name}: zweiter Lauf abgelehnt`);
				assert.ok(WRONG[s.name], `${s.name}: kein Negativtest`);
				assert.equal(compare(exec(db, WRONG[s.name], s.check), want, s.ordered).ok, false, `${s.name}: falsche Abfrage akzeptiert`);
			}
		}
	});
}
