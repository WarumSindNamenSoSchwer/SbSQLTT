// Tabula core: echte SQLite-Engine (sql.js), Lektion 3, Prüfung, Highlighting, Edgar.
export const BOOKS_SEED = "\nCREATE TABLE publishers (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  country TEXT\n);\nCREATE TABLE books (\n  id INTEGER PRIMARY KEY,\n  title TEXT NOT NULL,\n  author TEXT NOT NULL,\n  year INTEGER,\n  pages INTEGER,\n  price REAL,\n  genre TEXT,\n  publisher_id INTEGER REFERENCES publishers(id)\n);\nCREATE TABLE loans (\n  id INTEGER PRIMARY KEY,\n  book_id INTEGER REFERENCES books(id),\n  student TEXT NOT NULL,\n  class TEXT NOT NULL,\n  loan_date TEXT NOT NULL,\n  return_date TEXT\n);\nINSERT INTO publishers VALUES\n  (1,'Addison-Wesley','USA'),\n  (2,'O''Reilly Media','USA'),\n  (3,'No Starch Press','USA'),\n  (4,'Nordlicht Verlag','Deutschland'),\n  (5,'Kranich Verlag','Österreich'),\n  (6,'Leuchtturm Comics','Deutschland');\nINSERT INTO books VALUES\n  (1,'Refactoring','Martin Fowler',2018,448,49.9,'Informatik',1),\n  (2,'Clean Code','Robert C. Martin',2008,464,39.9,'Informatik',1),\n  (3,'Database Internals','Alex Petrov',2019,370,54.0,'Informatik',2),\n  (4,'The Pragmatic Programmer','Andrew Hunt',1999,352,42.0,'Informatik',1),\n  (5,'Data-Intensive Apps','Martin Kleppmann',2017,616,44.9,'Informatik',2),\n  (6,'Head First SQL','Lynn Beighley',2007,608,29.9,'Informatik',2),\n  (7,'Die Stadt unter dem Eis','Jana Lorenz',2021,412,16.0,'Roman',4),\n  (8,'Nachtzug nach Riga','Jana Lorenz',2016,288,12.0,'Roman',4),\n  (9,'Das Rätsel von Haus 9','Tom Berger',2023,336,14.0,'Krimi',5),\n  (10,'Kalte Spur','Tom Berger',2019,304,NULL,'Krimi',5),\n  (11,'Wie Daten die Welt verändern','Aylin Demir',2022,240,22.0,'Sachbuch',4),\n  (12,'Klima in Zahlen','Aylin Demir',2024,196,24.0,'Sachbuch',5),\n  (13,'Pixelherz','Kim Sommer',2020,128,15.0,'Comic',6),\n  (14,'Pixelherz 2','Kim Sommer',2022,132,15.0,'Comic',6),\n  (15,'Roboter im Garten','Lukas Brandt',2015,96,9.9,'Comic',6),\n  (16,'Python für Einsteiger','Nora Fischer',2023,384,29.5,'Informatik',4),\n  (17,'Algorithmen verstehen','Nora Fischer',2016,420,34.9,'Informatik',5),\n  (18,'Der letzte Sommer am See','Mara Vogel',2012,256,11.0,'Roman',5),\n  (19,'Grenzgänger','Mara Vogel',2009,310,NULL,'Roman',4),\n  (20,'Mord im Lesesaal','Tom Berger',2025,344,16.5,'Krimi',5),\n  (21,'Die Geschichte des Internets','Felix Hahn',2014,280,19.9,'Sachbuch',2),\n  (22,'Sterne zählen','Aylin Demir',2011,180,13.0,'Sachbuch',4),\n  (23,'Mondstaub','Kim Sommer',2025,140,17.0,'Comic',6),\n  (24,'Das Netz der Lügen','Jana Lorenz',2024,398,18.0,'Krimi',4),\n  (25,'Learning SQL','Alan Beaulieu',2020,380,38.0,'Informatik',2),\n  (26,'Funkstille','Mara Vogel',2001,220,9.0,'Roman',5),\n  (27,'Code lesen lernen','Felix Hahn',2021,NULL,21.0,'Informatik',1),\n  (28,'Insel der Stürme','Lukas Brandt',1998,264,8.0,'Roman',4),\n  (29,'Das große Experimentierbuch','Felix Hahn',2005,160,14.9,'Sachbuch',5),\n  (30,'Schattenspiel','Tom Berger',2013,290,12.5,'Krimi',4);\nINSERT INTO loans VALUES\n  (1,1,'Paul Richter','Q1','2025-09-15','2025-10-19'),\n  (2,2,'Sofia Wagner','Q1','2026-01-25','2026-02-03'),\n  (3,3,'Lea Hoffmann','10a','2025-09-27','2025-10-05'),\n  (4,5,'Mia Kaya','10a','2025-08-19','2025-09-20'),\n  (5,6,'Hannah Klein','Q1','2025-08-17','2025-09-06'),\n  (6,7,'Lina Schmitt','Q2','2025-08-22',NULL),\n  (7,7,'Hannah Klein','Q1','2025-12-24','2026-01-22'),\n  (8,8,'Hannah Klein','Q1','2025-08-10','2025-08-21'),\n  (9,8,'Emma Schulz','10b','2025-09-22','2025-10-07'),\n  (10,8,'Sofia Wagner','Q1','2025-09-13','2025-10-06'),\n  (11,9,'Noah Becker','10b','2026-01-17','2026-02-02'),\n  (12,10,'Paul Richter','Q1','2025-10-16',NULL),\n  (13,11,'Paul Richter','Q1','2025-11-13','2025-11-28'),\n  (14,13,'Mia Kaya','10a','2025-12-06','2025-12-16'),\n  (15,13,'Paul Richter','Q1','2025-11-26','2025-12-09'),\n  (16,14,'Emma Schulz','10b','2025-11-19',NULL),\n  (17,14,'Paul Richter','Q1','2025-08-08','2025-09-05'),\n  (18,14,'Elias Yilmaz','10b','2025-10-14','2025-10-28'),\n  (19,15,'Lina Schmitt','Q2','2025-09-17','2025-09-25'),\n  (20,17,'Hannah Klein','Q1','2025-10-05','2025-11-04'),\n  (21,18,'Lea Hoffmann','10a','2025-10-21',NULL),\n  (22,18,'Elias Yilmaz','10b','2025-08-27','2025-09-10'),\n  (23,20,'Paul Richter','Q1','2026-01-20','2026-02-23'),\n  (24,21,'Lea Hoffmann','10a','2025-10-11','2025-11-09'),\n  (25,22,'Finn Wolf','Q2','2025-12-14','2026-01-15'),\n  (26,24,'Paul Richter','Q1','2026-01-13','2026-01-29'),\n  (27,24,'Lina Schmitt','Q2','2026-01-05','2026-01-18'),\n  (28,24,'Mia Kaya','10a','2025-08-18','2025-09-16'),\n  (29,26,'Sofia Wagner','Q1','2025-09-06','2025-09-29'),\n  (30,28,'Finn Wolf','Q2','2026-01-07',NULL),\n  (31,3,'Ben Neumann','Q2','2025-10-09',NULL),\n  (32,7,'Lina Schmitt','Q2','2025-10-08','2025-11-01'),\n  (33,13,'Sofia Wagner','Q1','2026-01-13',NULL),\n  (34,8,'Paul Richter','Q1','2025-11-05','2025-11-29'),\n  (35,24,'Paul Richter','Q1','2025-08-25','2025-09-14'),\n  (36,14,'Ben Neumann','Q2','2025-12-05','2026-01-06'),\n  (37,2,'Jonas Weber','10a','2025-09-02','2025-09-30'),\n  (38,9,'Sofia Wagner','Q1','2025-08-11','2025-09-09'),\n  (39,18,'Lea Hoffmann','10a','2025-09-05','2025-09-28'),\n  (40,11,'Noah Becker','10b','2025-11-04',NULL);\n";

