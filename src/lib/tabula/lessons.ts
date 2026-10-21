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
	},
	next: { id: 'aggregates', title: 'Zählen und zusammenfassen' }
};

const aggregates: Lesson = {
	...base,
	id: 'aggregates',
	no: 5,
	title: 'Zählen und zusammenfassen',
	steps: [
		{
			kind: 'explain',
			name: 'Viele Zeilen, eine Zahl',
			type: 'Erklärung',
			title: 'Viele Zeilen, eine Zahl',
			paras: [
				'Oft interessiert dich nicht jede einzelne Zeile, sondern eine Zusammenfassung: Wie viele Bücher gibt es? Wann ist das neueste erschienen?',
				'Dafür gibt es Aggregatfunktionen. COUNT(*) zählt Zeilen, MIN und MAX finden den kleinsten und größten Wert, AVG berechnet den Durchschnitt und SUM die Summe.',
				'Eine Aggregatfunktion macht aus vielen Zeilen eine einzige. Mit AS gibst du dem Ergebnis einen lesbaren Namen.'
			],
			example: 'SELECT COUNT(*) AS anzahl,\n       MIN(year) AS aeltestes,\n       MAX(year) AS neuestes\nFROM books;'
		},
		{
			kind: 'example',
			name: 'Bücher zählen',
			type: 'Beispiel',
			task: 'So fasst du eine ganze Tabelle in einer Zeile zusammen.',
			taskSub: 'Führe die Abfrage aus und lies die drei Werte ab.',
			code: 'SELECT COUNT(*) AS anzahl,\n       MIN(year) AS aeltestes,\n       MAX(year) AS neuestes\nFROM books;',
			msg: (r) => `${r.rows[0]?.[0]} Bücher, erschienen zwischen ${r.rows[0]?.[1]} und ${r.rows[0]?.[2]}.`,
			sub: 'Ergänze AVG(year) AS schnitt und führe die Abfrage noch einmal aus.'
		},
		{
			kind: 'exercise',
			name: 'Neue Bücher zählen',
			type: 'Übung',
			task: 'Wie viele Bücher sind nach 2010 erschienen?',
			taskSub: 'Gib nur die Anzahl aus und nenne die Spalte anzahl.',
			starter: 'SELECT \nFROM books\nWHERE year > 2010;',
			solution: 'SELECT COUNT(*) AS anzahl\nFROM books\nWHERE year > 2010;',
			ordered: false,
			okMsg: 'Richtig! Drei Bücher.',
			okSub: 'WHERE filtert zuerst, dann zählt COUNT.',
			tip: 'Hinter SELECT gehört COUNT(*) AS anzahl. Die Bedingung steht schon da.'
		},
		{
			kind: 'exercise',
			name: 'Durchschnittsjahr',
			type: 'Übung',
			task: 'In welchem Jahr sind die Bücher im Schnitt erschienen?',
			taskSub: 'Nenne die Spalte schnitt.',
			starter: 'SELECT \nFROM books;',
			solution: 'SELECT AVG(year) AS schnitt\nFROM books;',
			ordered: false,
			okMsg: 'Richtig! Im Schnitt 2011.',
			okSub: 'AVG berechnet den Durchschnitt einer Spalte.',
			tip: 'Die Funktion für den Durchschnitt heißt AVG. In die Klammern gehört die Spalte year.'
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'COUNT(*) zählt Zeilen.',
				'MIN und MAX finden den kleinsten und größten Wert.',
				'AVG berechnet den Durchschnitt, SUM die Summe.',
				'WHERE filtert, bevor zusammengefasst wird.'
			],
			real: 'Dashboards zeigen fast nur Aggregate: Nutzer heute, Umsatz pro Monat, durchschnittliche Ladezeit. Jede dieser Zahlen ist eine Abfrage mit COUNT, SUM oder AVG.'
		}
	],
	done: {
		sub: 'Du kannst jetzt ganze Tabellen in einer Zahl zusammenfassen.',
		points: ['COUNT zählt Zeilen.', 'MIN, MAX und AVG fassen Werte zusammen.', 'Erst WHERE, dann zusammenfassen.']
	},
	next: { id: 'group-by', title: 'Gruppieren mit GROUP BY' }
};

