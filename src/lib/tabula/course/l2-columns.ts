import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const selectColumns: Lesson = {
	...BASE,
	id: 'select-columns',
	no: 2,
	title: 'Spalten auswählen und umbenennen',
	steps: [
		explain(
			'Gezielt auswählen',
			[
				'Nach SELECT kannst du mehrere Spalten nennen, getrennt durch Kommas. Die Reihenfolge bestimmst du selbst. Mit AS gibst du einer Spalte im Ergebnis einen neuen Namen. In der Tabelle heißt sie weiter wie vorher.',
				'DISTINCT entfernt doppelte Zeilen aus dem Ergebnis. SELECT DISTINCT genre zeigt jedes Genre nur einmal, auch wenn es viele Bücher dazu gibt.',
				'Du kannst auch rechnen: 2026 - year ergibt das Alter eines Buchs, price * 0.9 den Preis mit 10 % Rabatt. ROUND(wert, 2) rundet auf zwei Nachkommastellen. Mit || hängst du Texte aneinander.'
			],
			'SELECT title AS titel,\n       2026 - year AS jahre_alt\nFROM books;'
		),
		{
			kind: 'example',
			name: 'Umbenennen und rechnen',
			type: 'Beispiel',
			task: 'So benennst du Spalten um und rechnest mit ihnen.',
			taskSub: 'Führe die Abfrage aus und achte auf die Spaltenköpfe.',
			code: 'SELECT title AS titel,\n       2026 - year AS jahre_alt\nFROM books;',
			msg: (r) => `Die Spalten heißen jetzt ${r.columns.join(' und ')}.`,
			sub: 'Ändere die Namen hinter AS und führe die Abfrage noch einmal aus.'
		},
		ex('Zwei Spalten', 'Wann ist welches Buch erschienen?', 'Zeige die Spalten title und year aus books.', 'SELECT title, year\nFROM books;', 'Mehrere Spalten trennst du mit Kommas.', 'Schreibe beide Spaltennamen hinter SELECT und trenne sie mit einem Komma.', 'SELECT title FROM books;', { starter: 'SELECT \nFROM books;' }),
		ex('Deutsche Namen', 'Verlage mit deutschen Spaltennamen', 'Zeige id als nummer und name als verlag aus publishers.', 'SELECT id AS nummer, name AS verlag\nFROM publishers;', 'AS ändert nur den Namen im Ergebnis.', 'Hinter jedes AS gehört der neue Name: nummer und verlag.', 'SELECT id, name FROM publishers;', { starter: 'SELECT id AS , name AS \nFROM publishers;' }),
		ex('Drei neue Namen', 'Ein Katalog auf Deutsch', 'Zeige title als titel, author als autor und pages als seiten.', 'SELECT title AS titel, author AS autor, pages AS seiten\nFROM books;', 'Drei Spalten, drei neue Namen.', 'Jede Spalte bekommt ihr eigenes AS: title AS titel, author AS autor, pages AS seiten.', 'SELECT title AS titel, author AS autor, pages FROM books;'),
		ex('Jedes Genre einmal', 'Welche Genres gibt es?', 'Zeige jedes Genre aus books genau einmal.', 'SELECT DISTINCT genre\nFROM books;', 'DISTINCT entfernt die doppelten Zeilen.', 'Ohne Zusatz kommt jedes Genre so oft, wie es Bücher hat. Schreibe DISTINCT direkt hinter SELECT.', 'SELECT genre FROM books;', { starter: 'SELECT genre\nFROM books;' }),
		ex('Alle Klassen', 'Aus welchen Klassen wurde ausgeliehen?', 'Zeige jede Klasse aus loans genau einmal.', 'SELECT DISTINCT class\nFROM loans;', 'Vier Klassen, obwohl es 40 Ausleihen gibt.', 'Die Klassen stehen in loans in der Spalte class. Doppelte entfernst du mit DISTINCT.', 'SELECT class FROM loans;'),
		ex('Autorenliste', 'Eine Liste aller Autoren', 'Zeige jeden Autor genau einmal. Die Spalte soll autor heißen.', 'SELECT DISTINCT author AS autor\nFROM books;', 'DISTINCT und AS lassen sich kombinieren.', 'Erst DISTINCT, dann die Spalte, dann AS mit dem neuen Namen.', 'SELECT author AS autor FROM books;'),
		ex('Wie alt?', 'Wie alt ist jedes Buch?', 'Zeige title und das Alter im Jahr 2026 als jahre_alt.', 'SELECT title, 2026 - year AS jahre_alt\nFROM books;', 'SQL rechnet für jede Zeile einzeln.', 'Das Alter ist 2026 minus das Erscheinungsjahr. Gib der Rechnung mit AS den Namen jahre_alt.', 'SELECT title, year AS jahre_alt FROM books;'),
		ex('Rabatt', 'Was kostet jedes Buch mit 10 % Rabatt?', 'Zeige title und den Rabattpreis als rabattpreis, gerundet auf 2 Stellen.', 'SELECT title, ROUND(price * 0.9, 2) AS rabattpreis\nFROM books;', 'Bei Büchern ohne Preis bleibt auch der Rabattpreis NULL.', '10 % Rabatt heißt price * 0.9. Runde mit ROUND(…, 2).', 'SELECT title, ROUND(price * 0.1, 2) AS rabattpreis FROM books;'),
		ex('Seiten pro Euro', 'Welches Buch bietet viel Lesestoff fürs Geld?', 'Zeige title und pages geteilt durch price als seiten_pro_euro, gerundet auf 1 Stelle.', 'SELECT title, ROUND(pages / price, 1) AS seiten_pro_euro\nFROM books;', 'Rechnen geht auch zwischen zwei Spalten.', 'Teile pages durch price und runde mit ROUND(…, 1).', 'SELECT title, ROUND(price / pages, 1) AS seiten_pro_euro FROM books;'),
		ex('Text zusammensetzen', 'Ein Etikett für jedes Buch', "Zeige eine einzige Spalte etikett im Format: Titel (Jahr), zum Beispiel „Clean Code (2008)“.", "SELECT title || ' (' || year || ')' AS etikett\nFROM books;", 'Mit || klebst du Spalten und Text zusammen.', "Du brauchst title, dann den Text ' (', dann year, dann ')'. Verbinde alles mit ||.", "SELECT title || year AS etikett FROM books;"),
		ex('Alles zusammen', 'Eine Preisliste für die Schulbibliothek', 'Zeige title als titel, author als autor und den Preis mit 19 % Aufschlag als brutto, gerundet auf 2 Stellen.', 'SELECT title AS titel, author AS autor, ROUND(price * 1.19, 2) AS brutto\nFROM books;', 'Umbenennen, rechnen und runden in einer Abfrage.', '19 % Aufschlag heißt price * 1.19. Jede der drei Spalten bekommt ein AS.', 'SELECT title AS titel, author AS autor, ROUND(price * 0.19, 2) AS brutto FROM books;'),
		summary(
			['Mehrere Spalten trennst du mit Kommas, AS benennt sie um.', 'DISTINCT entfernt doppelte Zeilen.', 'Mit +, -, *, / rechnest du pro Zeile, ROUND rundet.', '|| verbindet Texte.'],
			'Ein Export für die Schulverwaltung braucht feste Spaltennamen und fertig berechnete Werte. Mit AS und Rechnungen bereitest du das Ergebnis vor, ohne die Datenbank zu ändern.'
		)
	],
	done: {
		sub: 'Du kannst Ergebnisse jetzt genau so formen, wie du sie brauchst.',
		points: ['Spalten auswählen und mit AS umbenennen.', 'Doppelte mit DISTINCT entfernen.', 'Mit Spalten rechnen und Texte verbinden.']
	},
	next: { id: 'where-filters', title: 'Mit WHERE filtern' }
};
