import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const orderLimit: Lesson = {
	...BASE,
	id: 'order-limit',
	no: 4,
	title: 'Ergebnisse sortieren',
	steps: [
		explain(
			'Ordnung ins Ergebnis',
			[
				'Ohne Angabe liefert die Datenbank Zeilen in keiner festen Reihenfolge. Mit ORDER BY sortierst du nach einer Spalte. ASC sortiert aufsteigend (klein nach groß, A bis Z) und ist der Standard. DESC sortiert absteigend.',
				'Sind zwei Werte gleich, entscheidet eine zweite Spalte: ORDER BY genre, year sortiert erst nach Genre und innerhalb eines Genres nach Jahr. Sortieren kannst du auch nach einem Namen, den du mit AS vergeben hast.',
				'Mit LIMIT begrenzt du die Anzahl der Zeilen, mit OFFSET überspringst du die ersten. Die Reihenfolge der Teile ist fest: SELECT, FROM, WHERE, ORDER BY, LIMIT.'
			],
			'SELECT title, year\nFROM books\nORDER BY year DESC\nLIMIT 3;'
		),
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
		ex('Nach Titel sortieren', 'Alle Bücher alphabetisch', 'Zeige title und year, sortiert nach dem Titel von A bis Z.', 'SELECT title, year\nFROM books\nORDER BY title;', 'ORDER BY sortiert ohne Angabe aufsteigend.', 'Hänge ORDER BY und den Spaltennamen an, nach dem sortiert werden soll.', 'SELECT title, year FROM books ORDER BY year;', { starter: 'SELECT title, year\nFROM books\n' }),
		ex('Dickste zuerst', 'Welche Bücher sind am dicksten?', 'Zeige title und pages, das Buch mit den meisten Seiten zuerst. Bücher ohne Seitenzahl lass weg.', 'SELECT title, pages\nFROM books\nWHERE pages IS NOT NULL\nORDER BY pages DESC;', 'DESC dreht die Reihenfolge um.', 'Erst filtern mit WHERE pages IS NOT NULL, dann ORDER BY pages DESC.', 'SELECT title, pages FROM books WHERE pages IS NOT NULL ORDER BY pages;'),
		ex('Das älteste Buch', 'Welches ist das älteste Buch?', 'Zeige title und year, aber nur eine Zeile.', 'SELECT title, year\nFROM books\nORDER BY year\nLIMIT 1;', 'Erst sortieren, dann mit LIMIT abschneiden.', 'Sortiere nach year aufsteigend und begrenze das Ergebnis mit LIMIT 1.', 'SELECT title, year FROM books ORDER BY year DESC LIMIT 1;'),
		ex('Top 5 Preise', 'Welche fünf Bücher sind am teuersten?', 'Zeige title und price, das teuerste zuerst.', 'SELECT title, price\nFROM books\nORDER BY price DESC\nLIMIT 5;', 'ORDER BY mit LIMIT ergibt eine Bestenliste.', 'Absteigend nach price sortieren und nach fünf Zeilen abschneiden.', 'SELECT title, price FROM books ORDER BY price DESC LIMIT 3;'),
		ex('Gefiltert und sortiert', 'Die Romane, neueste zuerst', 'Zeige title und year aller Romane, das neueste zuerst.', "SELECT title, year\nFROM books\nWHERE genre = 'Roman'\nORDER BY year DESC;", 'WHERE kommt vor ORDER BY.', "Filtere mit WHERE genre = 'Roman' und sortiere danach mit ORDER BY year DESC.", "SELECT title, year FROM books WHERE genre = 'Roman' ORDER BY year;"),
		ex('Zwei Sortierschlüssel', 'Alle Bücher nach Genre, darin nach Jahr', 'Zeige genre, title und year. Sortiere nach genre (A bis Z) und innerhalb eines Genres das neueste Buch zuerst.', 'SELECT genre, title, year\nFROM books\nORDER BY genre, year DESC;', 'Die zweite Spalte entscheidet bei Gleichstand.', 'ORDER BY genre, year DESC. Die Richtung gilt für jede Spalte einzeln.', 'SELECT genre, title, year FROM books ORDER BY genre, year;'),
		ex('Neueste Ausleihen', 'Was wurde zuletzt ausgeliehen?', 'Zeige student, book_id und loan_date der fünf neuesten Ausleihen, die neueste zuerst.', 'SELECT student, book_id, loan_date\nFROM loans\nORDER BY loan_date DESC\nLIMIT 5;', 'Datumsangaben im Format JJJJ-MM-TT lassen sich direkt sortieren.', 'Die Ausleihen stehen in loans. Sortiere nach loan_date absteigend und begrenze auf 5.', 'SELECT student, book_id, loan_date FROM loans ORDER BY loan_date LIMIT 5;'),
		ex('Seite 2', 'Die nächsten fünf', 'Wie in der vorigen Übung, aber die Plätze 6 bis 10: Zeige student, book_id und loan_date.', 'SELECT student, book_id, loan_date\nFROM loans\nORDER BY loan_date DESC\nLIMIT 5 OFFSET 5;', 'Mit OFFSET blätterst du weiter, wie Seite 2 in einer App.', 'LIMIT 5 OFFSET 5 überspringt die ersten fünf Zeilen und zeigt die nächsten fünf.', 'SELECT student, book_id, loan_date FROM loans ORDER BY loan_date DESC LIMIT 5;'),
		ex('Sortieren nach Rechnung', 'Welche Bücher sind am längsten im Bestand?', 'Zeige title und das Alter im Jahr 2026 als jahre_alt, das älteste zuerst, nur die ersten drei.', 'SELECT title, 2026 - year AS jahre_alt\nFROM books\nORDER BY jahre_alt DESC\nLIMIT 3;', 'Nach einem AS-Namen darfst du sortieren.', 'Rechne 2026 - year AS jahre_alt und sortiere mit ORDER BY jahre_alt DESC.', 'SELECT title, 2026 - year AS jahre_alt FROM books ORDER BY jahre_alt LIMIT 3;'),
		ex('Günstige Comics', 'Die zwei günstigsten Comics', 'Zeige title und price der zwei günstigsten Comics, den günstigsten zuerst.', "SELECT title, price\nFROM books\nWHERE genre = 'Comic'\nORDER BY price\nLIMIT 2;", 'Filtern, sortieren, begrenzen: alles in einer Abfrage.', "WHERE genre = 'Comic', dann ORDER BY price, dann LIMIT 2.", "SELECT title, price FROM books ORDER BY price LIMIT 2;"),
		ex('Leseempfehlung', 'Drei Empfehlungen für Viel-Leser', 'Zeige title als titel, author als autor und pages als seiten für die drei dicksten Bücher, die keine Informatik-Bücher sind und höchstens 17 Euro kosten.', "SELECT title AS titel, author AS autor, pages AS seiten\nFROM books\nWHERE genre <> 'Informatik' AND price <= 17\nORDER BY pages DESC\nLIMIT 3;", 'AS, WHERE mit AND, ORDER BY und LIMIT zusammen.', "Zwei Bedingungen mit AND (genre <> 'Informatik' und price <= 17), dann ORDER BY pages DESC und LIMIT 3.", "SELECT title AS titel, author AS autor, pages AS seiten FROM books WHERE genre <> 'Informatik' ORDER BY pages DESC LIMIT 3;"),
		summary(
			['ORDER BY sortiert, ASC ist aufsteigend und der Standard, DESC absteigend.', 'Mehrere Sortierschlüssel trennst du mit Kommas.', 'LIMIT begrenzt, OFFSET überspringt Zeilen.', 'Die Reihenfolge lautet: SELECT, FROM, WHERE, ORDER BY, LIMIT.'],
			'Bestenlisten, „Neueste zuerst“ im Feed oder die fünf meistverkauften Produkte: Dahinter steckt fast immer ORDER BY mit LIMIT. Apps blättern mit LIMIT und OFFSET durch lange Listen.'
		)
	],
	done: {
		sub: 'Du kannst Ergebnisse jetzt sortieren und begrenzen.',
		points: ['ORDER BY sortiert, auch nach mehreren Spalten.', 'ASC und DESC bestimmen die Richtung.', 'LIMIT und OFFSET schneiden aus.']
	},
	next: { id: 'aggregates', title: 'Zählen und zusammenfassen' }
};