const groupBy: Lesson = {
	...base,
	id: 'group-by',
	no: 6,
	title: 'Gruppieren mit GROUP BY',
	steps: [
		{
			kind: 'explain',
			name: 'Zusammenfassen pro Gruppe',
			type: 'Erklärung',
			title: 'Zusammenfassen pro Gruppe',
			paras: [
				'COUNT(*) zählt alle Zeilen. Oft willst du aber pro Gruppe zählen, zum Beispiel: Wie viele Bücher hat jeder Verlag?',
				'GROUP BY teilt die Zeilen in Gruppen mit gleichem Wert. Die Aggregatfunktion wird dann für jede Gruppe einzeln berechnet. Jede Gruppe wird zu einer Zeile im Ergebnis.',
				'Mit HAVING filterst du Gruppen. WHERE filtert einzelne Zeilen vor dem Gruppieren, HAVING filtert die fertigen Gruppen danach.'
			],
			example: 'SELECT publisher_id, COUNT(*) AS anzahl\nFROM books\nGROUP BY publisher_id;'
		},
		{
			kind: 'example',
			name: 'Bücher pro Verlag',
			type: 'Beispiel',
			task: 'So zählst du Bücher pro Verlag.',
			taskSub: 'Führe die Abfrage aus. Jede Zeile ist eine Gruppe.',
			code: 'SELECT publisher_id, COUNT(*) AS anzahl\nFROM books\nGROUP BY publisher_id;',
			msg: (r) => `${r.rows.length} Gruppen, eine pro Verlag mit Büchern.`,
			sub: 'Ersetze COUNT(*) durch MAX(year) und sieh dir das neueste Buch pro Verlag an.'
		},
		{
			kind: 'exercise',
			name: 'Neuestes Buch pro Verlag',
			type: 'Übung',
			task: 'Wann hat jeder Verlag sein neuestes Buch veröffentlicht?',
			taskSub: 'Zeige publisher_id und das neueste Jahr als neuestes.',
			starter: 'SELECT publisher_id, \nFROM books\n',
			solution: 'SELECT publisher_id, MAX(year) AS neuestes\nFROM books\nGROUP BY publisher_id;',
			ordered: false,
			okMsg: 'Richtig! Ein Jahr pro Verlag.',
			okSub: 'MAX wird für jede Gruppe einzeln berechnet.',
			tip: 'Du brauchst MAX(year) AS neuestes und am Ende GROUP BY publisher_id.'
		},
		{
			kind: 'exercise',
			name: 'Gruppen filtern',
			type: 'Übung',
			task: 'Welche Verlage veröffentlichen eher neue Bücher?',
			taskSub: 'Zeige nur publisher_id der Verlage, deren Bücher im Schnitt nach 2010 erschienen sind.',
			starter: 'SELECT publisher_id\nFROM books\nGROUP BY publisher_id\n',
			solution: 'SELECT publisher_id\nFROM books\nGROUP BY publisher_id\nHAVING AVG(year) > 2010;',
			ordered: false,
			okMsg: 'Richtig! Nur ein Verlag bleibt übrig.',
			okSub: 'HAVING filtert Gruppen nach dem Zusammenfassen.',
			tip: 'Die Bedingung betrifft den Durchschnitt einer Gruppe. Dafür brauchst du HAVING AVG(year) > 2010.'
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'GROUP BY bildet Gruppen mit gleichem Wert.',
				'Aggregatfunktionen rechnen pro Gruppe.',
				'WHERE filtert Zeilen vorher, HAVING filtert Gruppen nachher.',
				'Reihenfolge: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY.'
			],
			real: 'Nutzer pro Stunde, Fehler pro Server, Bestellungen pro Kunde: Wer Daten auswertet, gruppiert ständig. Genau so entstehen die Kurven, mit denen Firmen Entscheidungen treffen.'
		}
	],
	done: {
		sub: 'Du kannst Daten jetzt pro Gruppe auswerten.',
		points: ['GROUP BY bildet Gruppen.', 'Aggregate rechnen pro Gruppe.', 'HAVING filtert Gruppen.']
	},
	next: { id: 'joins', title: 'Tabellen verbinden mit JOIN' }
};

