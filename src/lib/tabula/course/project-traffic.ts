import { ex, explain, summary, type Lesson } from './types.ts';
import { TRAFFIC_SEED } from './traffic-data.ts';

// Hinweis: Diese Lektion verwendet den Datensatz app-traffic.db.
// Zeitraum: 2026-01-05 bis 2026-02-15, stündlich, zwei Server.
// Geschichte: Nutzerwachstum, v2.4 verschlechtert Antwortzeit massiv.

export const projectTraffic: Lesson = {
	id: 'project',
	track: 'python',
	trackLabel: 'PYTHON & DATEN',
	no: 11,
	of: 11,
	title: 'Muss der Server wachsen?',
	db: { name: 'app-traffic.db', seed: TRAFFIC_SEED, mainTable: 'traffic' },
	steps: [
		explain(
			'Das Problem',
			[
				'Du arbeitest als Analyst für eine App. Die Nutzerzahlen steigen jede Woche, und der Betreiber fragt: Müssen wir einen zweiten Server hinzufügen, oder reicht ein Update der Anwendung?',
				'Deine Datenbank enthält drei Tabellen: traffic speichert stündliche Messungen (Zeitstempel ts, aktive Nutzer users, Antwortzeit avg_ms, Fehlerzahl errors, Server-ID server_id). servers beschreibt jeden Server (id, name, region, max_users). releases listet alle Software-Releases (id, version, released_at, note).',
				'In dieser Lektion analysierst du sechs Wochen echte Betriebsdaten mit SQL. Am Ende begründest du, ob ein Load Balancer (mehr Server) oder ein App-Rework (Code-Verbesserung) die richtige Entscheidung ist.'
			],
			"SELECT * FROM traffic LIMIT 3;"
		),
		{
			kind: 'example',
			name: 'Erste Zeilen',
			type: 'Beispiel',
			task: 'So sehen die Rohdaten aus.',
			taskSub: 'Führe die Abfrage aus. Jede Zeile ist eine Stundenmessung von einem der beiden Server.',
			code: 'SELECT ts, users, avg_ms, errors, server_id\nFROM traffic\nLIMIT 5;',
			msg: (r) => `Die Tabelle traffic hat ${r.rows.length} sichtbare Zeilen. Jeder Zeitstempel erscheint zweimal, einmal pro Server.`,
			sub: 'Schau dir das Schema links an: drei Tabellen, verbunden über server_id.'
		},
		ex(
			'Überblick',
			'Wie viele Messungen gibt es und welchen Zeitraum decken sie ab?',
			'Berechne die Gesamtzahl der Zeilen als messungen, den frühesten Zeitstempel als von und den spätesten als bis. Tabelle: traffic.',
			"SELECT COUNT(*) AS messungen, MIN(ts) AS von, MAX(ts) AS bis\nFROM traffic;",
			'2016 Messungen: zwei Server, 1008 Stunden (6 Wochen).',
			'COUNT(*) zählt alle Zeilen, MIN und MAX liefern Anfang und Ende.',
			"SELECT COUNT(*) AS messungen FROM traffic;"
		),
		ex(
			'Server kennenlernen',
			'Welche Server gibt es und wie viele Nutzer halten sie aus?',
			'Zeige id, name, region und max_users aus servers, sortiert nach id.',
			"SELECT id, name, region, max_users\nFROM servers\nORDER BY id;",
			'Server 1 fasst 70 Nutzer gleichzeitig, Server 2 nur 55.',
			'Alle vier Spalten aus servers, ORDER BY id.',
			"SELECT id, name FROM servers;"
		),
		ex(
			'Spitzenstunden',
			'Wann war Server 1 am stärksten ausgelastet?',
			'Zeige ts, users und avg_ms der fünf Stunden mit den meisten Nutzern auf server_id = 1. Stärkste zuerst.',
			"SELECT ts, users, avg_ms\nFROM traffic\nWHERE server_id = 1\nORDER BY users DESC\nLIMIT 5;",
			'Der Abend-Peak liegt bei 67 Nutzern, also fast am Limit von 70.',
			'WHERE server_id = 1, dann ORDER BY users DESC, dann LIMIT 5.',
			"SELECT ts, users, avg_ms FROM traffic WHERE server_id = 2 ORDER BY users DESC LIMIT 5;"
		),
		ex(
			'Tagesprofil',
			'Wann ist die App am stärksten besucht?',
			'Berechne je Stunde des Tages (0–23) den Durchschnitt der Nutzerzahl als avg_users. Extrahiere die Stunde mit SUBSTR(ts, 12, 2) und wandle sie mit CAST(… AS INTEGER) um. Sortiere nach stunde.',
			"SELECT CAST(SUBSTR(ts, 12, 2) AS INTEGER) AS stunde,\n       ROUND(AVG(users)) AS avg_users\nFROM traffic\nGROUP BY SUBSTR(ts, 12, 2)\nORDER BY stunde;",
			'Der Peak liegt um 20 Uhr mit durchschnittlich 49 Nutzern. Die Nacht (0–5 Uhr) liegt bei 1–2 Nutzern.',
			'SUBSTR(ts, 12, 2) schneidet die zwei Stellen für die Stunde aus dem Zeitstempel heraus. CAST … AS INTEGER wandelt den Text in eine Zahl um, damit ORDER BY numerisch sortiert.',
			"SELECT SUBSTR(ts, 12, 2) AS stunde, ROUND(AVG(users)) AS avg_users FROM traffic GROUP BY SUBSTR(ts, 12, 2) ORDER BY stunde;"
		),
		ex(
			'Wochentag vs. Wochenende',
			'Wie unterscheidet sich die Nutzung an Wochentagen und am Wochenende?',
			"Berechne den Durchschnitt der Nutzerzahl als avg_users, aufgeteilt nach Wochentag (Wochentag / Wochenende). Nutze strftime('%w', ts): 0 = Sonntag, 6 = Samstag. Sortiere nach typ.",
			"SELECT CASE WHEN strftime('%w', ts) IN ('0','6') THEN 'Wochenende'\n            ELSE 'Wochentag' END AS typ,\n       ROUND(AVG(users)) AS avg_users\nFROM traffic\nGROUP BY typ\nORDER BY typ;",
			'Wochentags im Schnitt 29 Nutzer, am Wochenende nur 20. Das Wochenende läuft mit 70 % der Wochentag-Last.',
			"strftime('%w', ts) liefert den Wochentag als Zahl. 0 und 6 sind So/Sa. Im CASE mit IN ('0','6') prüfst du beide auf einmal.",
			"SELECT CASE WHEN strftime('%w', ts) IN ('0','6') THEN 'Wochenende' ELSE 'Wochentag' END AS typ, ROUND(AVG(users)) AS avg_users FROM traffic WHERE server_id = 1 GROUP BY typ ORDER BY typ;"
		),
		ex(
			'Wochentrend',
			'Wächst die Nutzerzahl von Woche zu Woche?',
			"Berechne je Woche (0 bis 5) den Durchschnitt der Nutzerzahl als avg_users, nur für server_id = 1. Berechne die Woche mit CAST((JULIANDAY(ts) - JULIANDAY('2026-01-05')) / 7 AS INTEGER). Sortiere nach woche.",
			"SELECT CAST((JULIANDAY(ts) - JULIANDAY('2026-01-05')) / 7 AS INTEGER) AS woche,\n       ROUND(AVG(users)) AS avg_users\nFROM traffic\nWHERE server_id = 1\nGROUP BY woche\nORDER BY woche;",
			'Von Woche 0 (27 Nutzer) bis Woche 5 (31 Nutzer): +15 % Wachstum in sechs Wochen.',
			"JULIANDAY berechnet eine fortlaufende Tagesnummer. Der Ausdruck in Klammern teilt die vergangenen Tage durch 7, CAST schneidet auf die ganze Zahl.",
			"SELECT CAST((JULIANDAY(ts) - JULIANDAY('2026-01-05')) / 7 AS INTEGER) AS woche, ROUND(AVG(users)) AS avg_users FROM traffic GROUP BY woche ORDER BY woche;"
		),
		ex(
			'Serverauslastung',
			'Wie ausgelastet sind die Server im Schnitt?',
			'Berechne je Server den Durchschnitt der Auslastung in Prozent als auslastung_pct (users * 100.0 / max_users, gerundet auf eine Stelle). Verbinde traffic und servers über server_id. Stärkste Auslastung zuerst.',
			"SELECT s.name,\n       ROUND(AVG(t.users * 100.0 / s.max_users), 1) AS auslastung_pct\nFROM traffic t\nJOIN servers s ON t.server_id = s.id\nGROUP BY s.id\nORDER BY auslastung_pct DESC;",
			'Server eu-central-1 ist mit 43.2 % im Schnitt leicht stärker ausgelastet als eu-west-1 (41.6 %). Im Peak nähern sich beide dem Limit.',
			'JOIN servers s ON t.server_id = s.id. Die Auslastung ist users * 100.0 / max_users – die 100.0 erzwingt eine Dezimalrechnung.',
			"SELECT s.name, ROUND(AVG(t.users * 100.0 / s.max_users), 1) AS auslastung_pct FROM traffic t JOIN servers s ON t.server_id = s.id GROUP BY s.id ORDER BY s.id;"
		),
		ex(
			'Langsame Stunden',
			'Wie viele Stunden war die App zu langsam?',
			'Zähle alle Zeilen mit avg_ms > 300 als langsame_stunden und berechne die mittlere Antwortzeit dieser Stunden als mittlere_ms (gerundet).',
			"SELECT COUNT(*) AS langsame_stunden,\n       ROUND(AVG(avg_ms)) AS mittlere_ms\nFROM traffic\nWHERE avg_ms > 300;",
			'432 von 2016 Stunden lagen über 300 ms, mit im Schnitt 391 ms.',
			'WHERE avg_ms > 300 filtert die langsamen Stunden. COUNT(*) zählt sie, AVG(avg_ms) berechnet den Schnitt.',
			"SELECT COUNT(*) AS langsame_stunden, ROUND(AVG(avg_ms)) AS mittlere_ms FROM traffic WHERE avg_ms > 200;"
		),
		ex(
			'Release-Wirkung',
			'Hat ein Release die Antwortzeit verändert?',
			'Zeige je Release version, die Anzahl der Messungen als messungen, die mittlere Antwortzeit als avg_ms und die mittlere Nutzerzahl als avg_users. Verbinde traffic und releases: eine Messung gehört zum letzten Release, dessen released_at nicht nach ts liegt (t.ts >= r.released_at). Gruppiere nach r.id, sortiere nach released_at.',
			"SELECT r.version,\n       COUNT(t.ts) AS messungen,\n       ROUND(AVG(t.avg_ms)) AS avg_ms,\n       ROUND(AVG(t.users)) AS avg_users\nFROM releases r\nLEFT JOIN traffic t ON t.ts >= r.released_at\n  AND (t.ts < (SELECT r2.released_at FROM releases r2 WHERE r2.id = r.id + 1)\n       OR r.id = (SELECT MAX(id) FROM releases))\nGROUP BY r.id\nORDER BY r.released_at;",
			'v2.4 hat bei ähnlicher Last (27 Nutzer) eine mittlere Antwortzeit von 391 ms, alle anderen unter 100 ms. Das ist kein Last-Problem.',
			"Die innere Unterabfrage (SELECT r2.released_at …) findet den Start des nächsten Releases. Ohne diese Bedingung würden alle Messungen nach v2.2 zu v2.2 gezählt.",
			"SELECT r.version, COUNT(t.ts) AS messungen, ROUND(AVG(t.avg_ms)) AS avg_ms, ROUND(AVG(t.users)) AS avg_users FROM releases r LEFT JOIN traffic t ON t.ts >= r.released_at GROUP BY r.id ORDER BY r.released_at;"
		),
		ex(
			'Gleiche Last, andere Zeit',
			'Wie viel langsamer ist die App nach v2.4, wenn man die gleiche Last vergleicht?',
			"Berechne den Durchschnitt von avg_ms als avg_ms, aufgeteilt in zwei Phasen: Zeilen mit ts < '2026-01-26 00:00' heißen 'vor v2.4', alle anderen 'nach v2.4'. Filtere nur Stunden mit users BETWEEN 20 AND 40 (gleiche Last). Sortiere nach phase.",
			"SELECT CASE WHEN ts < '2026-01-26 00:00' THEN 'vor v2.4'\n            ELSE 'nach v2.4' END AS phase,\n       ROUND(AVG(avg_ms)) AS avg_ms\nFROM traffic\nWHERE users BETWEEN 20 AND 40\nGROUP BY phase\nORDER BY phase;",
			'Bei 20–40 gleichzeitigen Nutzern: 303 ms nach v2.4, nur 101 ms davor. Faktor 3: Der Unterschied kommt vom Code, nicht von der Last.',
			"CASE WHEN ts < '2026-01-26 00:00' teilt die Zeitreihe am Release-Datum. BETWEEN 20 AND 40 schränkt auf vergleichbare Lastbereiche ein.",
			"SELECT CASE WHEN ts < '2026-01-26 00:00' THEN 'vor v2.4' ELSE 'nach v2.4' END AS phase, ROUND(AVG(avg_ms)) AS avg_ms FROM traffic GROUP BY phase ORDER BY phase;"
		),
		ex(
			'Überlastete Stunden',
			'Wie oft näherten sich die Server ihrem Limit?',
			'Zähle pro Server die Stunden, in denen users * 100.0 / max_users mehr als 85 % beträgt, als ueberlastet. Verbinde traffic und servers. Zeige s.name und ueberlastet, stärkste Auslastung zuerst.',
			"SELECT s.name, COUNT(*) AS ueberlastet\nFROM traffic t\nJOIN servers s ON t.server_id = s.id\nWHERE t.users * 100.0 / s.max_users > 85\nGROUP BY t.server_id\nORDER BY ueberlastet DESC;",
			'eu-central-1 war 60 Stunden über 85 %, eu-west-1 nur 39 Stunden. Der kleinere Server ist häufiger überlastet.',
			'Die Bedingung lautet t.users * 100.0 / s.max_users > 85. Das funktioniert erst nach dem JOIN, wenn max_users bekannt ist.',
			"SELECT s.name, COUNT(*) AS ueberlastet FROM traffic t JOIN servers s ON t.server_id = s.id WHERE t.users * 100.0 / s.max_users > 90 GROUP BY t.server_id ORDER BY ueberlastet DESC;"
		),
		ex(
			'Fehlerrate nach v2.4',
			'Wie viele Stunden traten Fehler auf, und auf welchem Server?',
			"Zähle je Server die Stunden mit errors > 0 als stunden_mit_fehlern und den Durchschnitt der Fehlerzahl als avg_fehler (gerundet). Nur Messungen ab '2026-01-26 00:00'. Verbinde traffic und servers. Stärkste zuerst.",
			"SELECT s.name,\n       COUNT(*) AS stunden_mit_fehlern,\n       ROUND(AVG(t.errors)) AS avg_fehler\nFROM traffic t\nJOIN servers s ON t.server_id = s.id\nWHERE t.errors > 0\n  AND t.ts >= '2026-01-26 00:00'\nGROUP BY t.server_id\nORDER BY stunden_mit_fehlern DESC;",
			'eu-west-1: 259 Stunden mit Fehlern, eu-central-1: 234. Beide Server zeigen das Problem. Es liegt am Code, nicht am einzelnen Server.',
			"WHERE t.errors > 0 filtert Stunden ohne Fehler aus. AND t.ts >= '2026-01-26 00:00' begrenzt auf die Zeit nach v2.4.",
			"SELECT s.name, COUNT(*) AS stunden_mit_fehlern, ROUND(AVG(t.errors)) AS avg_fehler FROM traffic t JOIN servers s ON t.server_id = s.id WHERE t.errors > 0 GROUP BY t.server_id ORDER BY stunden_mit_fehlern DESC;"
		),
		ex(
			'Wachstumsprognose',
			'Wie schnell wachsen die Nutzerzahlen, und wie lange reicht die Kapazität?',
			'Berechne das Gesamtwachstum (max minus min der Wochendurchschnitte) als gesamtwachstum und den Zuwachs pro Woche als zuwachs_pro_woche (gerundet auf eine Stelle). Nur server_id = 1. Nutze eine Unterabfrage: zuerst die Wochendurchschnitte berechnen (wie in „Wochentrend"), dann MAX und MIN davon nehmen.',
			"SELECT\n  MAX(avg_users) - MIN(avg_users) AS gesamtwachstum,\n  ROUND((MAX(avg_users) - MIN(avg_users)) * 1.0 / (MAX(woche) - MIN(woche)), 1) AS zuwachs_pro_woche\nFROM (\n  SELECT CAST((JULIANDAY(ts) - JULIANDAY('2026-01-05')) / 7 AS INTEGER) AS woche,\n         ROUND(AVG(users)) AS avg_users\n  FROM traffic WHERE server_id = 1\n  GROUP BY woche\n);",
			'4 Nutzer Gesamtwachstum in 5 Wochen, also 0.8 Nutzer pro Woche. Server 1 fasst 70 Nutzer. Bei 31 aktuell und 0.8/Woche sind das rechnerisch noch ~49 Wochen bis zum Limit.',
			'Die innere Abfrage ist dieselbe wie in „Wochentrend". In der äußeren Abfrage rechnest du MAX - MIN für das Gesamtwachstum, geteilt durch MAX(woche) - MIN(woche) für den Wochenschnitt.',
			"SELECT MAX(avg_users) - MIN(avg_users) AS gesamtwachstum, ROUND((MAX(avg_users) - MIN(avg_users)) * 1.0 / (MAX(woche) - MIN(woche)), 1) AS zuwachs_pro_woche FROM (SELECT CAST((JULIANDAY(ts) - JULIANDAY('2026-01-05')) / 7 AS INTEGER) AS woche, ROUND(AVG(users)) AS avg_users FROM traffic WHERE server_id = 2 GROUP BY woche);"
		),
		{
			kind: 'explain',
			name: 'Entscheidung',
			type: 'Erklärung',
			title: 'Load Balancer oder App-Rework?',
			paras: [
				'Die Daten zeigen zwei Probleme mit unterschiedlicher Ursache. Erstens: Die Antwortzeit hat sich mit v2.4 verdreifacht (101 ms auf 303 ms), auch bei identischer Last. Das ist kein Kapazitätsproblem, mehr Server würden daran nichts ändern. Die Ursache liegt im Code der Migration.',
				'Zweitens: eu-central-1 war 60 Stunden über 85 % Auslastung. Ein zweiter Server (Load Balancer) würde die Last verteilen und diese Spitzen abpuffern. Das ist aber ein separates, langfristiges Problem.',
				'Fazit: Kurzfristig ist App-Rework dringend (v2.4 rückgängig machen oder fixen), weil der Fehler jede Abfrage betrifft. Langfristig empfiehlt sich ein zweiter Server für eu-central-1, aber erst nach dem Fix, damit der neue Server nicht genauso langsam ist.'
			],
			example: "SELECT 'App-Rework' AS massnahme, 'dringend' AS prioritaet\nUNION ALL\nSELECT 'Load Balancer (eu-central)', 'mittel';"
		},
		summary(
			[
				'Tagesrhythmus und Wochenende sind gut sichtbar im Tagesprofil und im CASE-Wochentag-Vergleich.',
				'SUBSTR und CAST extrahieren Teile von Zeitstempeln für GROUP BY.',
				'JULIANDAY berechnet Wochen-Nummern für Trendanalysen.',
				'JOIN mit servers liefert die Kapazität für Auslastungsberechnungen.',
				'Unterabfragen hinter FROM ermöglichen zweistufige Aggregationen (Wochendurchschnitt, dann Wachstum).',
				'Der Vergleich vor/nach Release bei gleicher Last trennt Last-Probleme von Code-Problemen.'
			],
			'Die Datenbank kannst du herunterladen und lokal mit Python analysieren:\n\n```python\nimport sqlite3, pandas as pd, matplotlib.pyplot as plt\n\ncon = sqlite3.connect("app-traffic.db")\ndf = pd.read_sql("SELECT ts, avg_ms, users FROM traffic WHERE server_id=1", con)\ndf["ts"] = pd.to_datetime(df["ts"])\ndf.set_index("ts", inplace=True)\n\ndf["avg_ms"].resample("D").mean().plot(title="Tägliche mittlere Antwortzeit")\nplt.tight_layout(); plt.savefig("avg_ms.png")\nprint(df["users"].resample("W").mean())\n```'
		)
	],
	done: {
		sub: 'Du hast sechs Wochen Betriebsdaten analysiert und eine begründete Entscheidung getroffen.',
		points: [
			'SUBSTR und JULIANDAY erschließen Zeitstempel für GROUP BY.',
			'Unterabfragen hinter FROM ermöglichen mehrstufige Aggregationen.',
			'Vor/Nach-Vergleiche bei gleicher Last trennen Code- von Last-Problemen.',
			'SQL-Ergebnisse liefern die Zahlen für Architektur-Entscheidungen.'
		]
	}
};
