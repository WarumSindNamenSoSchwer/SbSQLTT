// Beispieldaten für den Lehrerbereich und das Live-Quiz (synthetisch).
export const QR_PATH = "M0 0.5h7m4 0h2m3 0h1m1 0h7M0 1.5h1m5 0h1m5 0h1m2 0h1m2 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h1m5 0h3m1 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h2m2 0h3m3 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h1m1 0h1m2 0h1m1 0h2m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h2m2 0h1m1 0h3M0 8.5h1m1 0h5m4 0h1m1 0h4m1 0h5M1 9.5h1m1 0h1m1 0h1m2 0h2m4 0h1m1 0h2m1 0h1m3 0h1M2 10.5h1m1 0h3m3 0h1m4 0h1m1 0h5m1 0h2M1 11.5h1m1 0h1m1 0h1m1 0h6m1 0h1m2 0h1m1 0h1m4 0h1M0 12.5h3m2 0h2m1 0h1m1 0h2m1 0h3m1 0h4m1 0h3M0 13.5h3m2 0h1m2 0h3m1 0h2m2 0h2m1 0h1m1 0h1m1 0h1M0 14.5h1m1 0h1m3 0h2m1 0h1m4 0h8m1 0h2M0 15.5h1m2 0h2m3 0h2m2 0h1m2 0h1m1 0h1m1 0h2m3 0h1M0 16.5h1m1 0h2m1 0h3m2 0h1m1 0h2m1 0h6m1 0h1M8 17.5h2m3 0h1m1 0h2m3 0h2M0 18.5h7m4 0h4m1 0h1m1 0h1m1 0h1m1 0h3M0 19.5h1m5 0h1m1 0h4m4 0h1m3 0h2m2 0h1M0 20.5h1m1 0h3m1 0h1m1 0h13m1 0h1M0 21.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m2 0h1m2 0h1m1 0h5M0 22.5h1m1 0h3m1 0h1m1 0h3m3 0h1m6 0h2m1 0h1M0 23.5h1m5 0h1m3 0h1m5 0h2m1 0h3m2 0h1M0 24.5h7m1 0h1m3 0h3m4 0h6";
export const LESSONS = [
  { id: 'select-basics', n: '1', title: 'Erste Abfrage mit SELECT', track: 1, steps: 8 },
  { id: 'select-columns', n: '2', title: 'Spalten auswählen und umbenennen', track: 1, steps: 9 },
  { id: 'where-filters', n: '3', title: 'Mit WHERE filtern', track: 1, steps: 17 },
  { id: 'order-limit', n: '4', title: 'Ergebnisse sortieren', track: 1, steps: 10 },
  { id: 'aggregates', n: '5', title: 'Zählen und zusammenfassen', track: 1, steps: 11 },
  { id: 'group-by', n: '6', title: 'Gruppieren mit GROUP BY', track: 1, steps: 12 },
  { id: 'joins', n: '7', title: 'Tabellen verbinden mit JOIN', track: 1, steps: 14 },
  { id: 'subqueries', n: '8', title: 'Unterabfragen', track: 1, steps: 12 },
  { id: 'ddl', n: '9', title: 'Eigene Datenbank entwerfen', track: 2, steps: 16 },
  { id: 'python', n: '10', title: 'Daten mit Python und pandas auswerten', track: 3, steps: 8 },
  { id: 'project', n: 'P', title: 'Projekt: Eigene Datenanalyse', track: 3, steps: 6 }
];
export const TRACKS = ['SQL-Grundlagen', 'Eigene Datenbank', 'Python & Daten'];
const NAMES = ['Mia K.', 'Jonas S.', 'Lea A.', 'Tim B.', 'Noah W.', 'Emma R.', 'Ben H.', 'Sophie L.', 'Paul M.', 'Hannah F.', 'Elias T.', 'Lina G.', 'Finn D.', 'Marie P.', 'Luca Z.', 'Ella N.', 'Ali Y.', 'Clara V.', 'Leon E.', 'Ida J.', 'Milan O.', 'Nele C.'];
let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
export const STUDENTS = NAMES.map((name, i) => {
  // Status pro Lektion: 2 = fertig, 1 = begonnen, 3 = hängt fest, 0 = offen
  const m = [2, 2, i < 12 ? 2 : i < 18 ? 1 : 0, i < 6 ? 1 : 0, 0, 0, 0, 0, 0, 0, 0];
  if (i === 0) m[2] = 3; if (i === 1) m[2] = 3; if (i === 19) m[1] = 1;
  if (i >= 20) { m[0] = 1; m[1] = 0; m[2] = 0; }
  const ago = Math.round(rnd() * 40) + 1;
  return { id: i + 1, name, joined: (10 + (i % 6)) + '.10.2026', m, step: m[2] === 2 ? 17 : m[2] === 3 ? [9, 6][i] : m[2] === 1 ? 4 + (i % 9) : 0, fails: m[2] === 3 ? [4, 5][i] : m[2] === 1 ? i % 3 : 0, ago: m[2] === 0 && i >= 20 ? 'gestern' : 'vor ' + ago + ' min' };
});
export const STUCK = {
  1: { task: 'Welche Krimis sind nach 2015 erschienen?', sql: "SELECT title, year\nFROM books\nWHERE genre = 'Krimi' OR year > 2015;", err: 'Noch nicht ganz. 14 Zeilen zu viel.', when: 'vor 1 min' },
  2: { task: 'Welche Bücher kosten zwischen 10 und 15 Euro?', sql: 'SELECT title, price\nFROM books\nWHERE price > 10 AND price < 15;', err: 'Die Anzahl stimmt nicht: 3 Zeilen zu wenig.', when: 'vor 3 min' }
};
export const QUIZ_SETS = [
  { id: 'auto-3', title: 'Mit WHERE filtern', auto: true, lesson: 'where-filters', q: 8, min: 6 },
  { id: 'auto-1', title: 'Erste Abfrage mit SELECT', auto: true, lesson: 'select-basics', q: 6, min: 4 },
  { id: 'auto-2', title: 'Spalten auswählen und umbenennen', auto: true, lesson: 'select-columns', q: 6, min: 4 },
  { id: 'auto-4', title: 'Ergebnisse sortieren', auto: true, lesson: 'order-limit', q: 7, min: 5 },
  { id: 'auto-7', title: 'Tabellen verbinden mit JOIN', auto: true, lesson: 'joins', q: 8, min: 6 },
  { id: 'own-1', title: 'Wiederholung vor der Klausur', auto: false, q: 10, min: 8 }
];
export const QUESTIONS = [
  { type: 'Was gibt die Abfrage zurück?', text: 'Wie viele Zeilen liefert diese Abfrage?', sql: "SELECT title FROM books\nWHERE genre = 'Comic';", answers: ['3', '4', '5', '30'], right: 1, time: 20, why: 'Die Bibliothek hat vier Comics: Pixelherz, Pixelherz 2, Roboter im Garten und Mondstaub.' },
  { type: 'Welche Abfrage?', text: 'Welche Abfrage findet alle Bücher ohne Preis?', sql: '', answers: ['WHERE price = NULL', 'WHERE price IS NULL', 'WHERE price = 0', "WHERE price = ''"], right: 1, time: 20, why: 'NULL ist kein Wert. Leere Felder findest du nur mit IS NULL.' },
  { type: 'Wo ist der Fehler?', text: 'Warum liefert diese Abfrage nichts?', sql: "SELECT title FROM books\nWHERE genre = 'Comic'\n  AND genre = 'Sachbuch';", answers: ['Tippfehler in genre', 'AND statt OR', 'Fehlende Klammern', 'Falsche Tabelle'], right: 1, time: 30, why: 'Ein Buch hat nur ein Genre. Mit AND müssten beide Bedingungen gleichzeitig stimmen.' },
  { type: 'Welche Abfrage?', text: 'Welche Klausel filtert zusammengefasste Gruppen?', sql: '', answers: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'], right: 1, time: 20, why: 'WHERE filtert Zeilen vor dem Gruppieren, HAVING filtert danach die Gruppen.' }
];
export const PLAYERS = ['Mia', 'Jonas', 'Lea', 'Tim', 'Noah', 'Emma', 'Ben', 'Sophie', 'Paul', 'Hannah', 'Elias', 'Lina', 'Finn', 'Marie', 'Luca', 'Ella', 'Ali'];