// SQL-Engine lokal: /sql/sql-wasm.js und /sql/sql-wasm.wasm
const SQLJS = new URL('../sql/', import.meta.url).href;
let sqlP = null;
export function loadSql() {
  if (!sqlP) sqlP = new Promise((res, rej) => {
    const go = () => window.initSqlJs({ locateFile: f => SQLJS + f }).then(res, rej);
    if (window.initSqlJs) return go();
    const s = document.createElement('script'); s.src = SQLJS + 'sql-wasm.js'; s.onload = go; s.onerror = rej; document.head.appendChild(s);
  }).catch(e => { sqlP = null; throw e; });
  return sqlP;
}
export async function openDb(seed = BOOKS_SEED) { const SQL = await loadSql(); const db = new SQL.Database(); db.run(seed); return db; }
export function run(db, sql) { const r = db.exec(sql); const l = r[r.length - 1]; return l ? { columns: l.columns, rows: l.values } : { columns: [], rows: [] }; }
export function runChecked(db, sql) { db.run('SAVEPOINT tb'); try { return run(db, sql); } finally { db.run('ROLLBACK TO tb; RELEASE tb'); } }
export function readSchema(db) {
  return run(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").rows.map(([t]) => {
    const fks = new Set(run(db, 'PRAGMA foreign_key_list("' + t + '")').rows.map(r => r[3]));
    const count = run(db, 'SELECT COUNT(*) FROM "' + t + '"').rows[0][0];
    return { table: t, count, cols: run(db, 'PRAGMA table_info("' + t + '")').rows.map(r => ({ name: r[1], type: String(r[2]).toLowerCase().replace('integer', 'int'), key: r[5] ? 'PK' : fks.has(r[1]) ? 'FK' : '' })) };
  });
}
export function exportDb(db, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([db.export()], { type: 'application/vnd.sqlite3' })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const KEYWORDS = ['SELECT','FROM','WHERE','ORDER','BY','GROUP','HAVING','JOIN','ON','LIMIT','AND','OR','INSERT','INTO','VALUES','UPDATE','DELETE','CREATE','TABLE','PRIMARY','KEY','INTEGER','TEXT','REFERENCES','BETWEEN','LIKE','NULL','DISTINCT'];
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)); return d[a.length][b.length]; }
export function explainError(sql, err) {
  const orig = String(err && err.message || err), lines = sql.split('\n');
  for (let i = 0; i < lines.length; i++) for (const w of lines[i].replace(/'[^']*'/g, '').match(/[A-Za-z_]+/g) || []) {
    const up = w.toUpperCase(); if (KEYWORDS.includes(up) || w.length < 3) continue;
    const hit = KEYWORDS.find(k => k.length >= 4 && lev(up, k) === 1);
    if (hit && /^[A-Z]+$/.test(w)) return { msg: 'Zeile ' + (i + 1) + ': „' + w + '“ kennt SQL nicht. Meintest du ' + hit + '?', line: i + 1, orig };
  }
  const lineOf = n => { const i = lines.findIndex(l => l.toLowerCase().includes(n.toLowerCase())); return i >= 0 ? i + 1 : null; };
  let m = orig.match(/no such column: ([\w.]+)/); if (m) return { msg: 'Die Spalte „' + m[1] + '“ gibt es nicht. Schau ins Schema.', line: lineOf(m[1]), orig };
  m = orig.match(/no such table: (\w+)/); if (m) return { msg: 'Die Tabelle „' + m[1] + '“ gibt es nicht. Schau ins Schema.', line: lineOf(m[1]), orig };
  m = orig.match(/near "([^"]+)": syntax error/); if (m) { const l = lineOf(m[1]); return { msg: (l ? 'Zeile ' + l + ': ' : '') + 'Syntaxfehler bei „' + m[1] + '“.', line: l, orig }; }
  if (/incomplete input/.test(orig)) return { msg: 'Die Abfrage ist unvollständig. Fehlt noch etwas am Ende?', line: lines.length, orig };
  return { msg: 'SQL konnte die Abfrage nicht ausführen.', line: null, orig };
}
export function compare(got, want, ordered) {
  const no = 'Noch nicht ganz.', lc = a => a.map(x => x.toLowerCase());
  const missing = want.columns.filter(c => !lc(got.columns).includes(c.toLowerCase()));
  const extra = got.columns.filter(c => !lc(want.columns).includes(c.toLowerCase()));
  const key = r => JSON.stringify(r);
  const proj = (res, cols) => { const idx = cols.map(c => res.columns.findIndex(x => x.toLowerCase() === c.toLowerCase())); return res.rows.map(r => idx.map(i => i < 0 ? null : r[i])); };
  const shared = want.columns.filter(c => !missing.includes(c));
  const g = proj(got, shared).map(key), w = proj(want, shared).map(key);
  const sameSet = shared.length > 0 && g.length === w.length && [...g].sort().join() === [...w].sort().join();
  const rowsHint = () => { const d = got.rows.length - want.rows.length; if (d > 0) return d + (d === 1 ? ' Zeile' : ' Zeilen') + ' zu viel.'; if (d < 0) return -d + (d === -1 ? ' Zeile' : ' Zeilen') + ' zu wenig.'; const gs = new Set(g); const miss = proj(want, shared).find(r => !gs.has(key(r))); return miss ? 'Die Anzahl stimmt, aber diese Zeile fehlt: ' + miss.map(v => v === null ? 'NULL' : String(v)).join(', ') + '.' : 'Die Zeilen stimmen noch nicht.'; };
  if (missing.length) return { ok: false, msg: no, sub: sameSet ? 'Die Zeilen stimmen. Es fehlt die Spalte ' + missing.join(', ') + '.' : 'Es fehlt die Spalte ' + missing.join(', ') + '. ' + rowsHint() };
  if (!sameSet) return { ok: false, msg: no, sub: rowsHint() };
  if (extra.length) return { ok: false, msg: no, sub: 'Die Spalte ' + extra.join(', ') + ' ist zu viel.' };
  if (ordered && g.join() !== w.join()) return { ok: false, msg: no, sub: 'Die Zeilen stimmen. Die Reihenfolge noch nicht.' };
  return { ok: true };
}

