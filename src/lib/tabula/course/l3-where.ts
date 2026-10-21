import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const where: Lesson = {
	...BASE,
	id: 'where-filters',
	no: 3,
	title: 'Mit WHERE filtern',
	steps: [
		explain(
			'Warum filtern?',
			[
				'Eine Tabelle enthält oft viel mehr Zeilen, als du für eine Frage brauchst. Mit WHERE sortierst du die anderen aus. Nach WHERE folgt eine Bedingung, zum Beispiel year > 2010. SQL prüft sie für jede Zeile. Nur Zeilen, für die sie stimmt, kommen ins Ergebnis.',
				"Vergleichen kannst du mit =, <> (ungleich), <, >, <= und >=. Text steht in einfachen Anführungszeichen: genre = 'Krimi'. Mit AND müssen beide Bedingungen stimmen, mit OR reicht eine.",
				"Praktische Abkürzungen: IN (4, 6) prüft eine Liste, BETWEEN 10 AND 15 einen Bereich (Grenzen inklusive) und LIKE '%Code%' sucht Text, wobei % für beliebige Zeichen steht. Ein _ steht bei LIKE für genau ein Zeichen. Rechnen geht auch in der Bedingung: year % 2 = 0 trifft gerade Jahre. Leere Felder findest du nur mit IS NULL, nicht mit = NULL."
			],
			'SELECT title, year\nFROM books\nWHERE year > 2010;'
		),
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
		ex('Neue Bücher', 'Welche Bücher sind nach 2020 erschienen?', 'Zeige title und year.', 'SELECT title, year\nFROM books\nWHERE year > 2020;', 'WHERE lässt nur die passenden Zeilen durch.', 'Schau dir die Jahreszahl in deiner Bedingung an. Sollen Bücher aus 2020 selbst dabei sein?', 'SELECT title, year FROM books WHERE year >= 2020;', { starter: 'SELECT title, year\nFROM books\nWHERE ' }),
		ex('Nur Comics', 'Welche Comics hat die Bibliothek?', 'Zeige nur title für alle Bücher mit dem Genre Comic.', "SELECT title\nFROM books\nWHERE genre = 'Comic';", 'Text vergleichst du in einfachen Anführungszeichen.', "Die Bedingung lautet genre = 'Comic'. Achte auf die Anführungszeichen und die Großschreibung.", "SELECT title FROM books WHERE genre = 'Roman';", { starter: 'SELECT title\nFROM books\nWHERE ' }),
		ex('Dünne Bücher', 'Welche Bücher haben weniger als 200 Seiten?', 'Zeige title und pages.', 'SELECT title, pages\nFROM books\nWHERE pages < 200;', 'Kleiner als heißt <.', 'Die Spalte für die Seitenzahl heißt pages. Vergleiche mit < 200.', 'SELECT title, pages FROM books WHERE pages > 200;'),
		ex('Zwei Bedingungen', 'Welche Krimis sind nach 2015 erschienen?', 'Zeige title und year.', "SELECT title, year\nFROM books\nWHERE genre = 'Krimi' AND year > 2015;", 'Mit AND müssen beide Bedingungen stimmen.', "Du brauchst zwei Bedingungen: eine für das Genre und eine für das Jahr. Verbinde sie mit AND.", "SELECT title, year FROM books WHERE genre = 'Krimi';"),
		ex('Eins von beiden', 'Was gibt es an Comics und Sachbüchern?', 'Zeige title und genre für alle Bücher, die Comic oder Sachbuch sind.', "SELECT title, genre\nFROM books\nWHERE genre = 'Comic' OR genre = 'Sachbuch';", 'Mit OR reicht es, wenn eine Bedingung stimmt.', "Ein Buch kann nicht gleichzeitig Comic und Sachbuch sein. Mit AND bekommst du deshalb nichts. Probiere OR.", "SELECT title, genre FROM books WHERE genre = 'Comic' AND genre = 'Sachbuch';"),
		ex('Liste mit IN', 'Welche Bücher kommen aus deutschen Verlagen?', 'Die deutschen Verlage haben die publisher_id 4 und 6. Zeige title und publisher_id.', 'SELECT title, publisher_id\nFROM books\nWHERE publisher_id IN (4, 6);', 'IN ist kürzer als viele ORs.', 'Schreibe publisher_id IN (4, 6). Die Werte stehen in Klammern, getrennt durch Kommas.', 'SELECT title, publisher_id FROM books WHERE publisher_id IN (4);'),
		ex('Preisbereich', 'Welche Bücher kosten zwischen 10 und 15 Euro?', 'Zeige title und price. Bücher für genau 10 oder 15 Euro gehören dazu.', 'SELECT title, price\nFROM books\nWHERE price BETWEEN 10 AND 15;', 'BETWEEN schließt beide Grenzen ein.', 'Mit > und < fallen die Bücher für genau 15 Euro heraus. BETWEEN 10 AND 15 nimmt die Grenzen mit.', 'SELECT title, price FROM books WHERE price > 10 AND price < 15;'),
		ex('Textsuche', 'In welchen Titeln steckt das Wort Code?', 'Zeige title für alle Bücher, deren Titel irgendwo „Code“ enthält.', "SELECT title\nFROM books\nWHERE title LIKE '%Code%';", '% steht für beliebig viele Zeichen davor und danach.', "Mit LIKE 'Code%' findest du nur Titel, die mit Code anfangen. Setze % auf beide Seiten.", "SELECT title FROM books WHERE title LIKE 'Code%';"),
		ex('Genau ein Zeichen', 'Welche Autoren haben einen Vornamen mit drei Buchstaben?', "Zeige jeden author nur einmal. Ein _ steht bei LIKE für genau ein Zeichen, danach kommt ein Leerzeichen.", "SELECT DISTINCT author\nFROM books\nWHERE author LIKE '___ %';", '_ ist genauer als %: genau ein Zeichen, nicht beliebig viele.', "Drei Unterstriche, ein Leerzeichen, dann %: LIKE '___ %'. DISTINCT kennst du aus Lektion 2.", "SELECT DISTINCT author FROM books WHERE author LIKE '___%';"),
		ex('Gerade Jahre', 'Welche Bücher sind in einem geraden Jahr erschienen?', 'Zeige title und year. % ist in SQL der Rest beim Teilen: year % 2 ist 0 bei geraden Jahren.', 'SELECT title, year\nFROM books\nWHERE year % 2 = 0;', 'In der Bedingung darfst du rechnen wie in SELECT.', 'Die Bedingung lautet year % 2 = 0.', 'SELECT title, year FROM books WHERE year % 2 = 1;'),
		ex('Ohne Preis', 'Bei welchen Büchern fehlt der Preis?', 'Zeige title für alle Bücher, bei denen price leer ist.', 'SELECT title\nFROM books\nWHERE price IS NULL;', 'Leere Felder findest du nur mit IS NULL.', 'price = NULL liefert nie ein Ergebnis, weil NULL kein Wert ist. Schreibe price IS NULL.', 'SELECT title FROM books WHERE price = NULL;'),
		ex('Noch nicht zurück', 'Wer hat noch ein Buch ausgeliehen?', 'Zeige student und class für alle Ausleihen ohne Rückgabedatum.', 'SELECT student, class\nFROM loans\nWHERE return_date IS NULL;', 'Offene Ausleihen haben kein return_date.', 'Die Ausleihen stehen in loans. Das Rückgabedatum fehlt, wenn return_date IS NULL ist.', 'SELECT student, class FROM loans WHERE return_date IS NOT NULL;'),
		ex('Alles außer Informatik', 'Welche älteren Bücher sind keine Fachbücher?', 'Zeige title, genre und year für alle Bücher vor 2010, deren Genre nicht Informatik ist.', "SELECT title, genre, year\nFROM books\nWHERE genre <> 'Informatik' AND year < 2010;", '<> bedeutet ungleich.', "Zwei Bedingungen mit AND: genre <> 'Informatik' und year < 2010.", "SELECT title, genre, year FROM books WHERE genre = 'Informatik' AND year < 2010;"),
		ex('Leseliste', 'Eine Leseliste für den Deutschkurs', 'Zeige title als titel und das Alter im Jahr 2026 als jahre_alt für alle Romane und Krimis, die zwischen 2010 und 2020 erschienen sind.', "SELECT title AS titel, 2026 - year AS jahre_alt\nFROM books\nWHERE genre IN ('Roman', 'Krimi') AND year BETWEEN 2010 AND 2020;", 'AS, Rechnen, IN und BETWEEN in einer Abfrage.', "Das Alter kennst du aus Lektion 2: 2026 - year. Die Bedingung braucht genre IN ('Roman', 'Krimi') und year BETWEEN 2010 AND 2020.", "SELECT title AS titel, 2026 - year AS jahre_alt FROM books WHERE genre IN ('Roman', 'Krimi');"),
		summary(
			['WHERE filtert Zeilen. Nur Zeilen, für die die Bedingung stimmt, kommen ins Ergebnis.', 'Vergleiche: =, <>, <, >, <=, >=. Text steht in Anführungszeichen.', 'AND, OR, IN, BETWEEN und LIKE bauen größere Bedingungen.', 'Leere Felder findest du mit IS NULL.'],
			'Ein Onlineshop zeigt dir nur Produkte, die auf Lager sind. Eine Schule sucht alle Schüler einer Klasse. Hinter beidem steckt eine Abfrage mit WHERE.'
		)
	],
	done: {
		sub: 'Du kannst jetzt gezielt die Zeilen auswählen, die du brauchst.',
		points: ['WHERE filtert Zeilen nach einer Bedingung.', 'AND, OR, IN, BETWEEN und LIKE kombinieren.', 'IS NULL findet leere Felder.']
	},
	next: { id: 'order-limit', title: 'Ergebnisse sortieren' }
};
