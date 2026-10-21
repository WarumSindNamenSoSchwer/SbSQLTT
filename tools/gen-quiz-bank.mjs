/**
 * Erzeugt server/src/quiz-bank.json aus der Quiz-Fragenbank.
 *
 * Ausgabe-Struktur:
 *   [
 *     {
 *       "lesson_id": "select-basics",
 *       "title": "Erste Abfrage mit SELECT",
 *       "questions": [
 *         {
 *           "question": "Was macht SELECT * FROM books?",
 *           "options": ["A", "B", "C", "D"],
 *           "correct_idx": 1,
 *           "time_limit": 20
 *         },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 *
 * Das verify-Feld wird NICHT exportiert (serverseitig nicht benötigt).
 * code-Felder werden mitexportiert.
 *
 * Aufruf: node tools/gen-quiz-bank.mjs
 * (Voraussetzung: Node.js >= 22 mit --experimental-strip-types)
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'server', 'src', 'quiz-bank.json');

const { QUIZ_BANK } = await import(join(ROOT, 'src/lib/tabula/course/quiz-bank.ts'), {
  with: { type: 'ts' },
}).catch(() => import(join(ROOT, 'src/lib/tabula/course/quiz-bank.js')));

// verify-Feld entfernen, nur serverseitig relevante Felder behalten
const result = QUIZ_BANK.map(entry => ({
  lesson_id: entry.lesson_id,
  title: entry.title,
  questions: entry.questions.map(q => {
    const out = {
      question: q.question,
      options: q.options,
      correct_idx: q.correct_idx,
      time_limit: q.time_limit,
    };
    if (q.code) out.code = q.code;
    return out;
  }),
}));

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`Geschrieben: ${OUT}`);
for (const entry of result) {
  console.log(`  ${entry.lesson_id}: ${entry.questions.length} Fragen`);
}
