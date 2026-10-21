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

export type CatalogEntry = { n: string; id: string; title: string; dur: string; track: 1 | 2 | 3 };

/** Lernpfad (Design A2). Nur Lektionen mit Inhalt in LESSONS sind schon spielbar. */
export const CATALOG: CatalogEntry[] = [
	{ n: '1', id: 'select-basics', title: 'Erste Abfrage mit SELECT', dur: '15 min', track: 1 },
	{ n: '2', id: 'select-columns', title: 'Spalten auswählen und umbenennen', dur: '15 min', track: 1 },
	{ n: '3', id: 'where-filters', title: 'Mit WHERE filtern', dur: '20 min', track: 1 },
	{ n: '4', id: 'order-limit', title: 'Ergebnisse sortieren', dur: '15 min', track: 1 },
	{ n: '5', id: 'aggregates', title: 'Zählen und zusammenfassen', dur: '20 min', track: 1 },
	{ n: '6', id: 'group-by', title: 'Gruppieren mit GROUP BY', dur: '25 min', track: 1 },
	{ n: '7', id: 'joins', title: 'Tabellen verbinden mit JOIN', dur: '25 min', track: 1 },
	{ n: '8', id: 'subqueries', title: 'Unterabfragen', dur: '25 min', track: 1 },
	{ n: '9', id: 'ddl', title: 'Eigene Datenbank entwerfen', dur: '45 min', track: 2 },
	{ n: '10', id: 'python', title: 'Daten mit Python und pandas auswerten', dur: '45 min', track: 3 },
	{ n: 'P', id: 'project', title: 'Projekt: Eigene Datenanalyse', dur: '90 min', track: 3 }
];

export const TRACK_INFO = [
	{ num: '01', id: 'beginner', name: 'SQL-Grundlagen', desc: 'Abfragen schreiben und Ergebnisse verstehen' },
	{ num: '02', id: 'database', name: 'Eigene Datenbank', desc: 'Tabellen entwerfen, Schlüssel setzen' },
	{ num: '03', id: 'python', name: 'Python & Daten', desc: 'Mit pandas eigene Fragen beantworten' }
];

// ---- Fortschritt (Gast: nur im Browser) -----------------------------------
export type Progress = Record<string, { done?: boolean; step?: number; of?: number }>;
const KEY = 'tabula-progress';
export function loadProgress(): Progress {
	try {
		return JSON.parse(localStorage.getItem(KEY) || '{}');
	} catch {
		return {};
	}
}
export function saveProgress(id: string, patch: Progress[string]) {
	try {
		const p = loadProgress();
		p[id] = { ...p[id], ...patch };
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		/* ignore */
	}
}

const DB = { name: 'books.db', seed: BOOKS_SEED, mainTable: 'books' };
const base = { track: 'beginner', trackLabel: 'SQL-GRUNDLAGEN', of: 8, db: DB };

