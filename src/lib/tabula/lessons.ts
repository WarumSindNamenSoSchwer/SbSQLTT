// Lektionsinhalte. Datensatz und Texte 1:1 aus dem Design (Lektion B2).
import type { Result } from './sql';

export const BOOKS_SEED = `
CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  year INTEGER,
  publisher_id INTEGER REFERENCES publishers(id)
);
CREATE TABLE publishers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO publishers VALUES (1,'Addison-Wesley'),(2,'O''Reilly Media'),(3,'No Starch Press');
INSERT INTO books VALUES
  (1,'Refactoring',2018,1),
  (2,'Clean Code',2008,1),
  (3,'Database Internals',2019,2),
  (4,'The Pragmatic Programmer',1999,1),
  (5,'Data-Intensive Apps',2017,2),
  (6,'Head First SQL',2007,2);
`;

export type Step =
	| { kind: 'explain'; name: string; type: 'Erklärung'; title: string; paras: string[]; example: string }
	| {
			kind: 'example';
			name: string;
			type: 'Beispiel';
			task: string;
			taskSub: string;
			code: string;
			msg: (r: Result, total: number) => string;
			sub: string;
	  }
	| {
			kind: 'exercise';
			name: string;
			type: 'Übung';
			task: string;
			taskSub: string;
			starter: string;
			solution: string;
			ordered: boolean;
			okMsg: string;
			okSub: string;
			tip: string;
	  }
	| { kind: 'summary'; name: string; type: 'Zusammenfassung'; title: string; points: string[]; real: string };

export type Lesson = {
	id: string;
	track: string;
	trackLabel: string;
	no: number;
	of: number;
	title: string;
	db: { name: string; seed: string; mainTable: string };
	steps: Step[];
	done: { sub: string; points: string[] };
	next?: { id: string; title: string };
};

const where: Lesson = {
	id: 'where-filters',
	track: 'beginner',
	trackLabel: 'SQL-GRUNDLAGEN',
	no: 3,
	of: 8,
	title: 'Mit WHERE filtern',
	db: { name: 'books.db', seed: BOOKS_SEED, mainTable: 'books' },
	steps: [
		{
			kind: 'explain',
			name: 'Warum filtern?',
			type: 'Erklärung',
			title: 'Warum filtern?',
			paras: [
				'Eine Tabelle enthält oft viel mehr Zeilen, als du für eine Frage brauchst. In books stehen alle Bücher, egal aus welchem Jahr. Wenn du nur die neueren sehen willst, musst du die anderen aussortieren.',
				'Dafür gibt es WHERE. Nach WHERE folgt eine Bedingung, zum Beispiel year > 2010. SQL prüft sie für jede Zeile. Nur Zeilen, für die sie stimmt, kommen ins Ergebnis.',
				'WHERE steht immer nach FROM. Die Tabelle selbst bleibt dabei unverändert. Du bestimmst nur, welche Zeilen angezeigt werden.'
			],
			example: 'SELECT title, year\nFROM books\nWHERE year > 2010;'
		},
		{
			kind: 'example',
			name: 'So ist WHERE aufgebaut',
			type: 'Beispiel',
			task: 'So sieht eine Abfrage mit WHERE aus.',
			taskSub: 'Die Abfrage ist schon da. Führe sie aus und sieh dir das Ergebnis an.',
			code: 'SELECT title, year\nFROM books\nWHERE year > 2010;',
			msg: (r, total) => `${r.rows.length} von ${total} Büchern erfüllen die Bedingung year > 2010.`,
			sub: 'Ändere die Jahreszahl und führe die Abfrage noch einmal aus.'
		},
		{
			kind: 'exercise',
			name: 'Bücher nach 2010',
			type: 'Übung',
			task: 'Welche Bücher sind nach 2010 erschienen?',
			taskSub: 'Zeige Titel und Jahr. Sortiere die ältesten zuerst.',
			starter: 'SELECT title, year\nFROM books\nWHERE ',
			solution: 'SELECT title, year\nFROM books\nWHERE year > 2010\nORDER BY year;',
			ordered: true,
			okMsg: 'Richtig! Genau die Bücher nach 2010.',
			okSub: 'Titel, Jahr und Reihenfolge stimmen.',
			tip: 'Schau dir die Jahreszahl in deiner Bedingung an. Welche Bücher sollen laut Aufgabe gerade nicht mehr dabei sein?'
		},
		{
			kind: 'exercise',
			name: 'Bedingungen kombinieren',
			type: 'Übung',
			task: 'Welche Bücher von O’Reilly sind vor 2010 erschienen?',
			taskSub: 'O’Reilly hat die publisher_id 2. Zeige nur den Titel.',
			starter: 'SELECT title\nFROM books\nWHERE ',
			solution: 'SELECT title\nFROM books\nWHERE publisher_id = 2 AND year < 2010;',
			ordered: false,
			okMsg: 'Richtig! Beide Bedingungen sitzen.',
			okSub: 'Mit AND müssen beide Bedingungen stimmen.',
			tip: 'Du brauchst zwei Bedingungen: eine für den Verlag und eine für das Jahr. Verbinde sie mit AND.'
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'WHERE filtert Zeilen. Nur Zeilen, für die die Bedingung stimmt, kommen ins Ergebnis.',
				'WHERE steht nach FROM und vor ORDER BY.',
				'Vergleichen kannst du mit =, <>, <, >, <= und >=.',
				'Mit AND und OR verbindest du mehrere Bedingungen.'
			],
			real: 'Ein Onlineshop zeigt dir nur Produkte, die auf Lager sind. Eine Schule sucht alle Lernenden einer Klasse. Hinter beidem steckt eine Abfrage mit WHERE.'
		}
	],
	done: {
		sub: 'Du kannst jetzt gezielt die Zeilen auswählen, die du brauchst.',
		points: ['WHERE filtert Zeilen nach einer Bedingung.', 'Vergleiche funktionieren mit =, <>, <, > und Co.', 'AND und OR verbinden mehrere Bedingungen.']
	},
	next: { id: 'order-limit', title: 'Ergebnisse sortieren' }
};

export const LESSONS: Record<string, Lesson> = { [where.id]: where };
