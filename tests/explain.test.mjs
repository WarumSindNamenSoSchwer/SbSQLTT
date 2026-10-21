// Prueft die Abfrage-Visualisierung gegen echte SQLite-Ergebnisse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
const { BOOKS_SEED } = await import('../src/lib/tabula/lessons.ts');
const { explainQuery } = await import('../src/lib/tabula/explain.ts');
const { readSchema, run } = await import('../src/lib/tabula/sql.ts');

const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(BOOKS_SEED);
const schema = readSchema(db);
const ex = (q) => explainQuery(db, q, schema, run(db, q));
const kept = (v, t = 0) => v.tables[t].rows.filter((r) => r.kept).map((r) => r.cells[1]);

test('WHERE: richtige Zeilen behalten, Rest raus', () => {
	const v = ex('SELECT title, year FROM books WHERE year > 2010;');
	assert.deepEqual(kept(v).sort(), ['Data-Intensive Apps', 'Database Internals', 'Refactoring']);
	assert.match(v.note, /3 Zeilen fallen/);
	const cols = Object.fromEntries(v.tables[0].cols.map((c) => [c.name, c]));
	assert.equal(cols.title.sel, true);
	assert.equal(cols.id.sel, false);
	assert.equal(cols.year.cond, true);
});

test('ORDER BY + LIMIT: Rang und Begrenzung', () => {
	const v = ex('SELECT title, year FROM books ORDER BY year LIMIT 2');
	const r = v.tables[0].rows.filter((x) => x.kept).sort((a, b) => a.rank - b.rank).map((x) => x.cells[1]);
	assert.deepEqual(r, ['The Pragmatic Programmer', 'Head First SQL']);
});

test('SELECT *: alle Spalten gewaehlt', () => {
	const v = ex('SELECT * FROM publishers');
	assert.ok(v.tables[0].cols.every((c) => c.sel));
	assert.equal(v.keptCount, 3);
});

test('JOIN mit Alias: Paare stimmen', () => {
	const v = ex('SELECT b.title, p.name FROM books b JOIN publishers p ON b.publisher_id = p.id WHERE b.year > 2010');
	assert.equal(v.links.length, 3);
	assert.deepEqual(kept(v, 1).sort(), ["Addison-Wesley", "O'Reilly Media"]);
	assert.equal(v.tables[1].rows.find((r) => r.cells[1] === 'No Starch Press').kept, false);
});

test('LEFT JOIN: Verlag ohne Buch bleibt', () => {
	const v = ex('SELECT p.name, b.title FROM publishers p LEFT JOIN books b ON b.publisher_id = p.id');
	assert.equal(v.tables[0].rows.find((r) => r.cells[1] === 'No Starch Press').kept, true);
});

test('Aggregat ohne GROUP BY', () => {
	const v = ex('SELECT COUNT(*) AS anzahl FROM books WHERE year > 2010');
	assert.equal(v.aggregate, 'all');
	assert.match(v.note, /3 Zeilen werden zu einer/);
});

test('GROUP BY + HAVING: Gruppen und Filter', () => {
	const v = ex('SELECT publisher_id FROM books GROUP BY publisher_id HAVING AVG(year) > 2010');
	assert.equal(v.groups, 1);
	assert.ok(v.tables[0].rows.filter((r) => r.kept).every((r) => r.cells[3] === 2));
});

test('Unterabfrage in WHERE', () => {
	const v = ex('SELECT title FROM books WHERE year = (SELECT MAX(year) FROM books)');
	assert.deepEqual(kept(v), ['Database Internals']);
});

test('Ungueltig / nicht SELECT: keine Visualisierung, kein Absturz', () => {
	assert.equal(ex('SELECT 1'), null);
	assert.equal(explainQuery(db, 'CREATE TABLE x (a int)', schema, { columns: [], rows: [] }), null);
	assert.equal(explainQuery(db, 'SELECT * FROM nichtda', schema, { columns: [], rows: [] }), null);
});

test('Visualisierung veraendert die Datenbank nicht', () => {
	ex('SELECT * FROM books WHERE year > 2000');
	assert.equal(run(db, 'SELECT COUNT(*) FROM books').rows[0][0], 6);
});