const ex = (name, task, taskSub, solution, okSub, tip, starter = '') => ({ kind: 'exercise', name, type: 'Übung', task, taskSub, solution, okSub, tip, starter, ordered: /ORDER BY/i.test(solution), cols: (solution.match(/SELECT\s+(?:DISTINCT\s+)?([\s\S]*?)\s+FROM/i) || [, ''])[1].split(',').map(s => s.trim().split(/\s+AS\s+/i).pop()) });
export const LESSON = {
  id: 'where-filters', no: 3, of: 11, title: 'Mit WHERE filtern', track: 'SQL-Grundlagen', db: 'schulbibliothek.db',
  steps: [
    { kind: 'explain', name: 'Warum filtern?', type: 'Erklärung', title: 'Warum filtern?', paras: [
      'Eine Tabelle enthält oft viel mehr Zeilen, als du für eine Frage brauchst. Mit WHERE sortierst du die anderen aus. Nach WHERE folgt eine Bedingung, zum Beispiel year > 2010. SQL prüft sie für jede Zeile. Nur Zeilen, für die sie stimmt, kommen ins Ergebnis.',
      "Vergleichen kannst du mit =, <> (ungleich), <, >, <= und >=. Text steht in einfachen Anführungszeichen: genre = 'Krimi'. Mit AND müssen beide Bedingungen stimmen, mit OR reicht eine.",
      'Leere Felder findest du nur mit IS NULL, nicht mit = NULL.'], example: 'SELECT title, year\nFROM books\nWHERE year > 2010;' },
    { kind: 'example', name: 'So ist WHERE aufgebaut', type: 'Beispiel', task: 'So sieht eine Abfrage mit WHERE aus.', taskSub: 'Die Abfrage ist schon da. Führe sie aus und sieh dir das Ergebnis an.', code: 'SELECT title, year\nFROM books\nWHERE year > 2010;', sub: 'Ändere die Jahreszahl und führe die Abfrage noch einmal aus.' },
    ex('Neue Bücher', 'Welche Bücher sind nach 2020 erschienen?', 'Zeige title und year.', 'SELECT title, year\nFROM books\nWHERE year > 2020;', 'WHERE lässt nur die passenden Zeilen durch.', 'Schau dir die Jahreszahl in deiner Bedingung an. Sollen Bücher aus 2020 selbst dabei sein?', 'SELECT title, year\nFROM books\nWHERE '),
    ex('Nur Comics', 'Welche Comics hat die Bibliothek?', 'Zeige nur title für alle Bücher mit dem Genre Comic.', "SELECT title\nFROM books\nWHERE genre = 'Comic';", 'Text vergleichst du in einfachen Anführungszeichen.', "Die Bedingung lautet genre = 'Comic'. Achte auf die Anführungszeichen und die Großschreibung.", 'SELECT title\nFROM books\nWHERE '),
    ex('Zwei Bedingungen', 'Welche Krimis sind nach 2015 erschienen?', 'Zeige title und year.', "SELECT title, year\nFROM books\nWHERE genre = 'Krimi' AND year > 2015;", 'Mit AND müssen beide Bedingungen stimmen.', 'Du brauchst zwei Bedingungen: eine für das Genre und eine für das Jahr. Verbinde sie mit AND.'),
    ex('Eins von beiden', 'Was gibt es an Comics und Sachbüchern?', 'Zeige title und genre für alle Bücher, die Comic oder Sachbuch sind.', "SELECT title, genre\nFROM books\nWHERE genre = 'Comic' OR genre = 'Sachbuch';", 'Mit OR reicht es, wenn eine Bedingung stimmt.', 'Ein Buch kann nicht gleichzeitig Comic und Sachbuch sein. Mit AND bekommst du deshalb nichts. Probiere OR.'),
    ex('Preisbereich', 'Welche Bücher kosten zwischen 10 und 15 Euro?', 'Zeige title und price. Bücher für genau 10 oder 15 Euro gehören dazu.', 'SELECT title, price\nFROM books\nWHERE price BETWEEN 10 AND 15;', 'BETWEEN schließt beide Grenzen ein.', 'Mit > und < fallen die Bücher für genau 15 Euro heraus. BETWEEN 10 AND 15 nimmt die Grenzen mit.'),
    ex('Ohne Preis', 'Bei welchen Büchern fehlt der Preis?', 'Zeige title für alle Bücher, bei denen price leer ist.', 'SELECT title\nFROM books\nWHERE price IS NULL;', 'Leere Felder findest du nur mit IS NULL.', 'price = NULL liefert nie ein Ergebnis, weil NULL kein Wert ist. Schreibe price IS NULL.'),
    { kind: 'summary', name: 'Fazit', type: 'Zusammenfassung', title: 'Das hast du gelernt', points: ['WHERE filtert Zeilen. Nur Zeilen, für die die Bedingung stimmt, kommen ins Ergebnis.', 'Vergleiche: =, <>, <, >, <=, >=. Text steht in Anführungszeichen.', 'AND, OR, IN, BETWEEN und LIKE bauen größere Bedingungen.', 'Leere Felder findest du mit IS NULL.'], real: 'Ein Onlineshop zeigt dir nur Produkte, die auf Lager sind. Eine Schule sucht alle Schüler einer Klasse. Hinter beidem steckt eine Abfrage mit WHERE.' }
  ],
  done: { sub: 'Du kannst jetzt gezielt die Zeilen auswählen, die du brauchst.', points: ['WHERE filtert Zeilen nach einer Bedingung.', 'AND, OR, IN, BETWEEN und LIKE kombinieren.', 'IS NULL findet leere Felder.'] },
  next: { id: 'order-limit', title: 'Ergebnisse sortieren' }
};

