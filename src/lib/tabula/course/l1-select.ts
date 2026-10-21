import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const selectBasics: Lesson = {
	...BASE,
	id: 'select-basics',
	no: 1,
	title: 'Erste Abfrage mit SELECT',
	steps: [
		explain(
			'Was ist eine Tabelle?',
			[
				'Eine Datenbank speichert Daten in Tabellen. Jede Zeile ist ein Datensatz, zum Beispiel ein Buch. Jede Spalte ist eine Eigenschaft, zum Beispiel der Titel oder das Erscheinungsjahr.',
				'Diese Datenbank gehört zu einer Schulbibliothek. Sie hat drei Tabellen: books (die Bücher), publishers (die Verlage) und loans (die Ausleihen). Links im Schema siehst du ihre Spalten.',
				'Mit SELECT fragst du Daten ab. Nach FROM steht, aus welcher Tabelle die Daten kommen. Der Stern * bedeutet: alle Spalten. Die Abfrage verändert nichts, sie zeigt nur, was drinsteht.'
			],
			'SELECT *\nFROM books;'
		),
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
		ex('Alle Verlage', 'Welche Verlage gibt es?', 'Zeige alle Spalten der Tabelle publishers.', 'SELECT *\nFROM publishers;', 'Du hast deine erste eigene Abfrage geschrieben.', 'Der Tabellenname kommt nach FROM. Im Schema links stehen alle Tabellen.', 'SELECT * FROM books;', { starter: 'SELECT *\nFROM ' }),
		ex('Alle Ausleihen', 'Was wurde ausgeliehen?', 'Zeige alle Spalten der Tabelle loans.', 'SELECT *\nFROM loans;', 'Jede Zeile ist eine Ausleihe.', 'Wie beim Verlag: SELECT * und danach FROM mit dem Tabellennamen loans.', 'SELECT * FROM publishers;', { starter: 'SELECT *\nFROM ' }),
		ex('Nur eine Spalte', 'Wie heißen alle Bücher?', 'Zeige nur die Spalte title aus books.', 'SELECT title\nFROM books;', 'Statt * kannst du einzelne Spalten nennen.', 'Ersetze den Stern durch den Namen der Spalte, die du sehen willst.', 'SELECT title, year FROM books;', { starter: 'SELECT \nFROM books;' }),
		ex('Wer schreibt?', 'Wer hat die Bücher geschrieben?', 'Zeige nur die Spalte author aus books.', 'SELECT author\nFROM books;', 'Doppelte Namen sind erlaubt: Manche haben mehrere Bücher geschrieben.', 'Die Spalte für den Autor heißt author.', 'SELECT title FROM books;', { starter: 'SELECT \nFROM books;' }),
		ex('Zwei Spalten', 'Welches Buch ist von wem?', 'Zeige title und author aus books.', 'SELECT title, author\nFROM books;', 'Mehrere Spalten trennst du mit Kommas.', 'Schreibe beide Spaltennamen hinter SELECT und trenne sie mit einem Komma.', 'SELECT title FROM books;', { starter: 'SELECT \nFROM books;' }),
		ex('Verlag und Land', 'Woher kommen die Verlage?', 'Zeige name und country aus publishers.', 'SELECT name, country\nFROM publishers;', 'Spalten gibt es in jeder Tabelle, nicht nur in books.', 'Die Tabelle heißt publishers, die Spalten name und country.', 'SELECT name FROM publishers;', { starter: 'SELECT \nFROM ' }),
		ex('Wer leiht aus?', 'Wer hat etwas ausgeliehen, und aus welcher Klasse?', 'Zeige student und class aus loans.', 'SELECT student, class\nFROM loans;', 'Viele Schüler tauchen mehrfach auf, weil sie mehrmals ausgeliehen haben.', 'Beide Spalten stehen in loans. Tabelle nach FROM, Spalten nach SELECT.', 'SELECT student FROM loans;'),
		ex('Umfang und Preis', 'Wie dick und wie teuer sind die Bücher?', 'Zeige title, pages und price aus books.', 'SELECT title, pages, price\nFROM books;', 'Leere Felder heißen in SQL NULL. Bei manchen Büchern fehlt der Preis.', 'Drei Spalten, zwei Kommas: title, pages, price.', 'SELECT title, price FROM books;'),
		ex('Ausleihzeiten', 'Wann wurde ausgeliehen und zurückgegeben?', 'Zeige book_id, loan_date und return_date aus loans.', 'SELECT book_id, loan_date, return_date\nFROM loans;', 'Bei return_date steht NULL, wenn das Buch noch nicht zurück ist.', 'Die drei Spalten stehen in loans. Achte auf die genaue Schreibweise mit Unterstrich.', 'SELECT book_id, loan_date FROM loans;'),
		ex('Steckbrief', 'Ein kurzer Steckbrief für jedes Buch', 'Zeige title, author, year und genre aus books. Schreib die Abfrage diesmal ganz allein.', 'SELECT title, author, year, genre\nFROM books;', 'Vier Spalten, ohne Hilfe. Das ist der Kern jeder Abfrage.', 'Erst SELECT mit den vier Spalten, dann FROM books.', 'SELECT title, author, year FROM books;'),
		ex('Alle Tabellen kennen', 'Welche Spalten hat loans genau?', 'Zeige alle Spalten von loans, aber schreibe sie einzeln aus statt *.', 'SELECT id, book_id, student, class, loan_date, return_date\nFROM loans;', 'Jetzt kennst du jede Spalte von loans beim Namen.', 'Im Schema links stehen die sechs Spalten von loans. Schreibe alle hinter SELECT.', 'SELECT id, book_id, student, class, loan_date FROM loans;'),
		summary(
			['Daten liegen in Tabellen aus Zeilen und Spalten.', 'SELECT wählt aus, was du sehen willst. FROM sagt, woher.', '* steht für alle Spalten, mehrere Spalten trennst du mit Kommas.', 'Leere Felder heißen NULL.'],
			'Jede App mit einer Liste, ob Musik, Nachrichten oder Noten, lädt ihre Einträge mit einer Abfrage wie SELECT … FROM aus einer Datenbank.'
		)
	],
	done: {
		sub: 'Du kannst jetzt Daten aus jeder Tabelle abfragen.',
		points: ['SELECT und FROM bilden jede Abfrage.', '* zeigt alle Spalten.', 'Einzelne Spalten nennst du mit Namen.']
	},
	next: { id: 'select-columns', title: 'Spalten auswählen und umbenennen' }
};
