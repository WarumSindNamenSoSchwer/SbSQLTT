// Erzeugt die echten Inhalte fuer die Startseiten-Mockups aus Datensatz, Lektionen und Pruefung.
// Aufruf: node --experimental-strip-types tools/landing-data.mjs > tools/landing-data.json
import initSqlJs from 'sql.js';
const { LESSONS, BOOKS_SEED } = await import('../src/lib/tabula/lessons.ts');
const { compare, run, readSchema, sqlHint } = await import('../src/lib/tabula/sql.ts');
const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(BOOKS_SEED);
const q = (s) => run(db, s).rows;
const where = LESSONS['where-filters'];
// Erste Uebung in Lektion 3: 'Neue Buecher' (year > 2020)
const ex = where.steps.find((s) => s.name === 'Neue Bücher');
// wrongWhere: fehlende Spalte year (typischer Fehler)
const wrongWhere = 'SELECT title\nFROM books\nWHERE year > 2020;';
const c1 = compare(run(db, wrongWhere), run(db, ex.solution), ex.ordered);
const joinEx = LESSONS['joins'].steps.find((s) => s.kind === 'exercise');
// Typischer Fehler genau dieser Übung (Feld wrong aus dem Kurs), mehrzeilig wie im Editor
const wrongJoin = joinEx.wrong.replace(/\s+FROM /, '\nFROM ').replace(/\s+JOIN /, '\nJOIN ');
const out = {
	// Hero: nur erste 6 Buecher nach ID (damit das Layout nicht platzt)
	books: q('SELECT title, year FROM books ORDER BY id LIMIT 6'),
	keepYear: 2020,
	result: q('SELECT title, year FROM books WHERE year > 2020 ORDER BY year'),
	schemaBooks: readSchema(db).find((t) => t.table === 'books').cols,
	studio: { task: ex.task, taskSub: ex.taskSub, stepNo: where.steps.indexOf(ex) + 1, stepOf: where.steps.length, lessonNo: where.no, tip: ex.tip },
	lessons: ['select-basics', 'select-columns', 'where-filters', 'order-limit'].map((id) => ({ no: LESSONS[id].no, title: LESSONS[id].title })),
	hint: { query: wrongWhere, sub: c1.ok ? '' : c1.sub, lesson: where.no },
	joinBooks: q('SELECT b.title, b.publisher_id FROM books b JOIN publishers p ON b.publisher_id = p.id WHERE b.year > 2010 ORDER BY b.id'),
	publishers: q('SELECT id, name FROM publishers ORDER BY id'),
	joinResult: q('SELECT b.title, p.name FROM books b JOIN publishers p ON b.publisher_id = p.id WHERE b.year > 2010 ORDER BY b.id'),
	teacherHelp: { task: joinEx.task, query: wrongJoin, msg: sqlHint(wrongJoin) },
	pathCounts: { grund: Object.values(LESSONS).filter((l) => l.track === 'beginner').length }
};
console.log(JSON.stringify(out, null, 1));