const selectBasics: Lesson = {
	...base,
	id: 'select-basics',
	no: 1,
	title: 'Erste Abfrage mit SELECT',
	steps: [
		{
			kind: 'explain',
			name: 'Was ist eine Tabelle?',
			type: 'Erklärung',
			title: 'Was ist eine Tabelle?',
			paras: [
				'Eine Datenbank speichert Daten in Tabellen. Jede Zeile ist ein Datensatz, zum Beispiel ein Buch. Jede Spalte ist eine Eigenschaft, zum Beispiel der Titel oder das Erscheinungsjahr.',
				'Mit SELECT fragst du Daten ab. Nach FROM steht, aus welcher Tabelle die Daten kommen. Der Stern * bedeutet: alle Spalten.',
				'Die Abfrage verändert nichts an der Tabelle. Sie zeigt dir nur, was drinsteht.'
			],
			example: 'SELECT *\nFROM books;'
		},
		{
			kind: 'example',
			name: 'Alle Bücher anzeigen',
			type: 'Beispiel',
			task: 'So sieht deine erste Abfrage aus.',
			taskSub: 'Die Abfrage ist schon da. Führe sie aus und sieh dir alle Spalten an.',
			code: 'SELECT *\nFROM books;',
			msg: (r) => `Die Tabelle books hat ${r.rows.length} Zeilen und ${r.columns.length} Spalten.`,
			sub: 'Links im Schema siehst du dieselben Spalten.'
		},
		{
			kind: 'exercise',
			name: 'Alle Verlage',
			type: 'Übung',
			task: 'Welche Verlage gibt es?',
			taskSub: 'Zeige alle Spalten der Tabelle publishers.',
			starter: 'SELECT *\nFROM ',
			solution: 'SELECT *\nFROM publishers;',
			ordered: false,
			okMsg: 'Richtig! Das sind alle Verlage.',
			okSub: 'Du hast deine erste eigene Abfrage geschrieben.',
			tip: 'Der Tabellenname kommt nach FROM. Im Schema links stehen beide Tabellen.'
		},
		{
			kind: 'exercise',
			name: 'Nur eine Spalte',
			type: 'Übung',
			task: 'Wie heißen alle Bücher?',
			taskSub: 'Zeige nur die Spalte title aus books.',
			starter: 'SELECT \nFROM books;',
			solution: 'SELECT title\nFROM books;',
			ordered: false,
			okMsg: 'Richtig! Nur die Titel, sonst nichts.',
			okSub: 'Statt * kannst du einzelne Spalten nennen.',
			tip: 'Ersetze den Stern durch den Namen der Spalte, die du sehen willst.'
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'Daten liegen in Tabellen aus Zeilen und Spalten.',
				'SELECT wählt aus, was du sehen willst. FROM sagt, woher.',
				'* steht für alle Spalten.',
				'Eine Abfrage ändert die Daten nicht.'
			],
			real: 'Jede App mit einer Liste, ob Musik, Nachrichten oder Noten, lädt ihre Einträge mit einer Abfrage wie SELECT … FROM aus einer Datenbank.'
		}
	],
	done: {
		sub: 'Du kannst jetzt Daten aus einer Tabelle abfragen.',
		points: ['SELECT und FROM bilden jede Abfrage.', '* zeigt alle Spalten.', 'Einzelne Spalten nennst du mit Namen.']
	},
	next: { id: 'select-columns', title: 'Spalten auswählen und umbenennen' }
};

const selectColumns: Lesson = {
	...base,
	id: 'select-columns',
	no: 2,
	title: 'Spalten auswählen und umbenennen',
	steps: [
		{
			kind: 'explain',
			name: 'Gezielt auswählen',
			type: 'Erklärung',
			title: 'Gezielt auswählen',
			paras: [
				'Meistens brauchst du nicht alle Spalten. Nach SELECT kannst du mehrere Spalten nennen, getrennt durch Kommas. Die Reihenfolge bestimmst du selbst.',
				'Mit AS gibst du einer Spalte im Ergebnis einen neuen Namen. Das hilft, wenn der Spaltenname technisch ist oder du das Ergebnis weitergeben willst.',
				'Der neue Name gilt nur im Ergebnis. In der Tabelle heißt die Spalte weiter wie vorher.'
			],
			example: 'SELECT title AS titel, year AS jahr\nFROM books;'
		},
		{
			kind: 'example',
			name: 'Spalten umbenennen',
			type: 'Beispiel',
			task: 'So benennst du Spalten im Ergebnis um.',
			taskSub: 'Führe die Abfrage aus und achte auf die Spaltenköpfe.',
			code: 'SELECT title AS titel, year AS jahr\nFROM books;',
			msg: (r) => `Die Spalten heißen jetzt ${r.columns.join(' und ')}.`,
			sub: 'Ändere die Namen hinter AS und führe die Abfrage noch einmal aus.'
		},
		{
			kind: 'exercise',
			name: 'Zwei Spalten',
			type: 'Übung',
			task: 'Wann ist welches Buch erschienen?',
			taskSub: 'Zeige die Spalten title und year aus books.',
			starter: 'SELECT \nFROM books;',
			solution: 'SELECT title, year\nFROM books;',
			ordered: false,
			okMsg: 'Richtig! Titel und Jahr.',
			okSub: 'Mehrere Spalten trennst du mit Kommas.',
			tip: 'Schreibe beide Spaltennamen hinter SELECT und trenne sie mit einem Komma.'
		},
		{
			kind: 'exercise',
			name: 'Deutsche Namen',
			type: 'Übung',
			task: 'Verlage mit deutschen Spaltennamen',
			taskSub: 'Zeige id als nummer und name als verlag aus publishers.',
			starter: 'SELECT id AS , name AS \nFROM publishers;',
			solution: 'SELECT id AS nummer, name AS verlag\nFROM publishers;',
			ordered: false,
			okMsg: 'Richtig! Beide Spalten sind umbenannt.',
			okSub: 'AS ändert nur den Namen im Ergebnis.',
			tip: 'Hinter jedes AS gehört der neue Name: nummer und verlag.'
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'Mehrere Spalten trennst du mit Kommas.',
				'Die Reihenfolge nach SELECT bestimmt die Reihenfolge im Ergebnis.',
				'Mit AS gibst du einer Spalte einen neuen Namen.',
				'Der neue Name gilt nur im Ergebnis.'
			],
			real: 'Ein Export für die Schulverwaltung braucht oft feste Spaltennamen wie „Nachname“ oder „Klasse“. Mit AS passt du das Ergebnis an, ohne die Datenbank zu ändern.'
		}
	],
	done: {
		sub: 'Du kannst jetzt genau die Spalten zeigen, die du brauchst.',
		points: ['Spalten mit Kommas auswählen.', 'Reihenfolge selbst bestimmen.', 'Mit AS umbenennen.']
	},
	next: { id: 'where-filters', title: 'Mit WHERE filtern' }
};

