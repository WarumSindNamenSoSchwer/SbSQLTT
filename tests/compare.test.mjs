// Prueft die Rueckmeldungen der Ergebnis-Pruefung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
const { BOOKS_SEED } = await import('../src/lib/tabula/lessons.ts');
const { compare, run, sqlHint } = await import('../src/lib/tabula/sql.ts');
const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(BOOKS_SEED);
const want = run(db, 'SELECT title, year FROM books WHERE year > 2010 ORDER BY year');
const chk = (q, ordered = true) => compare(run(db, q), want, ordered);

test('richtige Abfrage wird akzeptiert', () => assert.equal(chk('SELECT title, year FROM books WHERE year > 2010 ORDER BY year').ok, true));
test('fehlende Spalte bei richtigen Zeilen', () => assert.equal(chk('SELECT title FROM books WHERE year > 2010 ORDER BY year').sub, 'Die Zeilen stimmen. Es fehlt die Spalte year.'));
test('ganz andere Tabelle behauptet nicht "Zeilen stimmen"', () => {
	const r = chk('SELECT name FROM publishers');
	assert.equal(r.ok, false);
	assert.doesNotMatch(r.sub, /Zeilen stimmen\./);
	assert.match(r.sub, /Es fehlt die Spalte title, year/);
});
test('zu viele Zeilen', () => assert.equal(chk('SELECT title, year FROM books WHERE year > 2000 ORDER BY year').sub, '2 Zeilen zu viel.'));
test('falsche Reihenfolge', () => assert.equal(chk('SELECT title, year FROM books WHERE year > 2010 ORDER BY year DESC').sub, 'Die Zeilen stimmen. Die Reihenfolge noch nicht.'));
test('Spalte zu viel', () => assert.match(chk('SELECT title, year, id FROM books WHERE year > 2010 ORDER BY year').sub, /id ist zu viel/));
test('JOIN ohne ON wird erkannt', () => {
	assert.equal(sqlHint('SELECT * FROM books b JOIN publishers p;'), 'Nach JOIN fehlt die Bedingung mit ON.');
	assert.equal(sqlHint('SELECT * FROM books b JOIN publishers p ON b.publisher_id = p.id'), null);
});
