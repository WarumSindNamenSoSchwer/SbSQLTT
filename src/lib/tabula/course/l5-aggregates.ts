import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const aggregates: Lesson = {
	...BASE,
	id: 'aggregates',
	no: 5,
	title: 'Zählen und zusammenfassen',
	steps: [
		explain(
			'Viele Zeilen, eine Zahl',
			[
				'Oft interessiert dich nicht jede einzelne Zeile, sondern eine Zusammenfassung: Wie viele Bücher gibt es? Was kostet ein Buch im Schnitt?',
				'Dafür gibt es Aggregatfunktionen. COUNT(*) zählt Zeilen, COUNT(spalte) zählt nur Felder, die nicht leer sind. MIN und MAX finden den kleinsten und größten Wert, AVG berechnet den Durchschnitt und SUM die Summe. COUNT(DISTINCT spalte) zählt verschiedene Werte.',
				'Eine Aggregatfunktion macht aus vielen Zeilen eine einzige. WHERE filtert vorher, also wird nur über die passenden Zeilen gerechnet. Leere Felder (NULL) lassen AVG, SUM, MIN und MAX einfach aus.'
			],
			'SELECT COUNT(*) AS anzahl,\n       MIN(year) AS aeltestes,\n       MAX(year) AS neuestes\nFROM books;'
		),
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
		ex('Ausleihen zählen', 'Wie oft wurde bisher ausgeliehen?', 'Gib die Anzahl aller Zeilen in loans aus und nenne die Spalte anzahl.', 'SELECT COUNT(*) AS anzahl\nFROM loans;', 'COUNT(*) zählt alle Zeilen.', 'Hinter SELECT gehört COUNT(*) AS anzahl, die Tabelle ist loans.', 'SELECT COUNT(*) AS anzahl FROM books;', { starter: 'SELECT \nFROM loans;' }),
		ex('Neue Bücher zählen', 'Wie viele Bücher sind nach 2020 erschienen?', 'Gib nur die Anzahl aus und nenne die Spalte anzahl.', 'SELECT COUNT(*) AS anzahl\nFROM books\nWHERE year > 2020;', 'WHERE filtert zuerst, dann zählt COUNT.', 'Hinter SELECT gehört COUNT(*) AS anzahl. Die Bedingung steht schon da.', 'SELECT COUNT(*) AS anzahl FROM books;', { starter: 'SELECT \nFROM books\nWHERE year > 2020;' }),
		ex('Teuerstes Buch', 'Was kostet das teuerste Buch?', 'Gib den höchsten Preis als hoechster aus.', 'SELECT MAX(price) AS hoechster\nFROM books;', 'MAX findet den größten Wert.', 'Die Funktion für den größten Wert heißt MAX. In die Klammer gehört price.', 'SELECT MIN(price) AS hoechster FROM books;'),
		ex('Durchschnittspreis', 'Was kostet ein Buch im Schnitt?', 'Gib den Durchschnittspreis als schnitt aus, gerundet auf 2 Stellen.', 'SELECT ROUND(AVG(price), 2) AS schnitt\nFROM books;', 'Bücher ohne Preis zählen beim Durchschnitt nicht mit.', 'AVG(price) berechnet den Durchschnitt. ROUND kennst du aus Lektion 2.', 'SELECT ROUND(SUM(price), 2) AS schnitt FROM books;'),
		ex('Gesamtwert', 'Was ist der Bestand wert?', 'Gib die Summe aller Preise als gesamt aus.', 'SELECT SUM(price) AS gesamt\nFROM books;', 'SUM addiert alle Werte einer Spalte.', 'Die Summe bildest du mit SUM(price).', 'SELECT COUNT(price) AS gesamt FROM books;'),
		ex('Mit Preis', 'Für wie viele Bücher ist ein Preis eingetragen?', 'Zähle nur die Bücher mit Preis. Nenne die Spalte mit_preis. Benutze kein WHERE.', 'SELECT COUNT(price) AS mit_preis\nFROM books;', 'COUNT(spalte) überspringt leere Felder, COUNT(*) nicht.', 'COUNT(*) zählt alle Zeilen. Schreib stattdessen die Spalte price in die Klammer.', 'SELECT COUNT(*) AS mit_preis FROM books;'),
		ex('Verschiedene Autoren', 'Wie viele verschiedene Autoren gibt es?', 'Gib die Anzahl als autoren aus.', 'SELECT COUNT(DISTINCT author) AS autoren\nFROM books;', 'COUNT(DISTINCT …) zählt jeden Wert nur einmal.', 'DISTINCT kennst du aus Lektion 2. Hier steht es in der Klammer: COUNT(DISTINCT author).', 'SELECT COUNT(author) AS autoren FROM books;'),
		ex('Offene Ausleihen', 'Wie viele Bücher sind gerade ausgeliehen?', 'Zähle die Ausleihen ohne Rückgabedatum als offen.', 'SELECT COUNT(*) AS offen\nFROM loans\nWHERE return_date IS NULL;', 'Erst filtern, dann zählen.', 'Leere Felder findest du mit IS NULL (Lektion 3). Dann COUNT(*) AS offen.', 'SELECT COUNT(return_date) AS offen FROM loans;'),
		ex('Krimis im Überblick', 'Zahlen zu den Krimis', 'Gib für alle Krimis die Anzahl als anzahl, die kleinste Seitenzahl als min_seiten und die größte als max_seiten aus.', "SELECT COUNT(*) AS anzahl, MIN(pages) AS min_seiten, MAX(pages) AS max_seiten\nFROM books\nWHERE genre = 'Krimi';", 'Mehrere Aggregate in einer Zeile.', "Drei Funktionen hinter SELECT, durch Kommas getrennt, und WHERE genre = 'Krimi'.", "SELECT COUNT(*) AS anzahl, MIN(pages) AS min_seiten, MAX(pages) AS max_seiten FROM books;"),
		ex('Ausleihen im Herbst', 'Wie viele Ausleihen gab es im Herbst 2025?', "Zähle die Ausleihen mit loan_date von 2025-09-01 bis 2025-11-30 als herbst.", "SELECT COUNT(*) AS herbst\nFROM loans\nWHERE loan_date BETWEEN '2025-09-01' AND '2025-11-30';", 'BETWEEN funktioniert auch mit Datum.', "Datum steht in Anführungszeichen. BETWEEN '2025-09-01' AND '2025-11-30' kennst du aus Lektion 3.", "SELECT COUNT(*) AS herbst FROM loans WHERE loan_date > '2025-09-01';"),
		ex('Preisspanne', 'Wie weit liegen die Preise der deutschen Verlage auseinander?', 'Für Bücher der Verlage 4 und 6: Gib den Unterschied zwischen teuerstem und günstigstem Buch als spanne aus.', 'SELECT MAX(price) - MIN(price) AS spanne\nFROM books\nWHERE publisher_id IN (4, 6);', 'Mit Aggregaten kannst du weiterrechnen.', 'Rechne MAX(price) - MIN(price) und filtere mit publisher_id IN (4, 6).', 'SELECT MAX(price) - MIN(price) AS spanne FROM books;'),
		ex('Lesestunden', 'Wie lange dauert es, alle Comics und Sachbücher zu lesen?', 'Bei 30 Seiten pro Stunde: Gib die Gesamtzahl der Seiten aller Comics und Sachbücher geteilt durch 30 als stunden aus, gerundet auf eine ganze Zahl.', "SELECT ROUND(SUM(pages) / 30.0) AS stunden\nFROM books\nWHERE genre IN ('Comic', 'Sachbuch');", 'SUM, Rechnen, ROUND und IN: alles aus den letzten Lektionen.', "Summiere pages mit WHERE genre IN ('Comic', 'Sachbuch'), teile durch 30.0 und runde mit ROUND.", "SELECT ROUND(SUM(pages) / 30.0) AS stunden FROM books WHERE genre = 'Comic';"),
		summary(
			['COUNT(*) zählt Zeilen, COUNT(spalte) nur gefüllte Felder.', 'MIN, MAX, AVG und SUM fassen eine Spalte zusammen.', 'COUNT(DISTINCT …) zählt verschiedene Werte.', 'WHERE filtert, bevor zusammengefasst wird.'],
			'Dashboards zeigen fast nur Aggregate: Nutzer heute, Umsatz pro Monat, durchschnittliche Ladezeit. Jede dieser Zahlen ist eine Abfrage mit COUNT, SUM oder AVG.'
		)
	],
	done: {
		sub: 'Du kannst jetzt ganze Tabellen in einer Zahl zusammenfassen.',
		points: ['COUNT zählt Zeilen oder Werte.', 'MIN, MAX, AVG und SUM fassen zusammen.', 'Erst WHERE, dann zusammenfassen.']
	},
	next: { id: 'group-by', title: 'Gruppieren mit GROUP BY' }
};
