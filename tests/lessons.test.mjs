// Prueft jede Lektion: Musterloesung wird akzeptiert, typische Fehler nicht. Laeuft mit node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
const { LESSONS } = await import('../src/lib/tabula/lessons.ts');
const { TRAFFIC_SEED } = await import('../src/lib/tabula/course/traffic-data.ts');
const { compare } = await import('../src/lib/tabula/sql.ts');

const SQL = await initSqlJs();
const run = (db, q) => { const r = db.exec(q); const l = r[r.length - 1]; return l ? { columns: l.columns, rows: l.values } : { columns: [], rows: [] }; };
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
		const exercises = L.steps.filter((s) => s.kind === 'exercise');
		assert.ok(exercises.length >= 10, `${L.title}: nur ${exercises.length} Uebungen, mindestens 10 erwartet`);
		for (const s of L.steps) {
			if (s.kind === 'example') assert.ok(s.msg(exec(db, s.code), 6).length > 0);
			if (s.kind === 'exercise') {
				const want = exec(db, s.solution, s.check);
				assert.ok(want.rows.length > 0, `${s.name}: Loesung leer`);
				assert.equal(compare(exec(db, s.solution, s.check), want, s.ordered).ok, true, `${s.name}: Loesung abgelehnt`);
				// Zweimal hintereinander ausfuehren darf nicht scheitern (keine Reste in der DB)
				assert.equal(compare(exec(db, s.solution, s.check), want, s.ordered).ok, true, `${s.name}: zweiter Lauf abgelehnt`);
				assert.equal(compare(exec(db, s.wrong, s.check), want, s.ordered).ok, false, `${s.name}: falsche Abfrage akzeptiert`);
			}
		}
	});
}

// ---- Geschichte im Datensatz pruefen ----------------------------------------
test('traffic-data: avg_ms nach v2.4 deutlich hoeher als davor', () => {
	const db = new SQL.Database();
	db.run(TRAFFIC_SEED);
	// Vergleiche bei gleicher Last (20-40 Nutzer): nach v2.4 muss mind. 2x so hoch sein
	const r = run(db, `
		SELECT
			ROUND(AVG(CASE WHEN ts < '2026-01-26 00:00' THEN avg_ms END)) AS vor_v24,
			ROUND(AVG(CASE WHEN ts >= '2026-01-26 00:00' THEN avg_ms END)) AS nach_v24
		FROM traffic WHERE users BETWEEN 20 AND 40
	`);
	const vorV24 = r.rows[0][0];
	const nachV24 = r.rows[0][1];
	assert.ok(nachV24 > vorV24 * 2, `avg_ms nach v2.4 (${nachV24}) soll mind. 2x so hoch sein wie davor (${vorV24})`);
});

test('traffic-data: Nutzerzahl letzte Woche hoeher als erste Woche (Wachstum)', () => {
	const db = new SQL.Database();
	db.run(TRAFFIC_SEED);
	// Durchschnitt Woche 0 vs Woche 5, Server 1
	const r = run(db, `
		SELECT
			ROUND(AVG(CASE WHEN CAST((JULIANDAY(ts) - JULIANDAY('2026-01-05')) / 7 AS INTEGER) = 0 THEN users END)) AS woche0,
			ROUND(AVG(CASE WHEN CAST((JULIANDAY(ts) - JULIANDAY('2026-01-05')) / 7 AS INTEGER) = 5 THEN users END)) AS woche5
		FROM traffic WHERE server_id = 1
	`);
	const woche0 = r.rows[0][0];
	const woche5 = r.rows[0][1];
	assert.ok(woche5 > woche0, `Nutzer Woche 5 (${woche5}) soll hoeher sein als Woche 0 (${woche0})`);
});

test('traffic-data: Abend-Peak (20-21 Uhr) hoeher als Nacht (0-3 Uhr)', () => {
	const db = new SQL.Database();
	db.run(TRAFFIC_SEED);
	const r = run(db, `
		SELECT
			ROUND(AVG(CASE WHEN SUBSTR(ts,12,2) IN ('20','21') THEN users END)) AS abend,
			ROUND(AVG(CASE WHEN SUBSTR(ts,12,2) IN ('00','01','02','03') THEN users END)) AS nacht
		FROM traffic
	`);
	const abend = r.rows[0][0];
	const nacht = r.rows[0][1];
	assert.ok(abend > nacht * 5, `Abend-Nutzer (${abend}) soll mind. 5x so hoch sein wie Nacht (${nacht})`);
});

test('traffic-data: Wochentag hoeher als Wochenende', () => {
	const db = new SQL.Database();
	db.run(TRAFFIC_SEED);
	const r = run(db, `
		SELECT
			ROUND(AVG(CASE WHEN strftime('%w',ts) NOT IN ('0','6') THEN users END)) AS wochentag,
			ROUND(AVG(CASE WHEN strftime('%w',ts) IN ('0','6') THEN users END)) AS wochenende
		FROM traffic
	`);
	const wochentag = r.rows[0][0];
	const wochenende = r.rows[0][1];
	assert.ok(wochentag > wochenende, `Wochentag (${wochentag}) soll hoeher sein als Wochenende (${wochenende})`);
});
