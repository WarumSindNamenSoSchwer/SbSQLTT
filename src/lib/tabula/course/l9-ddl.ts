import { ex, explain, summary, type Lesson } from './types.ts';

export const SCHOOL_SEED = `
CREATE TABLE klassen (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  raum TEXT
);
INSERT INTO klassen VALUES (1,'10a','A104'),(2,'10b','A105'),(3,'Q1 Informatik','B201');
`;

// Pruefabfrage: Struktur einer Tabelle (wird in sql.ts/compareSchema konkret ausgewertet)
const schemaOf = (t: string) =>
	`SELECT p.name AS spalte, lower(p.type) AS typ, p.pk AS primaer, p."notnull" AS pflicht, coalesce(f."table" || '.' || f."to", '') AS verweis FROM pragma_table_info('${t}') p LEFT JOIN pragma_foreign_key_list('${t}') f ON f."from" = p.name ORDER BY p.cid`;

const UNIQUE_CHECK = `SELECT p.name AS spalte, lower(p.type) AS typ, p."notnull" AS pflicht, (SELECT COUNT(*) FROM pragma_index_list('lehrer') il JOIN pragma_index_info(il.name) ii WHERE il."unique" = 1 AND ii.name = p.name) AS eindeutig FROM pragma_table_info('lehrer') p ORDER BY p.cid`;

const SCHUELER = 'CREATE TABLE schueler (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  klasse_id INTEGER REFERENCES klassen(id)\n);';
const FILLED = `${SCHUELER}\nINSERT INTO schueler VALUES\n  (1, 'Mia', 2),\n  (2, 'Jonas', 2),\n  (3, 'Lea', 1),\n  (4, 'Noah', 3);`;
const ALL = 'SELECT * FROM schueler ORDER BY id';

