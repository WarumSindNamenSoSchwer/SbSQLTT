// Lektion 10: Daten mit Python und pandas auswerten
// Statische Inhalte fuer /learn/python/python

export interface CheckItem {
	label: string;
}

export interface PythonStep {
	id: string;
	name: string;
	stepLabel: string;
	title: string;
	intro: string;
	filename: string;
	code: string;
	expectedOutput: string;
	expectedNote: string;
	checklist: string[];
	installTip?: boolean;
	downloadCard?: boolean;
}

export const PYTHON_STEPS: PythonStep[] = [
	{
		id: 'install',
		name: 'Python installieren',
		stepLabel: 'SCHRITT 1 · VORBEREITUNG',
		title: 'Python und pandas installieren',
		intro:
			'Bevor du loslegen kannst, brauchst du Python und zwei Bibliotheken. Fuhre den folgenden Befehl im Terminal aus. Unter Windows heisst das Programm "Eingabeaufforderung" oder "PowerShell", unter macOS "Terminal".',
		filename: 'Terminal',
		code: `pip install pandas matplotlib`,
		expectedOutput: `Successfully installed pandas matplotlib`,
		expectedNote:
			'Die genaue Ausgabe variiert je nach Version. Wichtig ist, dass kein Fehler erscheint.',
		checklist: [
			'Python ist installiert (python --version zeigt eine Versionsnummer)',
			'pip install pandas matplotlib lief ohne Fehler durch',
			'Du hast einen Ordner angelegt, in dem du die Dateien speicherst'
		],
		installTip: true
	},
	{
		id: 'first-script',
		name: 'Erste Abfrage',
		stepLabel: 'SCHRITT 2 · DIE DATEN IN PYTHON OFFNEN',
		title: 'Deine Datenbank in pandas',
		intro:
			'Lade die Datenbank herunter und lege sie im selben Ordner wie dein Skript ab. Das Skript offnet die Datei mit sqlite3 und ladt die Tabelle in einen pandas DataFrame.',
		filename: 'auswertung.py',
		code: `import sqlite3
import pandas as pd

con = sqlite3.connect("bibliothek.db")
df = pd.read_sql("SELECT * FROM books", con)
print(df["year"].mean())`,
		expectedOutput: `2015.5666666666666`,
		expectedNote:
			'Das ist der Durchschnitt der Erscheinungsjahre aller Bucher. Siehst du dieselbe Zahl, hat alles geklappt.',
		checklist: [
			'bibliothek.db liegt im selben Ordner wie das Skript',
			'Das Skript lauft ohne Fehlermeldung',
			'Die Ausgabe zeigt 2015.57 oder ahnlich'
		],
		downloadCard: true,
		installTip: false
	},
	{
		id: 'join-groupby',
		name: 'JOIN und groupby',
		stepLabel: 'SCHRITT 3 · TABELLEN VERBINDEN',
		title: 'Verlage und Bucher zusammenfuhren',
		intro:
			'In SQL verbindest du Tabellen mit JOIN. In pandas gibt es dafur merge(). Danach gruppierst du mit groupby() und zahlst, wie viele Bucher jeder Verlag hat.',
		filename: 'verlage.py',
		code: `import sqlite3
import pandas as pd

con = sqlite3.connect("bibliothek.db")
books = pd.read_sql("SELECT * FROM books", con)
publishers = pd.read_sql("SELECT * FROM publishers", con)

df = books.merge(publishers, left_on="publisher_id", right_on="id",
                 suffixes=("", "_pub"))
result = df.groupby("name")["id"].count().reset_index()
result.columns = ["Verlag", "Anzahl"]
result = result.sort_values("Anzahl", ascending=False)
print(result.to_string(index=False))`,
		expectedOutput: `           Verlag  Anzahl
 Nordlicht Verlag       9
   Kranich Verlag       8
   O'Reilly Media       5
   Addison-Wesley       4
Leuchtturm Comics       4`,
		expectedNote:
			'Jede Zeile zeigt einen Verlag und die Anzahl seiner Bucher in der Bibliothek.',
		checklist: [
			'Du hast verstanden, wie merge() einen SQL-JOIN nachbaut',
			'Du hast verstanden, was groupby().count() macht',
			'Die Ausgabe stimmt mit der erwarteten Tabelle uberein'
		]
	},
	{
		id: 'matplotlib',
		name: 'Diagramm erstellen',
		stepLabel: 'SCHRITT 4 · VISUALISIERUNG',
		title: 'Bucher pro Genre als Balkendiagramm',
		intro:
			'Zahlen in einem Diagramm sind leichter zu verstehen als eine Tabelle. Mit matplotlib erstellst du ein Balkendiagramm und speicherst es als PNG-Datei.',
		filename: 'genre_chart.py',
		code: `import sqlite3
import pandas as pd
import matplotlib.pyplot as plt

con = sqlite3.connect("bibliothek.db")
df = pd.read_sql(
    "SELECT genre, COUNT(*) AS anzahl "
    "FROM books GROUP BY genre ORDER BY anzahl DESC",
    con)

plt.figure(figsize=(8, 5))
plt.bar(df["genre"], df["anzahl"], color="#3b82f6")
plt.title("Buecher pro Genre")
plt.xlabel("Genre")
plt.ylabel("Anzahl")
plt.tight_layout()
plt.savefig("buecher_genre.png")
print("Diagramm gespeichert: buecher_genre.png")
print(df.to_string(index=False))`,
		expectedOutput: `Diagramm gespeichert: buecher_genre.png
     genre  anzahl
Informatik      10
     Roman       6
  Sachbuch       5
     Krimi       5
     Comic       4`,
		expectedNote:
			'Im selben Ordner sollte jetzt eine Datei buecher_genre.png liegen. Offne sie, um das Diagramm zu sehen.',
		checklist: [
			'Das Skript lauft ohne Fehler durch',
			'Die Datei buecher_genre.png wurde erstellt',
			'Das Balkendiagramm zeigt die fuenf Genres mit ihren Zahlen'
		]
	},
	{
		id: 'own-question',
		name: 'Eigene Frage',
		stepLabel: 'SCHRITT 5 · DEINE ANALYSE',
		title: 'Welche Klasse leiht am meisten aus?',
		intro:
			'Jetzt bist du dran. Das Skript beantwortet eine eigene Frage an die Datenbank: Welche Klasse hat die meisten Ausleihvorgange? Passe es danach nach Belieben an.',
		filename: 'klassen_chart.py',
		code: `import sqlite3
import pandas as pd
import matplotlib.pyplot as plt

con = sqlite3.connect("bibliothek.db")
df = pd.read_sql(
    "SELECT class, COUNT(*) AS ausleihen "
    "FROM loans GROUP BY class ORDER BY ausleihen DESC",
    con)

plt.figure(figsize=(7, 4))
plt.bar(df["class"], df["ausleihen"], color="#3b82f6")
plt.title("Ausleihen pro Klasse")
plt.xlabel("Klasse")
plt.ylabel("Anzahl Ausleihen")
plt.tight_layout()
plt.savefig("ausleihen_klasse.png")
print("Diagramm gespeichert: ausleihen_klasse.png")
print(df.to_string(index=False))`,
		expectedOutput: `Diagramm gespeichert: ausleihen_klasse.png
class  ausleihen
   Q1         18
   Q2          8
  10a          8
  10b          6`,
		expectedNote: 'Die Q1 hat mit Abstand die meisten Ausleihvorgange.',
		checklist: [
			'Das Skript lauft durch und erzeugt ausleihen_klasse.png',
			'Du verstehst, wie die SQL-Abfrage die Daten auswertet',
			'Du hast eine eigene Frage formuliert und das Skript angepasst'
		]
	}
];

/** Alias fuer die python-Route (erwartet PY_STEPS). */
export const PY_STEPS = PYTHON_STEPS;

export const PYTHON_LESSON = {
	id: 'python',
	no: 10,
	of: 11,
	track: 'python',
	title: 'Daten mit Python und pandas auswerten',
	done: {
		sub: 'Du kannst jetzt SQL-Datenbanken in Python offnen, mit pandas auswerten und Diagramme erstellen.',
		points: [
			'Datenbank mit sqlite3 und pandas in Python geladen',
			'Tabellen mit merge() verbunden und mit groupby() ausgewertet',
			'Ergebnisse mit matplotlib als Diagramm gespeichert',
			'Eigene Frage an die Datenbank formuliert und beantwortet'
		]
	}
};
