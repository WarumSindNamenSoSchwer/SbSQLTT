import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const subqueries: Lesson = {
	...BASE,
	id: 'subqueries',
	no: 8,
	title: 'Unterabfragen',
	steps: [
		explain(
			'Abfrage in der Abfrage',
			[
				'Manchmal brauchst du für eine Bedingung einen Wert, den du erst ausrechnen musst. Zum Beispiel: Welche Bücher sind teurer als der Durchschnitt?',
				'Dafür setzt du eine zweite Abfrage in Klammern in die erste. Die innere Abfrage läuft zuerst und liefert einen Wert. Die äußere Abfrage benutzt ihn wie eine feste Zahl. Liefert die innere Abfrage mehrere Werte, vergleichst du mit IN oder NOT IN.',
				'Eine Unterabfrage kann auch hinter FROM stehen. Dann ist ihr Ergebnis eine Tabelle, die du weiter auswertest. So kannst du zum Beispiel erst gruppieren und dann über die Gruppen einen Durchschnitt bilden.'
			],
			'SELECT title, price\nFROM books\nWHERE price > (SELECT AVG(price) FROM books);'
		),
		{
			kind: 'example',
			name: 'Teurer als der Schnitt',
			type: 'Beispiel',
			task: 'So findest du Bücher, die teurer als der Durchschnitt sind.',
			taskSub: 'Führe die Abfrage aus. Die Zahl in der Klammer berechnet SQL selbst.',
			code: 'SELECT title, price\nFROM books\nWHERE price > (SELECT AVG(price) FROM books);',
			msg: (r) => `${r.rows.length} Bücher sind teurer als der Durchschnitt.`,
			sub: 'Führe die innere Abfrage einzeln aus, um den Durchschnitt zu sehen.'
		},
		ex('Das neueste Buch', 'Welche Bücher sind die neuesten?', 'Zeige title und year. Benutze eine Unterabfrage mit MAX, nicht LIMIT. Es können mehrere sein.', 'SELECT title, year\nFROM books\nWHERE year = (SELECT MAX(year) FROM books);', 'Mit LIMIT 1 hättest du eines übersehen.', 'In die Klammer gehört SELECT MAX(year) FROM books.', 'SELECT title, year FROM books ORDER BY year DESC LIMIT 1;', { starter: 'SELECT title, year\nFROM books\nWHERE year = ' }),
		ex('Dicker als der Schnitt', 'Welche Bücher sind dicker als der Durchschnitt?', 'Zeige title und pages.', 'SELECT title, pages\nFROM books\nWHERE pages > (SELECT AVG(pages) FROM books);', 'Die innere Abfrage liefert den Durchschnitt.', 'Wie im Beispiel, nur mit pages statt price.', 'SELECT title, pages FROM books WHERE pages > 300;'),
		ex('Nach Verlagsname', 'Welche Bücher sind bei Addison-Wesley erschienen?', 'Zeige title. Suche die Nummer des Verlags per Unterabfrage über den Namen.', "SELECT title\nFROM books\nWHERE publisher_id = (\n  SELECT id FROM publishers WHERE name = 'Addison-Wesley'\n);", 'Du musst die Nummer des Verlags nicht kennen.', "Die innere Abfrage sucht die id in publishers: SELECT id FROM publishers WHERE name = 'Addison-Wesley'.", 'SELECT title FROM books WHERE publisher_id = 2;', { starter: 'SELECT title\nFROM books\nWHERE publisher_id = (\n  \n);' }),
		ex('Mehrere Werte mit IN', 'Welche Bücher kommen aus Deutschland?', "Zeige title. Die innere Abfrage liefert alle ids der Verlage mit country = 'Deutschland'.", "SELECT title\nFROM books\nWHERE publisher_id IN (\n  SELECT id FROM publishers WHERE country = 'Deutschland'\n);", 'Liefert die Unterabfrage mehrere Werte, brauchst du IN.', "Mit = geht es nur bei genau einem Wert. Schreibe publisher_id IN (SELECT id FROM publishers WHERE country = 'Deutschland').", "SELECT title FROM books WHERE publisher_id IN (SELECT id FROM publishers WHERE country = 'USA');"),
		ex('Nie ausgeliehen', 'Welche Bücher wurden noch nie ausgeliehen?', 'Zeige title. Löse es diesmal mit NOT IN statt mit LEFT JOIN.', 'SELECT title\nFROM books\nWHERE id NOT IN (SELECT book_id FROM loans);', 'Viele Fragen lassen sich mit JOIN oder Unterabfrage lösen.', 'Die innere Abfrage liefert alle ausgeliehenen book_ids. Gesucht sind Bücher, deren id nicht darin vorkommt.', 'SELECT title FROM books WHERE id IN (SELECT book_id FROM loans);'),
		ex('Wer leiht Krimis?', 'Wer hat schon einmal einen Krimi ausgeliehen?', "Zeige jeden student nur einmal, alphabetisch. Die Unterabfrage liefert die ids aller Krimis.", "SELECT DISTINCT student\nFROM loans\nWHERE book_id IN (SELECT id FROM books WHERE genre = 'Krimi')\nORDER BY student;", 'DISTINCT, IN und ORDER BY zusammen.', "Die innere Abfrage: SELECT id FROM books WHERE genre = 'Krimi'. Doppelte Namen entfernst du mit DISTINCT.", "SELECT student FROM loans WHERE book_id IN (SELECT id FROM books WHERE genre = 'Krimi') ORDER BY student;"),
		ex('Über dem Genre-Schnitt', 'Welche Krimis sind teurer als ein Krimi im Schnitt?', 'Zeige title und price. Sowohl außen als auch innen nur Krimis.', "SELECT title, price\nFROM books\nWHERE genre = 'Krimi'\n  AND price > (SELECT AVG(price) FROM books WHERE genre = 'Krimi');", 'Auch die innere Abfrage kann filtern.', "Außen: WHERE genre = 'Krimi' AND price > (…). Innen: der Durchschnitt nur über Krimis.", "SELECT title, price FROM books WHERE genre = 'Krimi' AND price > (SELECT AVG(price) FROM books);"),
		ex('Ausleihen als Spalte', 'Wie oft wurde jedes Informatik-Buch ausgeliehen?', 'Zeige title und die Anzahl seiner Ausleihen als ausleihen. Berechne die Anzahl mit einer Unterabfrage in der SELECT-Liste: (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id).', "SELECT b.title,\n       (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id) AS ausleihen\nFROM books b\nWHERE b.genre = 'Informatik';", 'Die Unterabfrage läuft für jede Zeile neu. Bücher ohne Ausleihe bekommen 0.', "Gib books den kurzen Namen b, damit die innere Abfrage mit b.id auf das aktuelle Buch zeigen kann.", "SELECT b.title, (SELECT COUNT(*) FROM loans l) AS ausleihen FROM books b WHERE b.genre = 'Informatik';"),
		ex('Gruppen auswerten', 'Wie viele Bücher hat ein Genre im Schnitt?', 'Zähle zuerst die Bücher pro Genre in einer Unterabfrage hinter FROM. Berechne dann den Durchschnitt dieser Anzahlen als schnitt.', 'SELECT AVG(anzahl) AS schnitt\nFROM (\n  SELECT genre, COUNT(*) AS anzahl\n  FROM books\n  GROUP BY genre\n);', 'Eine Unterabfrage hinter FROM ist wie eine neue Tabelle.', 'Die innere Abfrage kennst du aus Lektion 6. Außen rechnest du AVG(anzahl).', 'SELECT AVG(anzahl) AS schnitt FROM (SELECT genre, COUNT(*) AS anzahl FROM books);'),
		ex('Beste Klasse', 'Welche Klasse hat am meisten ausgeliehen?', 'Zeige class und die Anzahl als anzahl, aber nur die Klasse(n) mit der höchsten Anzahl. Nutze HAVING mit einer Unterabfrage, kein LIMIT.', 'SELECT class, COUNT(*) AS anzahl\nFROM loans\nGROUP BY class\nHAVING COUNT(*) = (\n  SELECT MAX(c) FROM (SELECT COUNT(*) AS c FROM loans GROUP BY class)\n);', 'Unterabfragen lassen sich verschachteln.', 'Die innerste Abfrage zählt pro Klasse, die mittlere nimmt davon das MAX. Außen vergleichst du mit HAVING COUNT(*) = (…).', 'SELECT class, COUNT(*) AS anzahl FROM loans GROUP BY class HAVING COUNT(*) > 6;'),
		ex('Unterschätzte Bücher', 'Welche teuren Bücher werden kaum gelesen?', 'Zeige b.title, p.name und b.price für alle Bücher, die teurer als der Durchschnitt sind und höchstens einmal ausgeliehen wurden. Teuerstes zuerst.', 'SELECT b.title, p.name, b.price\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id\nWHERE b.price > (SELECT AVG(price) FROM books)\n  AND (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id) <= 1\nORDER BY b.price DESC;', 'JOIN, zwei Unterabfragen und ORDER BY: So sieht echte Auswertung aus.', 'Verbinde books und publishers. Zwei Bedingungen: Preis über (SELECT AVG(price) …) und Anzahl der Ausleihen (wie in „Ausleihen als Spalte“) höchstens 1.', 'SELECT b.title, p.name, b.price FROM books b JOIN publishers p ON b.publisher_id = p.id WHERE b.price > (SELECT AVG(price) FROM books) ORDER BY b.price DESC;'),
		summary(
			['Eine Unterabfrage steht in Klammern und läuft zuerst.', 'Ein Wert: vergleichen mit = oder >. Mehrere Werte: IN oder NOT IN.', 'Hinter FROM wird eine Unterabfrage zur Tabelle.', 'In der SELECT-Liste läuft sie für jede Zeile neu.'],
			'Welche Kunden haben mehr als der Durchschnitt bestellt? Welche Server sind langsamer als üblich? Solche Vergleiche mit einem berechneten Wert sind typische Unterabfragen.'
		)
	],
	done: {
		sub: 'Du hast die SQL-Grundlagen geschafft.',
		points: ['Unterabfragen stehen in Klammern und laufen zuerst.', 'Mehrere Werte vergleichst du mit IN.', 'Unterabfragen gehen in WHERE, FROM und SELECT.']
	},
	next: { id: 'ddl', title: 'Eigene Datenbank entwerfen' }
};