const joins: Lesson = {
	...base,
	id: 'joins',
	no: 7,
	title: 'Tabellen verbinden mit JOIN',
	steps: [
		{
			kind: 'explain',
			name: 'Zwei Tabellen, ein Ergebnis',
			type: 'Erklärung',
			title: 'Zwei Tabellen, ein Ergebnis',
			paras: [
				'In books steht bei jedem Buch nur die Nummer des Verlags, publisher_id. Der Name des Verlags steht in einer zweiten Tabelle, publishers. So muss jeder Name nur einmal gespeichert werden.',
				'Mit JOIN verbindest du beide Tabellen. Nach ON steht, welche Spalten zusammengehören: books.publisher_id = publishers.id. Kurze Namen wie b und p sparen Schreibarbeit.',
				'Ein normaler JOIN zeigt nur Zeilen, die in beiden Tabellen einen Partner haben. LEFT JOIN zeigt alle Zeilen der linken Tabelle, auch ohne Partner. Fehlende Werte sind dann NULL.'
			],
			example: 'SELECT b.title, p.name\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id;'
		},
		{
			kind: 'example',
			name: 'Buch und Verlag',
			type: 'Beispiel',
			task: 'So zeigst du zu jedem Buch den Namen des Verlags.',
			taskSub: 'Führe die Abfrage aus. Die Spalten kommen aus zwei Tabellen.',
			code: 'SELECT b.title, p.name\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id;',
			msg: (r) => `${r.rows.length} Bücher, jedes mit seinem Verlag.`,
			sub: 'Lösche die ON-Zeile und sieh dir an, was passiert.'
		},
		{
			kind: 'exercise',
			name: 'Neue Bücher mit Verlag',
			type: 'Übung',
			task: 'Von welchen Verlagen sind die Bücher nach 2010?',
			taskSub: 'Zeige title und name für alle Bücher nach 2010.',
			starter: 'SELECT b.title, p.name\nFROM books b\nJOIN publishers p ON \nWHERE ',
			solution: 'SELECT b.title, p.name\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id\nWHERE b.year > 2010;',
			ordered: false,
			okMsg: 'Richtig! Drei Bücher mit Verlag.',
			okSub: 'JOIN und WHERE lassen sich kombinieren.',
			tip: 'Nach ON gehört b.publisher_id = p.id, nach WHERE die Bedingung b.year > 2010.'
		},
		{
			kind: 'exercise',
			name: 'Auch ohne Partner',
			type: 'Übung',
			task: 'Welche Verlage gibt es, auch solche ohne Bücher?',
			taskSub: 'Zeige name und title für alle Verlage. Ein Verlag hat noch kein Buch.',
			starter: 'SELECT p.name, b.title\nFROM publishers p\n',
			solution: 'SELECT p.name, b.title\nFROM publishers p\nLEFT JOIN books b ON b.publisher_id = p.id;',
			ordered: false,
			okMsg: 'Richtig! No Starch Press steht mit NULL da.',
			okSub: 'LEFT JOIN behält alle Zeilen der linken Tabelle.',
			tip: 'Ein normaler JOIN lässt Verlage ohne Buch weg. Probiere LEFT JOIN.'
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'Daten werden auf mehrere Tabellen verteilt, damit nichts doppelt steht.',
				'JOIN … ON verbindet Zeilen, die zusammengehören.',
				'JOIN zeigt nur Paare, LEFT JOIN auch Zeilen ohne Partner.',
				'Fehlende Werte erscheinen als NULL.'
			],
			real: 'Ein Onlineshop speichert Kunden, Bestellungen und Produkte in getrennten Tabellen. Die Rechnung entsteht erst durch JOINs zwischen ihnen.'
		}
	],
	done: {
		sub: 'Du kannst jetzt Daten aus mehreren Tabellen kombinieren.',
		points: ['JOIN … ON verbindet Tabellen.', 'LEFT JOIN behält alle Zeilen links.', 'Fehlende Partner werden NULL.']
	},
	next: { id: 'subqueries', title: 'Unterabfragen' }
};