export const ddl: Lesson = {
	id: 'ddl',
	track: 'database',
	trackLabel: 'EIGENE DATENBANK',
	no: 9,
	of: 9,
	title: 'Eigene Datenbank entwerfen',
	db: { name: 'schule.db', seed: SCHOOL_SEED, mainTable: 'klassen' },
	steps: [
		explain(
			'Tabellen selbst anlegen',
			[
				'Bisher hast du Daten abgefragt. Jetzt baust du die Tabellen selbst. Mit CREATE TABLE legst du eine neue Tabelle an und bestimmst ihre Spalten und deren Datentypen, zum Beispiel INTEGER für ganze Zahlen, REAL für Kommazahlen und TEXT für Wörter.',
				'Jede Tabelle braucht einen Primärschlüssel: eine Spalte, die jede Zeile eindeutig macht. Ein Fremdschlüssel (REFERENCES) verweist auf den Primärschlüssel einer anderen Tabelle. So weiß ein Schüler, zu welcher Klasse er gehört. Weitere Regeln: NOT NULL (Pflichtfeld), UNIQUE (kein Wert doppelt) und DEFAULT (Standardwert).',
				'Mit INSERT INTO füllst du die Tabelle, mit UPDATE änderst du Zeilen und mit DELETE löschst du sie. Achtung: UPDATE und DELETE ohne WHERE treffen jede Zeile. Mit ALTER TABLE … ADD COLUMN ergänzt du später eine Spalte, DROP TABLE löscht eine ganze Tabelle. Hier wird nach jedem Versuch alles zurückgesetzt, also probiere ruhig.'
			],
			SCHUELER
		),
		{
			kind: 'example',
			name: 'Zeilen einfügen',
			type: 'Beispiel',
			task: 'So legst du eine Tabelle an und füllst sie.',
			taskSub: 'Führe alles zusammen aus. Die letzte Zeile zeigt, was in der neuen Tabelle steht.',
			code: "CREATE TABLE faecher (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);\nINSERT INTO faecher VALUES (1, 'Informatik'), (2, 'Mathe');\nSELECT * FROM faecher;",
			msg: (r) => `Die neue Tabelle faecher hat ${r.rows.length} Zeilen.`,
			sub: 'Füge ein drittes Fach hinzu und führe noch einmal aus.'
		},
		ex('Erste Tabelle', 'Lege die Tabelle raeume an.', 'Spalten: id (INTEGER, Primärschlüssel) und name (TEXT).', 'CREATE TABLE raeume (\n  id INTEGER PRIMARY KEY,\n  name TEXT\n);', 'Die Tabelle steht. Jetzt kann sie Zeilen aufnehmen.', 'CREATE TABLE raeume ( … ); Pro Spalte Name und Typ, getrennt durch ein Komma.', 'CREATE TABLE raeume (id INTEGER, name TEXT);', { check: schemaOf('raeume'), starter: 'CREATE TABLE raeume (\n  \n);' }),
		ex('Tabelle schueler', 'Lege die Tabelle schueler an.', 'Spalten: id (INTEGER, Primärschlüssel), name (TEXT, nicht leer) und klasse_id (INTEGER, verweist auf klassen.id).', SCHUELER, 'Primärschlüssel, Pflichtfeld und Fremdschlüssel sind gesetzt.', 'Pro Spalte: Name, Typ, Zusatz. id INTEGER PRIMARY KEY, name TEXT NOT NULL, klasse_id INTEGER REFERENCES klassen(id).', 'CREATE TABLE schueler (id INTEGER PRIMARY KEY, name TEXT, klasse_id INTEGER);', { check: schemaOf('schueler'), starter: 'CREATE TABLE schueler (\n  \n);' }),
		ex('Keine Doppelten', 'Lege die Tabelle lehrer an.', 'Spalten: id (INTEGER, Primärschlüssel), name (TEXT, nicht leer) und email (TEXT). Keine E-Mail-Adresse darf doppelt vorkommen.', 'CREATE TABLE lehrer (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE\n);', 'UNIQUE verhindert doppelte Werte, ohne Primärschlüssel zu sein.', 'Hinter email TEXT gehört der Zusatz UNIQUE.', 'CREATE TABLE lehrer (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT);', { check: UNIQUE_CHECK, starter: 'CREATE TABLE lehrer (\n  \n);' }),
		ex('Eine Klasse dazu', 'Die Schule bekommt eine neue Klasse.', "Füge in klassen die Zeile (4, '10c', 'A106') ein.", "INSERT INTO klassen VALUES (4, '10c', 'A106');", 'Die Werte stehen in derselben Reihenfolge wie die Spalten.', "INSERT INTO klassen VALUES (4, '10c', 'A106'); Text in Anführungszeichen.", "INSERT INTO klassen VALUES (4, '10d', 'A106');", { check: 'SELECT * FROM klassen ORDER BY id' }),
		ex('Schüler eintragen', 'Trage zwei Schüler in die Klasse 10b ein.', 'Die Tabelle schueler ist schon angelegt. Trage Mia (id 1) und Jonas (id 2) ein. Die 10b hat die id 2.', `${SCHUELER}\nINSERT INTO schueler VALUES\n  (1, 'Mia', 2),\n  (2, 'Jonas', 2);`, 'Über klasse_id findet der JOIN die passende Klasse.', "Jede Zeile in Klammern: (id, 'Name', klasse_id). Zeilen trennst du mit Kommas.", `${SCHUELER}\nINSERT INTO schueler VALUES (1, 'Mia', 1), (2, 'Jonas', 2);`, { check: 'SELECT s.id, s.name, k.name AS klasse FROM schueler s JOIN klassen k ON s.klasse_id = k.id ORDER BY s.id', starter: `${SCHUELER}\nINSERT INTO schueler VALUES\n  ` }),
		ex('Nur einige Spalten', 'Ein Raum ohne Raumnummer', "Füge die Klasse (5, 'Q2 Informatik') ein, ohne raum anzugeben. Nenne dazu die Spalten: INSERT INTO klassen (id, name) VALUES …", "INSERT INTO klassen (id, name) VALUES (5, 'Q2 Informatik');", 'Nicht genannte Spalten bleiben NULL.', 'Nach dem Tabellennamen stehen in Klammern die Spalten, die du füllst. Danach VALUES mit genau so vielen Werten.', "INSERT INTO klassen (id, name, raum) VALUES (5, 'Q2 Informatik', '');", { check: 'SELECT * FROM klassen ORDER BY id' }),
		ex('Umziehen', 'Die 10a zieht um.', "Ändere den Raum der Klasse mit id 1 auf 'C301'.", "UPDATE klassen\nSET raum = 'C301'\nWHERE id = 1;", 'UPDATE ändert nur die Zeilen, die WHERE trifft.', "UPDATE klassen SET raum = 'C301' WHERE id = 1; Ohne WHERE ziehen alle Klassen um.", "UPDATE klassen SET raum = 'C301';", { check: 'SELECT * FROM klassen ORDER BY id' }),
		ex('Klassenwechsel', 'Jonas wechselt in die 10a.', `Die Tabelle schueler ist angelegt und gefüllt. Setze bei Jonas (id 2) die klasse_id auf 1.`, `${FILLED}\nUPDATE schueler\nSET klasse_id = 1\nWHERE id = 2;`, 'Ein Fremdschlüssel lässt sich ändern wie jede andere Spalte.', 'Hänge an den Startcode UPDATE schueler SET klasse_id = 1 WHERE id = 2; an.', `${FILLED}\nUPDATE schueler SET klasse_id = 1 WHERE id = 1;`, { check: ALL, starter: `${FILLED}\n` }),
		ex('Abgang', 'Noah verlässt die Schule.', 'Die Tabelle schueler ist angelegt und gefüllt. Lösche Noah (id 4).', `${FILLED}\nDELETE FROM schueler\nWHERE id = 4;`, 'DELETE entfernt ganze Zeilen.', 'DELETE FROM schueler WHERE id = 4; Ohne WHERE wäre die Tabelle leer.', `${FILLED}\nDELETE FROM schueler;`, { check: ALL, starter: `${FILLED}\n` }),
		ex('Mehrere auf einmal', 'Alle Räume im A-Gebäude werden umbenannt.', "Ersetze bei allen Klassen, deren raum mit A beginnt, den Raum durch 'Neubau'.", "UPDATE klassen\nSET raum = 'Neubau'\nWHERE raum LIKE 'A%';", 'WHERE mit LIKE aus Lektion 3 funktioniert auch bei UPDATE.', "Die Bedingung kennst du aus Lektion 3: raum LIKE 'A%'.", "UPDATE klassen SET raum = 'Neubau' WHERE raum = 'A104';", { check: 'SELECT * FROM klassen ORDER BY id' }),
		ex('Neue Spalte', 'Jede Klasse bekommt eine Jahrgangsstufe.', 'Ergänze in klassen die Spalte stufe (INTEGER) mit dem Standardwert 10.', 'ALTER TABLE klassen\nADD COLUMN stufe INTEGER DEFAULT 10;', 'Bestehende Zeilen bekommen den Standardwert.', 'ALTER TABLE klassen ADD COLUMN stufe INTEGER DEFAULT 10; Ohne DEFAULT bleibt die neue Spalte leer.', 'ALTER TABLE klassen ADD COLUMN stufe INTEGER;', { check: 'SELECT * FROM klassen ORDER BY id' }),
		ex('Aufräumen', 'Eine Tabelle wird nicht mehr gebraucht.', 'Der Startcode legt die Tabelle faecher an. Lösche sie danach wieder komplett.', "CREATE TABLE faecher (id INTEGER PRIMARY KEY, name TEXT);\nDROP TABLE faecher;", 'DROP TABLE entfernt Tabelle und Daten. In echten Datenbanken gibt es kein Zurück.', 'Hänge DROP TABLE faecher; an den Startcode an.', 'CREATE TABLE faecher (id INTEGER PRIMARY KEY, name TEXT);\nDELETE FROM faecher;', { check: "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name", starter: 'CREATE TABLE faecher (id INTEGER PRIMARY KEY, name TEXT);\n' }),
		ex('Noten-Tabelle', 'Lege die Tabelle noten an.', 'Spalten: id (INTEGER, Primärschlüssel), schueler_id (INTEGER, verweist auf schueler.id), fach (TEXT, nicht leer), note (REAL). Die Tabelle schueler steht schon im Startcode.', `${SCHUELER}\nCREATE TABLE noten (\n  id INTEGER PRIMARY KEY,\n  schueler_id INTEGER REFERENCES schueler(id),\n  fach TEXT NOT NULL,\n  note REAL\n);`, 'Zwei Tabellen, über einen Fremdschlüssel verbunden.', 'Wie schueler, nur mit vier Spalten. Für Kommazahlen nimmst du REAL.', `${SCHUELER}\nCREATE TABLE noten (id INTEGER PRIMARY KEY, schueler_id INTEGER, fach TEXT NOT NULL, note REAL);`, { check: schemaOf('noten'), starter: `${SCHUELER}\nCREATE TABLE noten (\n  \n);` }),
		ex('Alles zusammen', 'Eine kleine Schul-Datenbank, die du selbst auswertest', "Lege schueler an, trage Mia (1, Klasse 2), Jonas (2, Klasse 2) und Lea (3, Klasse 1) ein und zeige dann pro Klassenname die Anzahl der Schüler als anzahl, alphabetisch nach Klasse.", `${SCHUELER}\nINSERT INTO schueler VALUES (1, 'Mia', 2), (2, 'Jonas', 2), (3, 'Lea', 1);\nSELECT k.name, COUNT(*) AS anzahl\nFROM schueler s\nJOIN klassen k ON s.klasse_id = k.id\nGROUP BY k.name\nORDER BY k.name;`, 'Anlegen, füllen und mit JOIN und GROUP BY auswerten: der ganze Weg.', 'Erst CREATE TABLE, dann INSERT, dann eine Abfrage mit JOIN klassen und GROUP BY k.name (Lektionen 6 und 7).', `${SCHUELER}\nINSERT INTO schueler VALUES (1, 'Mia', 2), (2, 'Jonas', 2), (3, 'Lea', 1);\nSELECT klasse_id, COUNT(*) AS anzahl FROM schueler GROUP BY klasse_id;`, { starter: `${SCHUELER}\n` }),
		summary(
			['CREATE TABLE legt eine Tabelle mit Spalten und Datentypen an.', 'Primärschlüssel machen Zeilen eindeutig, Fremdschlüssel verbinden Tabellen.', 'INSERT fügt ein, UPDATE ändert, DELETE löscht.', 'UPDATE und DELETE immer mit WHERE.'],
			'Jede App beginnt mit diesem Schritt: Bevor es Nutzer, Bestellungen oder Nachrichten gibt, legt jemand die Tabellen und ihre Beziehungen fest. Ein guter Entwurf erspart später viel Ärger.'
		)
	],
	done: {
		sub: 'Du kannst jetzt eine eigene Datenbank entwerfen, füllen und pflegen.',
		points: ['CREATE TABLE legt Tabellen an.', 'Primär- und Fremdschlüssel verbinden Tabellen.', 'INSERT, UPDATE und DELETE pflegen die Daten.']
	}
};
