// Prueft die Rueckmeldungen der Ergebnis-Pruefung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
const { BOOKS_SEED } = await import('../src/lib/tabula/lessons.ts');
const { compare, run, sqlHint } = await import('../src/lib/tabula/sql.ts');
const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(BOOKS_SEED);
// year > 2010 ORDER BY year: 23 Zeilen im neuen Datensatz
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
// year > 2000: 28 Zeilen -> 28 - 23 = 5 zu viel
test('zu viele Zeilen', () => assert.equal(chk('SELECT title, year FROM books WHERE year > 2000 ORDER BY year').sub, '5 Zeilen zu viel.'));
test('falsche Reihenfolge', () => assert.equal(chk('SELECT title, year FROM books WHERE year > 2010 ORDER BY year DESC').sub, 'Die Zeilen stimmen. Die Reihenfolge noch nicht.'));
test('Spalte zu viel', () => assert.match(chk('SELECT title, year, id FROM books WHERE year > 2010 ORDER BY year').sub, /id ist zu viel/));
test('JOIN ohne ON wird erkannt', () => {
	assert.equal(sqlHint('SELECT * FROM books b JOIN publishers p;'), 'Nach JOIN fehlt die Bedingung mit ON.');
	assert.equal(sqlHint('SELECT * FROM books b JOIN publishers p ON b.publisher_id = p.id'), null);
});

test('CREATE TABLE: konkrete Rueckmeldung zur Struktur', async () => {
	const { LESSONS } = await import('../src/lib/tabula/lessons.ts');
	const { runChecked } = await import('../src/lib/tabula/sql.ts');
	const L = LESSONS.ddl;
	const d = new SQL.Database();
	d.run(L.db.seed);
	const ex = L.steps.find((s) => s.name === 'Tabelle schueler');
	const want = runChecked(d, ex.solution, ex.check).checked;
	const fb = (q) => compare(runChecked(d, q, ex.check).checked, want, true).sub;
	assert.equal(fb('CREATE TABLE schuler (id INTEGER PRIMARY KEY)'), 'Die Tabelle wurde nicht angelegt. Prüfe den Tabellennamen.');
	assert.equal(fb('CREATE TABLE schueler (id INTEGER PRIMARY KEY, name TEXT NOT NULL)'), 'Es fehlt die Spalte klasse_id.');
	assert.equal(fb('CREATE TABLE schueler (id INTEGER, name TEXT NOT NULL, klasse_id INTEGER REFERENCES klassen(id))'), 'id soll der Primärschlüssel sein (PRIMARY KEY).');
	assert.equal(fb('CREATE TABLE schueler (id INTEGER PRIMARY KEY, name TEXT, klasse_id INTEGER REFERENCES klassen(id))'), 'name darf nicht leer sein. Ergänze NOT NULL.');
	assert.equal(fb('CREATE TABLE schueler (id INTEGER PRIMARY KEY, name TEXT NOT NULL, klasse_id INTEGER)'), 'klasse_id soll auf klassen.id verweisen (REFERENCES).');
	assert.equal(fb('CREATE TABLE schueler (id INTEGER PRIMARY KEY, name INTEGER NOT NULL, klasse_id INTEGER REFERENCES klassen(id))'), 'Die Spalte name braucht den Typ TEXT.');
	assert.equal(compare(runChecked(d, ex.solution.toLowerCase(), ex.check).checked, want, true).ok, true);
});