export const CATALOG = [
  { n: '1', id: 'select-basics', title: 'Erste Abfrage mit SELECT', dur: '15 min', track: 1, tags: ['SELECT', 'FROM'] },
  { n: '2', id: 'select-columns', title: 'Spalten auswählen und umbenennen', dur: '15 min', track: 1, tags: ['AS', 'DISTINCT'] },
  { n: '3', id: 'where-filters', title: 'Mit WHERE filtern', dur: '20 min', track: 1, tags: ['WHERE', 'AND', 'LIKE'] },
  { n: '4', id: 'order-limit', title: 'Ergebnisse sortieren', dur: '15 min', track: 1, tags: ['ORDER BY', 'LIMIT'] },
  { n: '5', id: 'aggregates', title: 'Zählen und zusammenfassen', dur: '20 min', track: 1, tags: ['COUNT', 'AVG'] },
  { n: '6', id: 'group-by', title: 'Gruppieren mit GROUP BY', dur: '25 min', track: 1, tags: ['GROUP BY', 'HAVING'] },
  { n: '7', id: 'joins', title: 'Tabellen verbinden mit JOIN', dur: '25 min', track: 1, tags: ['JOIN', 'ON'] },
  { n: '8', id: 'subqueries', title: 'Unterabfragen', dur: '25 min', track: 1, tags: ['IN (SELECT …)'] },
  { n: '9', id: 'ddl', title: 'Eigene Datenbank entwerfen', dur: '45 min', track: 2, tags: ['CREATE TABLE', 'PRIMARY KEY', 'FOREIGN KEY'] },
  { n: '10', id: 'python', title: 'Daten mit Python und pandas auswerten', dur: '45 min', track: 3, tags: ['sqlite3', 'pandas'] },
  { n: 'P', id: 'project', title: 'Projekt: Eigene Datenanalyse', dur: '90 min', track: 3, tags: ['Eigene Fragestellung'] }
];
export const TRACKS = [
  { num: 1, name: 'SQL-Grundlagen', desc: 'Abfragen schreiben und Ergebnisse verstehen' },
  { num: 2, name: 'Eigene Datenbank', desc: 'Tabellen entwerfen, Schlüssel setzen' },
  { num: 3, name: 'Python & Daten', desc: 'Mit pandas eigene Fragen beantworten' }
];

