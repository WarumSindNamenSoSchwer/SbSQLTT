// Prueft jede Lektion: Musterloesung wird akzeptiert, typische Fehler nicht. Laeuft mit node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
const { LESSONS } = await import('../src/lib/tabula/lessons.ts');
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