const orderLimit: Lesson = {
	...base,
	id: 'order-limit',
	no: 4,
	title: 'Ergebnisse sortieren',
	steps: [
		{
			kind: 'explain',
			name: 'Ordnung ins Ergebnis',
			type: 'Erklärung',
			title: 'Ordnung ins Ergebnis',
			paras: [
				'Ohne Angabe liefert die Datenbank Zeilen in keiner festen Reihenfolge. Mit ORDER BY sortierst du nach einer Spalte.',
				'ASC sortiert aufsteigend, also von klein nach groß oder von A nach Z. Das ist der Standard. DESC sortiert absteigend.',
				'Mit LIMIT begrenzt du die Anzahl der Zeilen. Zusammen mit ORDER BY bekommst du so zum Beispiel die drei neuesten Bücher.'
			],
			example: 'SELECT title, year\nFROM books\nORDER BY year DESC\nLIMIT 3;'
		},
		{
			kind: 'example',
			name: 'Die neuesten Bücher',
			type: 'Beispiel',
			task: 'So bekommst du die drei neuesten Bücher.',
			taskSub: 'Führe die Abfrage aus. Probiere danach ASC statt DESC.',
			code: 'SELECT title, year\nFROM books\nORDER BY year DESC\nLIMIT 3;',
			msg: (r) => `Die ${r.rows.length} neuesten Bücher, das neueste zuerst.`,
			sub: 'Ändere DESC zu ASC und führe die Abfrage noch einmal aus.'
		},
		{
			kind: 'exercise',
			name: 'Nach Titel sortieren',
			type: 'Übung',
			task: 'Alle Bücher alphabetisch',
			taskSub: 'Zeige title und year, sortiert nach dem Titel von A bis Z.',
			starter: 'SELECT title, year\nFROM books\n',
			solution: 'SELECT title, year\nFROM books\nORDER BY title;',
			ordered: true,
			okMsg: 'Richtig! Von A bis Z.',
			okSub: 'ORDER BY sortiert ohne Angabe aufsteigend.',
			tip: 'Hänge ORDER BY und den Spaltennamen an, nach dem sortiert werden soll.'
		},
		{
			kind: 'exercise',
			name: 'Das älteste Buch',
			type: 'Übung',
			task: 'Welches ist das älteste Buch?',
			taskSub: 'Zeige title und year, aber nur eine Zeile.',
			starter: 'SELECT title, year\nFROM books\n',
			solution: 'SELECT title, year\nFROM books\nORDER BY year\nLIMIT 1;',
			ordered: true,
			okMsg: 'Richtig! Das älteste Buch ist von 1999.',
			okSub: 'Erst sortieren, dann mit LIMIT abschneiden.',
			tip: 'Sortiere nach year aufsteigend und begrenze das Ergebnis mit LIMIT 1.'
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'ORDER BY sortiert das Ergebnis nach einer Spalte.',
				'ASC ist aufsteigend und der Standard, DESC ist absteigend.',
				'LIMIT begrenzt die Anzahl der Zeilen.',
				'Die Reihenfolge lautet: SELECT, FROM, WHERE, ORDER BY, LIMIT.'
			],
			real: 'Bestenlisten, „Neueste zuerst“ im Feed oder die fünf meistverkauften Produkte: Dahinter steckt fast immer ORDER BY mit LIMIT.'
		}
	],
	done: {
		sub: 'Du kannst Ergebnisse jetzt sortieren und begrenzen.',
		points: ['ORDER BY sortiert.', 'ASC und DESC bestimmen die Richtung.', 'LIMIT schneidet nach n Zeilen ab.']
	}
};

export const LESSONS: Record<string, Lesson> = {
	[selectBasics.id]: selectBasics,
	[selectColumns.id]: selectColumns,
	[where.id]: where,
	[orderLimit.id]: orderLimit
};
