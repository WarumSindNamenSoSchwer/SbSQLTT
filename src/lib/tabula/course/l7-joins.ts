import { ex, explain, summary, type Lesson } from './types.ts';
import { BASE } from './base.ts';

export const joins: Lesson = {
	...BASE,
	id: 'joins',
	no: 7,
	title: 'Tabellen verbinden mit JOIN',
	steps: [
		explain(
			'Zwei Tabellen, ein Ergebnis',
			[
				'In books steht bei jedem Buch nur die Nummer des Verlags, publisher_id. Der Name steht in publishers. In loans steht nur book_id, der Titel steht in books. So wird jede Information nur einmal gespeichert.',
				'Mit JOIN verbindest du Tabellen. Nach ON steht, welche Spalten zusammengehören: books.publisher_id = publishers.id. Kurze Namen wie b und p sparen Schreibarbeit. Du kannst auch drei Tabellen hintereinander verbinden.',
				'Ein normaler JOIN zeigt nur Zeilen, die in beiden Tabellen einen Partner haben. LEFT JOIN zeigt alle Zeilen der linken Tabelle, auch ohne Partner. Fehlende Werte sind dann NULL, mit COALESCE(wert, …) ersetzt du sie durch einen eigenen Text. Eine Tabelle kann sogar mit sich selbst verbunden werden, wenn du ihr zwei kurze Namen gibst. Alles aus den letzten Lektionen funktioniert danach wie gewohnt: WHERE, GROUP BY, ORDER BY.'
			],
			'SELECT b.title, p.name\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id;'
		),
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
		ex('Verlag und Land', 'Aus welchem Land kommt jedes Buch?', 'Zeige b.title und p.country.', 'SELECT b.title, p.country\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id;', 'Jede Spalte aus publishers steht dir jetzt zur Verfügung.', 'Wie im Beispiel, nur mit p.country statt p.name.', 'SELECT b.title, p.country FROM books b JOIN publishers p;', { starter: 'SELECT b.title, p.country\nFROM books b\nJOIN publishers p ON ' }),
		ex('Wer las was?', 'Welche Bücher wurden ausgeliehen?', 'Zeige l.student und b.title für alle Ausleihen.', 'SELECT l.student, b.title\nFROM loans l\nJOIN books b ON l.book_id = b.id;', 'Aus einer Buchnummer wird ein Titel.', 'In loans steht book_id. Verbinde mit ON l.book_id = b.id.', 'SELECT l.student, b.title FROM loans l JOIN books b ON l.id = b.id;'),
		ex('Neue Bücher mit Verlag', 'Von welchen Verlagen sind die Bücher ab 2023?', 'Zeige b.title und p.name für alle Bücher ab 2023.', 'SELECT b.title, p.name\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id\nWHERE b.year >= 2023;', 'JOIN und WHERE lassen sich kombinieren.', 'Nach ON gehört b.publisher_id = p.id, nach WHERE die Bedingung b.year >= 2023.', 'SELECT b.title, p.name FROM books b JOIN publishers p ON b.publisher_id = p.id;'),
		ex('Filtern über Namen', 'Welche Bücher sind bei O’Reilly erschienen?', "Zeige b.title. Filtere über den Verlagsnamen, nicht die Nummer. Der Name lautet O'Reilly Media, im SQL schreibst du das Apostroph doppelt: 'O''Reilly Media'.", "SELECT b.title\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id\nWHERE p.name = 'O''Reilly Media';", 'Dank JOIN musst du die Nummer nicht kennen.', "Die Bedingung lautet p.name = 'O''Reilly Media'. Zwei Apostrophe stehen für eins.", 'SELECT b.title FROM books b JOIN publishers p ON b.publisher_id = p.id WHERE p.id = 1;'),
		ex('Bücher pro Verlagsname', 'Wie viele Bücher hat jeder Verlag?', 'Zeige p.name und die Anzahl als anzahl, die meisten zuerst.', 'SELECT p.name, COUNT(*) AS anzahl\nFROM books b\nJOIN publishers p ON b.publisher_id = p.id\nGROUP BY p.name\nORDER BY anzahl DESC;', 'JOIN und GROUP BY: Jetzt mit Namen statt Nummern.', 'Verbinde books und publishers, gruppiere nach p.name und sortiere absteigend.', 'SELECT p.name, COUNT(*) AS anzahl FROM books b JOIN publishers p ON b.publisher_id = p.id GROUP BY p.name ORDER BY anzahl;'),
		ex('Auch ohne Partner', 'Welche Verlage gibt es, auch solche ohne Bücher?', 'Zeige p.name und b.title für alle Verlage. Ein Verlag hat noch kein Buch.', 'SELECT p.name, b.title\nFROM publishers p\nLEFT JOIN books b ON b.publisher_id = p.id;', 'LEFT JOIN behält alle Zeilen der linken Tabelle.', 'Ein normaler JOIN lässt Verlage ohne Buch weg. Probiere LEFT JOIN.', 'SELECT p.name, b.title FROM publishers p JOIN books b ON b.publisher_id = p.id;'),
		ex('Lücken füllen', 'Verlage mit Platzhalter', "Wie eben, aber statt NULL soll 'noch kein Buch' stehen. Zeige p.name und den Titel als titel.", "SELECT p.name, COALESCE(b.title, 'noch kein Buch') AS titel\nFROM publishers p\nLEFT JOIN books b ON b.publisher_id = p.id;", 'COALESCE nimmt den ersten Wert, der nicht NULL ist.', "Ersetze b.title durch COALESCE(b.title, 'noch kein Buch') AS titel.", 'SELECT p.name, b.title AS titel FROM publishers p LEFT JOIN books b ON b.publisher_id = p.id;'),
		ex('Nie ausgeliehen', 'Welche Bücher wurden noch nie ausgeliehen?', 'Zeige b.title. Tipp: LEFT JOIN von books auf loans, dann fehlt bei diesen Büchern die Ausleihe.', 'SELECT b.title\nFROM books b\nLEFT JOIN loans l ON l.book_id = b.id\nWHERE l.id IS NULL;', 'LEFT JOIN plus IS NULL findet, was fehlt.', 'Nach dem LEFT JOIN ist l.id bei Büchern ohne Ausleihe NULL. Filtere mit WHERE l.id IS NULL.', 'SELECT b.title FROM books b JOIN loans l ON l.book_id = b.id;'),
		ex('Drei Tabellen', 'Welche Ausleihen kamen von welchem Verlag?', 'Zeige l.student, b.title und p.name für alle Ausleihen.', 'SELECT l.student, b.title, p.name\nFROM loans l\nJOIN books b ON l.book_id = b.id\nJOIN publishers p ON b.publisher_id = p.id;', 'JOINs lassen sich aneinanderreihen.', 'Erst loans mit books verbinden, dann books mit publishers. Jeder JOIN braucht sein eigenes ON.', 'SELECT l.student, b.title, p.name FROM loans l JOIN books b ON l.book_id = b.id JOIN publishers p ON l.book_id = p.id;'),
		ex('Gleicher Autor', 'Was hat der Autor von „Kalte Spur“ noch geschrieben?', "Verbinde books mit sich selbst (b1 und b2) über den Autor. Zeige b2.title, aber nicht „Kalte Spur“ selbst.", "SELECT b2.title\nFROM books b1\nJOIN books b2 ON b1.author = b2.author\nWHERE b1.title = 'Kalte Spur' AND b2.id <> b1.id;", 'Ein Self-Join vergleicht Zeilen derselben Tabelle.', "FROM books b1 JOIN books b2 ON b1.author = b2.author. In WHERE: b1.title = 'Kalte Spur' und b2.id <> b1.id, damit das Buch selbst nicht auftaucht.", "SELECT b2.title FROM books b1 JOIN books b2 ON b1.author = b2.author WHERE b1.title = 'Kalte Spur';"),
		ex('Beliebteste Bücher', 'Welche drei Bücher wurden am häufigsten ausgeliehen?', 'Zeige b.title und die Anzahl der Ausleihen als ausleihen, die meisten zuerst. Bei Gleichstand alphabetisch nach Titel.', 'SELECT b.title, COUNT(*) AS ausleihen\nFROM loans l\nJOIN books b ON l.book_id = b.id\nGROUP BY b.title\nORDER BY ausleihen DESC, b.title\nLIMIT 3;', 'JOIN, GROUP BY, zwei Sortierschlüssel und LIMIT.', 'Gruppiere nach b.title, sortiere mit ORDER BY ausleihen DESC, b.title und begrenze auf 3.', 'SELECT b.title, COUNT(*) AS ausleihen FROM loans l JOIN books b ON l.book_id = b.id GROUP BY b.title ORDER BY ausleihen DESC LIMIT 3;'),
		ex('Genres pro Klasse', 'Was liest die Q1?', 'Zeige b.genre und die Anzahl der Ausleihen der Klasse Q1 als anzahl, die meisten zuerst.', "SELECT b.genre, COUNT(*) AS anzahl\nFROM loans l\nJOIN books b ON l.book_id = b.id\nWHERE l.class = 'Q1'\nGROUP BY b.genre\nORDER BY anzahl DESC;", 'Filtern auf der einen Tabelle, gruppieren nach der anderen.', "WHERE l.class = 'Q1', dann GROUP BY b.genre und ORDER BY anzahl DESC.", "SELECT b.genre, COUNT(*) AS anzahl FROM loans l JOIN books b ON l.book_id = b.id GROUP BY b.genre ORDER BY anzahl DESC;"),
		ex('Leihwert pro Land', 'Wie viel Buchwert wurde je Verlagsland ausgeliehen?', 'Zeige p.country als land und die Summe der Buchpreise aller Ausleihen als wert. Nur Länder mit einem Wert über 200, höchster zuerst.', 'SELECT p.country AS land, SUM(b.price) AS wert\nFROM loans l\nJOIN books b ON l.book_id = b.id\nJOIN publishers p ON b.publisher_id = p.id\nGROUP BY p.country\nHAVING SUM(b.price) > 200\nORDER BY wert DESC;', 'Drei Tabellen, gruppiert, gefiltert und sortiert.', 'Verbinde alle drei Tabellen, gruppiere nach p.country, filtere die Gruppen mit HAVING SUM(b.price) > 200.', 'SELECT p.country AS land, SUM(b.price) AS wert FROM loans l JOIN books b ON l.book_id = b.id JOIN publishers p ON b.publisher_id = p.id GROUP BY p.country ORDER BY wert DESC;'),
		summary(
			['Daten werden auf mehrere Tabellen verteilt, damit nichts doppelt steht.', 'JOIN … ON verbindet Zeilen, die zusammengehören, auch über drei Tabellen.', 'JOIN zeigt nur Paare, LEFT JOIN auch Zeilen ohne Partner.', 'Nach dem JOIN funktionieren WHERE, GROUP BY und ORDER BY wie gewohnt.'],
			'Ein Onlineshop speichert Kunden, Bestellungen und Produkte in getrennten Tabellen. Die Rechnung entsteht erst durch JOINs zwischen ihnen.'
		)
	],
	done: {
		sub: 'Du kannst jetzt Daten aus mehreren Tabellen kombinieren.',
		points: ['JOIN … ON verbindet Tabellen.', 'LEFT JOIN behält alle Zeilen links.', 'JOIN lässt sich mit allem kombinieren.']
	},
	next: { id: 'subqueries', title: 'Unterabfragen' }
};
