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
	'Das älteste Buch': 'SELECT title, year FROM books ORDER BY year DESC LIMIT 1;'
};
for (const L of Object.values(LESSONS)) {
	test(`${L.no} ${L.title}`, () => {
		const db = new SQL.Database(); db.run(L.db.seed);
		for (const s of L.steps) {
			if (s.kind === 'example') assert.ok(s.msg(run(db, s.code), 6).length > 0);
			if (s.kind === 'exercise') {
				const want = run(db, s.solution);
				assert.ok(want.rows.length > 0, `${s.name}: Loesung leer`);
				assert.equal(compare(run(db, s.solution), want, s.ordered).ok, true, `${s.name}: Loesung abgelehnt`);
				assert.ok(WRONG[s.name], `${s.name}: kein Negativtest`);
				assert.equal(compare(run(db, WRONG[s.name]), want, s.ordered).ok, false, `${s.name}: falsche Abfrage akzeptiert`);
			}
		}
	});
}
