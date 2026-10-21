/**
 * Erzeugt server/src/lesson-steps.json aus den Kursdateien.
 *
 * Ausgabe-Struktur:
 *   {
 *     "where-filters": {
 *       "exercise_steps": 14,   // Anzahl Uebungsschritte (kind === 'exercise')
 *       "total_steps": 16       // Gesamtanzahl Schritte (inkl. explain, example, summary)
 *     },
 *     "python": {
 *       "exercise_steps": 4,    // Anzahl Checklist-Items (PythonStep-Elemente)
 *       "total_steps": 4
 *     },
 *     "project": {
 *       "exercise_steps": 10,
 *       "total_steps": 12
 *     },
 *     ...
 *   }
 *
 * Aufruf: node tools/gen-lesson-steps.mjs
 * (Voraussetzung: Node.js >= 22 fuer --experimental-strip-types)
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'server', 'src', 'lesson-steps.json');

// SQL-Lektionen aus LESSONS-Record
const { LESSONS } = await import(join(ROOT, 'src/lib/tabula/lessons.ts'), {
  with: { type: 'ts' },
}).catch(() => import(join(ROOT, 'src/lib/tabula/lessons.js')));

// Python-Lektion (Checkliste): Schritte aus PYTHON_STEPS
const { PYTHON_STEPS } = await import(join(ROOT, 'src/lib/tabula/course/l10-python.ts'), {
  with: { type: 'ts' },
}).catch(() => import(join(ROOT, 'src/lib/tabula/course/l10-python.js')));

const result = {};

// SQL-Lektionen (inkl. Projekt)
for (const [id, lesson] of Object.entries(LESSONS)) {
  const totalSteps = lesson.steps.length;
  const exerciseSteps = lesson.steps.filter(s => s.kind === 'exercise').length;
  result[id] = { exercise_steps: exerciseSteps, total_steps: totalSteps };
}

// Python-Lektion (Checkliste, keine SQL-Uebungen)
const pythonStepCount = PYTHON_STEPS.length;
result['python'] = { exercise_steps: pythonStepCount, total_steps: pythonStepCount };

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`Geschrieben: ${OUT}`);
for (const [id, v] of Object.entries(result)) {
  console.log(`  ${id}: ${v.exercise_steps} Uebungen, ${v.total_steps} Schritte gesamt`);
}