const subqueries: Lesson = {
	...base,
	id: 'subqueries',
	no: 8,
	title: 'Unterabfragen',
	steps: [
		{
			kind: 'explain',
			name: 'Abfrage in der Abfrage',
			type: 'Erklärung',
			title: 'Abfrage in der Abfrage',
			paras: [
				'Manchmal brauchst du für eine Bedingung einen Wert, den du erst ausrechnen musst. Zum Beispiel: Welche Bücher sind neuer als der Durchschnitt?',
				'Dafür setzt du eine zweite Abfrage in Klammern in die erste. Die innere Abfrage läuft zuerst und liefert einen Wert. Die äußere Abfrage benutzt ihn wie eine feste Zahl.',
				'Liefert die innere Abfrage mehrere Werte, vergleichst du mit IN statt mit =.'
			],
			example: 'SELECT title, year\nFROM books\nWHERE year > (SELECT AVG(year) FROM books);'
		},
		{
			kind: 'example',
			name: 'Neuer als der Schnitt',
			type: 'Beispiel',
			task: 'So findest du Bücher, die neuer als der Durchschnitt sind.',
			taskSub: 'Führe die Abfrage aus. Die Zahl in der Klammer berechnet SQL selbst.',
			code: 'SELECT title, year\nFROM books\nWHERE year > (SELECT AVG(year) FROM books);',
			msg: (r) => `${r.rows.length} Bücher sind neuer als der Durchschnitt.`,
			sub: 'Führe die innere Abfrage einzeln aus, um den Durchschnitt zu sehen.'
		},
		{
			kind: 'exercise',
			name: 'Das neueste Buch',
			type: 'Übung',
			task: 'Welches Buch ist das neueste?',
			taskSub: 'Zeige title und year. Benutze eine Unterabfrage mit MAX, nicht LIMIT.',
			starter: 'SELECT title, year\nFROM books\nWHERE year = ',
			solution: 'SELECT title, year\nFROM books\nWHERE year = (SELECT MAX(year) FROM books);',
			ordered: false,
			okMsg: 'Richtig! Database Internals von 2019.',
			okSub: 'Die Unterabfrage liefert das größte Jahr.',
			tip: 'In die Klammer gehört SELECT MAX(year) FROM books.'
		},
		{
			kind: 'exercise',
			name: 'Nach Verlagsname',
			type: 'Übung',
			task: 'Welche Bücher sind bei Addison-Wesley erschienen?',
			taskSub: 'Zeige title. Suche die Nummer des Verlags per Unterabfrage über den Namen.',
			starter: 'SELECT title\nFROM books\nWHERE publisher_id = (\n  \n);',
			solution: "SELECT title\nFROM books\nWHERE publisher_id = (\n  SELECT id FROM publishers WHERE name = 'Addison-Wesley'\n);",
			ordered: false,
			okMsg: 'Richtig! Drei Bücher von Addison-Wesley.',
			okSub: 'Du musst die Nummer des Verlags nicht kennen.',
			tip: "Die innere Abfrage sucht die id in publishers: SELECT id FROM publishers WHERE name = 'Addison-Wesley'."
		},
		{
			kind: 'summary',
			name: 'Fazit',
			type: 'Zusammenfassung',
			title: 'Das hast du gelernt',
			points: [
				'Eine Unterabfrage steht in Klammern in einer anderen Abfrage.',
				'Die innere Abfrage läuft zuerst.',
				'Liefert sie einen Wert, vergleichst du mit = oder >.',
				'Liefert sie mehrere Werte, nimmst du IN.'
			],
			real: 'Welche Kunden haben mehr als der Durchschnitt bestellt? Welche Server sind langsamer als üblich? Solche Vergleiche mit einem berechneten Wert sind typische Unterabfragen.'
		}
	],
	done: {
		sub: 'Du hast die SQL-Grundlagen geschafft.',
		points: ['Unterabfragen stehen in Klammern.', 'Die innere Abfrage läuft zuerst.', 'Mehrere Werte vergleichst du mit IN.']
	}
};

export const LESSONS: Record<string, Lesson> = {
	[selectBasics.id]: selectBasics,
	[selectColumns.id]: selectColumns,
	[where.id]: where,
	[orderLimit.id]: orderLimit,
	[aggregates.id]: aggregates,
	[groupBy.id]: groupBy,
	[joins.id]: joins,
	[subqueries.id]: subqueries
};