const KW = new Set(['SELECT','FROM','WHERE','AND','OR','NOT','IN','BETWEEN','LIKE','IS','NULL','ORDER','BY','ASC','DESC','LIMIT','GROUP','HAVING','JOIN','LEFT','INNER','ON','AS','DISTINCT','COUNT','SUM','AVG','MIN','MAX','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','PRIMARY','KEY','REFERENCES','INTEGER','TEXT','REAL']);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function highlight(sql) {
  return sql.replace(/(--[^\n]*)|('(?:[^']|'')*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([^\w\s])|(\s+)/g, (m, com, str, num, id, pun) => {
    if (com) return '<span style="color:var(--tok-com);font-style:italic">' + esc(m) + '</span>';
    if (str) return '<span style="color:var(--tok-str)">' + esc(m) + '</span>';
    if (num) return '<span style="color:var(--tok-num)">' + m + '</span>';
    if (id) return KW.has(m.toUpperCase()) ? '<span style="color:var(--tok-kw);font-weight:500">' + m + '</span>' : esc(m);
    if (pun) return '<span style="color:var(--ink-3)">' + esc(m) + '</span>';
    return m;
  }) + '\n';
}

let G = null;
export async function loadOwl() { if (!G) G = (await import('./owl-gen.js')).default; return G; }
/** Malt alle [data-owl] Elemente in root. data-owl-static="1" = ohne Animation. Posenwechsel werden weich überblendet. */
export function paintOwls(root, dark) {
  if (!G || !root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-owl]').forEach(el => {
    const key = el.getAttribute('data-owl') || 'idle';
    const still = reduce || el.getAttribute('data-owl-static') === '1' || !G.ANIMS[key];
    const tag = key + (dark ? '-d' : '') + (still ? '-s' : '-a');
    if (el.dataset.cur === tag && el.firstElementChild) return;
    const opt = dark ? G.DARK : {};
    const svg = (still ? (key === 'sleep' ? G.sleep(opt) : G.owl({ ...(G.STATES[key] || {}), ...opt })) : G.animSvg(key, opt))
      .replace('<svg ', '<svg aria-hidden="true" focusable="false" style="width:100%;height:100%;display:block;overflow:visible" ');
    const poseChange = el.dataset.key && el.dataset.key !== key && el.firstElementChild && !reduce;
    el.style.display = 'grid';
    const layer = document.createElement('div');
    layer.style.cssText = 'grid-area:1/1;width:100%;height:100%;min-width:0;min-height:0';
    layer.innerHTML = svg;
    [...el.children].forEach(old => {
      if (!poseChange) { old.remove(); return; }
      old.style.transition = 'opacity .28s ease, transform .35s cubic-bezier(.16,1,.3,1)';
      old.style.opacity = '0'; old.style.transform = 'scale(.94) translateY(4px)';
      setTimeout(() => old.remove(), 360);
    });
    if (poseChange) {
      layer.style.opacity = '0'; layer.style.transform = 'scale(.94) translateY(6px)';
      layer.style.transition = 'opacity .3s ease .06s, transform .45s cubic-bezier(.34,1.56,.64,1) .06s';
      requestAnimationFrame(() => requestAnimationFrame(() => { layer.style.opacity = '1'; layer.style.transform = 'none'; }));
    }
    el.appendChild(layer);
    el.dataset.cur = tag; el.dataset.key = key;
  });
}
export function getTheme(def) { try { return localStorage.getItem('tabula-theme') || def; } catch (e) { return def; } }
export function setTheme(t) { document.documentElement.dataset.tb = t; try { localStorage.setItem('tabula-theme', t); } catch (e) {} }
