import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const groupBy: Lesson = {
	...BASE,
	id: 'group-by',
	no: 6,
	title: 'Gruppieren mit GROUP BY',
	steps: [
		explain(
			'Zusammenfassen pro Gruppe',
			[
				'COUNT(*) zählt alle Zeilen. Oft willst du aber pro Gruppe zählen, zum Beispiel: Wie viele Bücher hat jedes Genre?',
				'GROUP BY teilt die Zeilen in Gruppen mit gleichem Wert. Die Aggregatfunktion wird dann für jede Gruppe einzeln berechnet, und jede Gruppe wird zu einer Zeile. Du kannst auch nach mehreren Spalten gruppieren.',
				'Mit HAVING filterst du Gruppen. WHERE filtert einzelne Zeilen vor dem Gruppieren, HAVING filtert die fertigen Gruppen danach. Die Reihenfolge lautet: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.'
			],
			'SELECT genre, COUNT(*) AS anzahl\nFROM books\nGROUP BY genre;'
		),
		{
			kind: 'example',
			name: 'Bücher pro Genre',
			type: 'Beispiel',
			task: 'So zählst du Bücher pro Genre.',
			taskSub: 'Führe die Abfrage aus. Jede Zeile ist eine Gruppe.',
			code: 'SELECT genre, COUNT(*) AS anzahl\nFROM books\nGROUP BY genre;',
			msg: (r) => `${r.rows.length} Gruppen, eine pro Genre.`,
			sub: 'Ersetze genre durch publisher_id und zähle die Bücher pro Verlag.'
		},
		ex('Bücher pro Verlag', 'Wie viele Bücher hat jeder Verlag?', 'Zeige publisher_id und die Anzahl als anzahl.', 'SELECT publisher_id, COUNT(*) AS anzahl\nFROM books\nGROUP BY publisher_id;', 'Eine Zeile pro Verlag.', 'Wie im Beispiel, nur mit publisher_id statt genre: SELECT, COUNT(*) und GROUP BY publisher_id.', 'SELECT publisher_id, COUNT(*) AS anzahl FROM books;', { starter: 'SELECT publisher_id, \nFROM books\n' }),
		ex('Ausleihen pro Klasse', 'Welche Klasse leiht wie viel aus?', 'Zeige class und die Anzahl der Ausleihen als ausleihen.', 'SELECT class, COUNT(*) AS ausleihen\nFROM loans\nGROUP BY class;', 'Gruppieren geht in jeder Tabelle.', 'Die Ausleihen stehen in loans. Gruppiere nach class.', 'SELECT class, COUNT(*) AS ausleihen FROM loans GROUP BY student;'),
		ex('Neuestes pro Genre', 'Wie aktuell ist jedes Genre?', 'Zeige genre und das Jahr des neuesten Buchs als neuestes.', 'SELECT genre, MAX(year) AS neuestes\nFROM books\nGROUP BY genre;', 'MAX wird für jede Gruppe einzeln berechnet.', 'Du brauchst MAX(year) AS neuestes und am Ende GROUP BY genre.', 'SELECT genre, MIN(year) AS neuestes FROM books GROUP BY genre;'),
		ex('Durchschnitt pro Genre', 'Wie dick sind die Bücher je Genre im Schnitt?', 'Zeige genre und die durchschnittliche Seitenzahl als schnitt_seiten, gerundet auf eine ganze Zahl.', 'SELECT genre, ROUND(AVG(pages)) AS schnitt_seiten\nFROM books\nGROUP BY genre;', 'Aggregate und ROUND funktionieren auch pro Gruppe.', 'ROUND(AVG(pages)) AS schnitt_seiten und GROUP BY genre.', 'SELECT genre, ROUND(AVG(price)) AS schnitt_seiten FROM books GROUP BY genre;'),
		ex('Sortierte Gruppen', 'Wer liest am meisten?', 'Zeige student und die Anzahl der Ausleihen als anzahl, die meisten zuerst.', 'SELECT student, COUNT(*) AS anzahl\nFROM loans\nGROUP BY student\nORDER BY anzahl DESC;', 'ORDER BY kommt nach GROUP BY.', 'Gruppiere nach student und sortiere mit ORDER BY anzahl DESC.', 'SELECT student, COUNT(*) AS anzahl FROM loans GROUP BY student ORDER BY anzahl;'),
		ex('Erst filtern, dann gruppieren', 'Wie viele neue Bücher gibt es je Genre?', 'Zeige genre und die Anzahl als anzahl, aber nur für Bücher ab 2015.', 'SELECT genre, COUNT(*) AS anzahl\nFROM books\nWHERE year >= 2015\nGROUP BY genre;', 'WHERE filtert die Zeilen, bevor gruppiert wird.', 'WHERE year >= 2015 steht vor GROUP BY genre.', 'SELECT genre, COUNT(*) AS anzahl FROM books GROUP BY genre;'),
		ex('Gruppen filtern', 'Welche Genres sind gut bestückt?', 'Zeige genre und die Anzahl als anzahl, aber nur Genres mit mindestens 5 Büchern.', 'SELECT genre, COUNT(*) AS anzahl\nFROM books\nGROUP BY genre\nHAVING COUNT(*) >= 5;', 'HAVING filtert Gruppen nach dem Zusammenfassen.', 'Die Bedingung betrifft die Anzahl einer Gruppe. Dafür brauchst du HAVING COUNT(*) >= 5 nach GROUP BY.', 'SELECT genre, COUNT(*) AS anzahl FROM books GROUP BY genre HAVING COUNT(*) > 5;'),
		ex('Fleißige Leser', 'Wer hat mindestens vier Mal ausgeliehen?', 'Zeige student und die Anzahl als anzahl, die meisten zuerst.', 'SELECT student, COUNT(*) AS anzahl\nFROM loans\nGROUP BY student\nHAVING COUNT(*) >= 4\nORDER BY anzahl DESC;', 'GROUP BY, HAVING und ORDER BY zusammen.', 'Gruppiere nach student, filtere mit HAVING COUNT(*) >= 4 und sortiere absteigend.', 'SELECT student, COUNT(*) AS anzahl FROM loans GROUP BY student ORDER BY anzahl DESC;'),
		ex('Zwei Gruppenspalten', 'Offene und zurückgegebene Ausleihen pro Klasse', 'Zeige class, ob das Buch zurück ist als zurueck (return_date IS NOT NULL) und die Anzahl als anzahl. Sortiere nach class und zurueck.', 'SELECT class, return_date IS NOT NULL AS zurueck, COUNT(*) AS anzahl\nFROM loans\nGROUP BY class, zurueck\nORDER BY class, zurueck;', 'Eine Bedingung als Spalte ergibt 1 (wahr) oder 0 (falsch).', 'Gruppiere nach zwei Spalten: GROUP BY class, zurueck. Sortiere genauso.', 'SELECT class, return_date IS NOT NULL AS zurueck, COUNT(*) AS anzahl FROM loans GROUP BY class ORDER BY class;'),
		ex('Teure Genres', 'In welchen Genres ist ein Buch im Schnitt teurer als 20 Euro?', 'Zeige genre und den Durchschnittspreis als schnitt (2 Stellen), teuerstes zuerst.', 'SELECT genre, ROUND(AVG(price), 2) AS schnitt\nFROM books\nGROUP BY genre\nHAVING AVG(price) > 20\nORDER BY schnitt DESC;', 'HAVING kann jedes Aggregat prüfen, nicht nur COUNT.', 'HAVING AVG(price) > 20, dann ORDER BY schnitt DESC.', 'SELECT genre, ROUND(AVG(price), 2) AS schnitt FROM books WHERE price > 20 GROUP BY genre ORDER BY schnitt DESC;'),
		ex('Ausleihmonate', 'In welchem Monat wurde am meisten ausgeliehen?', 'Zeige den Monat als monat (die ersten 7 Zeichen von loan_date, also SUBSTR(loan_date, 1, 7)) und die Anzahl als anzahl. Nur den Monat mit den meisten Ausleihen.', 'SELECT SUBSTR(loan_date, 1, 7) AS monat, COUNT(*) AS anzahl\nFROM loans\nGROUP BY monat\nORDER BY anzahl DESC\nLIMIT 1;', 'Gruppieren nach einer berechneten Spalte. So entstehen Zeitreihen.', 'Gruppiere nach monat, sortiere nach anzahl absteigend und nimm mit LIMIT 1 nur den ersten.', 'SELECT SUBSTR(loan_date, 1, 7) AS monat, COUNT(*) AS anzahl FROM loans GROUP BY monat ORDER BY monat LIMIT 1;'),
		ex('Autorenranking', 'Welche Autoren haben mehrere Bücher, die nicht Informatik sind?', 'Zeige author als autor, die Anzahl als buecher und die Seiten insgesamt als seiten. Nur Autoren mit mindestens 3 solchen Büchern, die meisten Seiten zuerst.', "SELECT author AS autor, COUNT(*) AS buecher, SUM(pages) AS seiten\nFROM books\nWHERE genre <> 'Informatik'\nGROUP BY author\nHAVING COUNT(*) >= 3\nORDER BY seiten DESC;", 'WHERE, GROUP BY, HAVING und ORDER BY in der richtigen Reihenfolge.', "Erst WHERE genre <> 'Informatik', dann GROUP BY author, dann HAVING COUNT(*) >= 3, zuletzt ORDER BY seiten DESC.", "SELECT author AS autor, COUNT(*) AS buecher, SUM(pages) AS seiten FROM books GROUP BY author HAVING COUNT(*) >= 3 ORDER BY seiten DESC;"),
		summary(
			['GROUP BY bildet Gruppen mit gleichem Wert, auch über mehrere Spalten.', 'Aggregatfunktionen rechnen pro Gruppe.', 'WHERE filtert Zeilen vorher, HAVING filtert Gruppen nachher.', 'Reihenfolge: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.'],
			'Nutzer pro Stunde, Fehler pro Server, Bestellungen pro Kunde: Wer Daten auswertet, gruppiert ständig. Genau so entstehen die Kurven, mit denen Firmen Entscheidungen treffen.'
		)
	],
	done: {
		sub: 'Du kannst Daten jetzt pro Gruppe auswerten.',
		points: ['GROUP BY bildet Gruppen.', 'Aggregate rechnen pro Gruppe.', 'HAVING filtert Gruppen.']
	},
	next: { id: 'joins', title: 'Tabellen verbinden mit JOIN' }
};
