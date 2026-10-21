// Prueft Quiz-Bank: Jede Frage mit verify-Feld wird gegen BOOKS_SEED ausgefuehrt.
// Das SQL-Ergebnis muss mit der richtigen Antwort uebereinstimmen.
// Laeuft mit: node --experimental-strip-types --test tests/quiz-bank.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';

const { QUIZ_BANK } = await import('../src/lib/tabula/course/quiz-bank.ts', { with: { type: 'ts' } });
const { BOOKS_SEED } = await import('../src/lib/tabula/course/data.ts', { with: { type: 'ts' } });

const SQL = await initSqlJs();

// Hilfsfunktion: erste Zelle des ersten Ergebnisses
function firstCell(db, sql) {
	const r = db.exec(sql);
	if (!r.length || !r[0].values.length) return null;
	return r[0].values[0][0];
}

test('QUIZ_BANK: 10 Lektionen, je 8 Fragen', () => {
	assert.equal(QUIZ_BANK.length, 10, 'Nicht 10 Lektionen in der Bank');
	for (const entry of QUIZ_BANK) {
		assert.equal(entry.questions.length, 8, `${entry.lesson_id}: nicht 8 Fragen`);
		for (const q of entry.questions) {
			assert.equal(q.options.length, 4, `${entry.lesson_id}: Frage hat nicht 4 Optionen: "${q.question}"`);
			assert.ok(q.correct_idx >= 0 && q.correct_idx <= 3, `${entry.lesson_id}: correct_idx ungueltig`);
			assert.equal(q.time_limit, 20, `${entry.lesson_id}: time_limit != 20`);
		}
	}
});

// Fragen mit verify-Feld werden gegen BOOKS_SEED gecheckt
// (Lektion 9 DDL und Projekt verwenden andere Datenbanken, werden ohne verify gefuehrt)
const db = new SQL.Database();
db.run(BOOKS_SEED);

let verifyCount = 0;

for (const entry of QUIZ_BANK) {
	for (const q of entry.questions) {
		if (!q.verify) continue;
		const { sql, expect } = q.verify;
		const label = `${entry.lesson_id}: "${q.question}"`;

		test(`verify ${label}`, () => {
			const actual = firstCell(db, sql);
			assert.ok(actual !== null, `${label}: SQL lieferte kein Ergebnis`);

			// Vergleich numerisch oder als String
			const actualNorm = typeof expect === 'number' ? Number(actual) : String(actual);
			const expectNorm = typeof expect === 'number' ? Number(expect) : String(expect);
			assert.equal(
				actualNorm,
				expectNorm,
				`${label}: SQL-Ergebnis ${JSON.stringify(actual)} != erwartet ${JSON.stringify(expect)}`
			);

			// Stichprobe: Das Ergebnis muss der richtigen Antwort entsprechen
			const correctOption = q.options[q.correct_idx];
			// Numerischer Vergleich oder String-Match (Antwort kann '10' sein, expect ist 10)
			const optionNorm = typeof expect === 'number' ? Number(correctOption) : String(correctOption);
			assert.equal(
				optionNorm,
				expectNorm,
				`${label}: correct_idx ${q.correct_idx} -> "${correctOption}" passt nicht zum SQL-Ergebnis ${JSON.stringify(expect)}`
			);
			verifyCount++;
		});
	}
}

test('verify: mindestens 20 Fragen mit SQL-Verifikation', () => {
	// Zaehlt alle verify-Fragen ueber alle Eintraege
	let count = 0;
	for (const entry of QUIZ_BANK) {
		for (const q of entry.questions) {
			if (q.verify) count++;
		}
	}
	assert.ok(count >= 20, `Nur ${count} Fragen mit verify, mindestens 20 erwartet`);
});
