# SbSQLTT: Produkt- und Workflow-Spezifikation

Stand: 2026-10-17 · Status: Entwurf zur Abstimmung

Dieses Dokument ist die Grundlage für (1) den Designer und (2) die Umsetzung.
Es beschreibt **was** passiert, nicht **wie es aussieht**.

---

## 1. Ziel und Zielgruppe

- **Zielgruppe:** Gymnasium, Informatik ab Klasse 10 (Wahlfach), plus Lehrkräfte.
- **Ton:** sachlich, wie unter Erwachsenen. Keine Kindersprache, kein Gamification-Kitsch.
- **Kernversprechen:** SQL lernen an realistischen Daten und verstehen, wofür man es in der echten Welt braucht (Datenanalyse → Entscheidungen).
- **Demo-Ziel (Fachschaftssitzung):** Lehrkraft öffnet die Seite, tippt live eine Abfrage, sieht ein echtes Ergebnis, lädt die DB herunter.

## 2. Leitprinzipien fürs Design

1. **Eine Sache pro Bildschirm.** Jeder Screen hat genau eine Hauptaktion.
2. **Ohne Anmeldung loslegen.** Login nur für Fortschritt-Speichern und Klassen.
3. **Realitätsbezug.** Jede Lektion beantwortet „Wozu braucht man das?“.
4. **Schriftgröße bleibt** wie aktuell.
5. Jeder Screen definiert die Zustände: **leer, lädt, Fehler, Erfolg**.

## 3. Technische Eckpunkte

| Thema | Entscheidung |
|---|---|
| SQL im Browser | **SQLite (sql.js, WASM)**, läuft komplett beim Nutzer |
| Python | **nur lokal** auf dem Rechner der Schüler (Jupyter/VS Code), nicht im Browser |
| Datensätze | statische Dateien (`.db`, `.csv`), per Link oder `requests` abrufbar |
| Backend | SvelteKit als Node-Server (`adapter-node`), eigene SQLite-DB für Nutzer/Klassen |
| Auth | eigene Lösung im Container, keine Cloud-Abhängigkeit |
| Hosting | **ein Docker-Image**, Konfiguration per ENV, Speicher per Volume |
| Ziel-Server | eigener Hetzner-Server, später optional **Self-Hosting an Schulen** |
| Abgelöst | Vercel, Supabase (war nie eingebaut) |

Self-Hosting an Schulen: Schule richtet Subdomain auf Container/Port, `docker compose up -d`, Updates per `docker compose pull`. Schülerdaten verlassen die Schule nicht.

## 4. Lehrplan (Track 1, ca. 10 Lektionen)

Datensatz durchgehend: realistisches Schema (ggf. angelehnt an eine echte App, **Daten synthetisch**, keine echten Nutzerdaten).

| # | Lektion | Inhalt |
|---|---|---|
| 1 | Was ist eine Datenbank? | Tabellen, Zeilen, Spalten, erste `SELECT *` |
| 2 | SELECT | Spalten wählen, Aliase |
| 3 | WHERE | Vergleiche, `AND`/`OR`, `LIKE`, `IN` |
| 4 | ORDER BY / LIMIT | Sortieren, Top-N |
| 5 | NULL | fehlende Werte, `IS NULL` |
| 6 | Aggregate | `COUNT`, `SUM`, `AVG`, `MIN`, `MAX` |
| 7 | GROUP BY / HAVING | Gruppieren und Gruppen filtern |
| 8 | JOIN | Tabellen verbinden, `INNER`/`LEFT` |
| 9 | DDL: Eigene DB bauen | `CREATE TABLE`, Datentypen, Primär-/Fremdschlüssel, `INSERT`, `UPDATE`, `DELETE` |
| 10 | Deine DB in Python | DB herunterladen, `sqlite3` lokal, Abfragen aus Python |

**Abschlussprojekt „Muss der Server wachsen?“** (Track 2, Data Science):
Zeitreihen-Datensatz *App-Traffic* (Nutzer/Stunde, Antwortzeit, Fehlerrate, Releases).
Synthetisch mit eingebauter Geschichte: Tagesrhythmus, Wochenende, Wachstum, ein Release verschlechtert die Antwortzeit.
1. SQL: Peaks finden, Schwellwert für langsame Antworten.
2. Python lokal: plotten, Trend, Überlastungszeitpunkt schätzen.
3. Entscheidung begründen: **Load Balancer** (schnell, Architekturumbau) vs. **App-Rework** (teuer, langsam).

Später: Advanced-Track (Subqueries, CTEs, Window Functions, Indizes), Einstieg ML (einfache Classifier, lokal).

## 5. Workflows: Schüler

### 5.1 Einstieg
1. Landing → Button **„Jetzt lernen“** → Lektionsübersicht. Kein Login nötig.
2. Hat die Klasse eine **Fokus-Lektion**: Hinweis-Banner „Deine Klasse arbeitet gerade an: …“ → Klick öffnet sie direkt.
3. Klasse beitreten: Code eingeben oder QR scannen → Name wählen → zurück zur Übersicht.

### 5.2 Lektionsübersicht
- Liste der Lektionen mit Status (offen / begonnen / fertig) und Dauer.
- Klick auf Lektion → Lektion startet beim letzten offenen Schritt.

### 5.3 Lektion
- Schrittweise: **Erklären → Beispiel → Übung → Zusammenfassung**.
- Übung: Aufgabe oben, Editor, Button **„Ausführen“** (+ Strg/⌘+Enter), Ergebnis-Tabelle darunter.
- Zustände Übung:
  - **SQL-Fehler:** verständliche Meldung, Fehlerstelle markiert.
  - **Läuft, aber falsch:** „Ergebnis stimmt noch nicht“ + Unterschied (z. B. zu viele Zeilen).
  - **Richtig:** Bestätigung, Button **„Weiter“**.
  - **Hängt fest:** nach 3 Fehlversuchen Button **„Tipp“**, danach **„Lösung zeigen“**.
- Seitlich/aufklappbar: **Schema-Ansicht** (Tabellen, Spalten).
- Button **„Datenbank herunterladen“** (`.db`) jederzeit verfügbar.

### 5.4 Datensätze
- Seite „Datensätze“: Liste mit Beschreibung, Schema, Download (`.db`, `.csv`), Python-Snippet zum Kopieren.

## 6. Workflows: Lehrkraft

Grundsatz: Der Lehrerbereich ist **eigener Bereich** (eigene Navigation), getrennt vom Lernbereich.

### 6.1 Klassenübersicht (Startseite Lehrkraft)
- Karten je Klasse: Name, Anzahl Schüler, aktuelle Fokus-Lektion, Anzahl „hängt fest“.
- Button **„Neue Klasse“**.

### 6.2 Neue Klasse
- Name eingeben → Klasse erstellt → Beitrittscode + QR wird angezeigt (Vollbild für Beamer).

### 6.3 Klassen-Dashboard (eine Klasse)
- Oben: **Fokus-Lektion** (Auswahl) → Schüler landen direkt dort.
- Hauptbereich: Fortschritt **nur der Fokus-Lektion**: wer fertig, wer dran, wer hängt fest.
- „Hängt fest“ hervorgehoben, Klick zeigt letzte Abfrage + Fehler des Schülers.
- Umschalter **„Alle Lektionen“** → Fortschritts-Matrix (Schüler × Lektionen).

### 6.4 Weitere Seiten
- **Schüler:** Liste, entfernen, umbenennen.
- **Einstellungen der Klasse:** Name, Code neu erzeugen, Klasse archivieren.
- **Profil:** Name, E-Mail, Passwort.
- (Aufgaben-Seite: vorerst ausblenden, später klären.)

## 7. Live-Quiz (Kahoot-artig, Handy)

Zweck: **Handy fürs Quiz, PC zum Arbeiten.** Gibt dem QR-Code einen klaren Sinn.

### 7.1 Fragensätze
- **Automatisch** aus jeder Lektion erzeugt (Standard-Fragensatz pro Lektion).
- **Bearbeitbar:** Lehrkraft kann einen automatischen Satz kopieren und anpassen (Fragen ändern, löschen, umsortieren).
- **Eigene Sätze:** Lehrkraft erstellt komplett eigene Fragensätze.
- Fragetypen:
  - „Was gibt diese Abfrage zurück?“
  - „Welche Abfrage liefert dieses Ergebnis?“
  - „Wo ist der Fehler?“
- Pro Frage: 4 Antworten (1 richtig), Zeitlimit einstellbar (Standard 20 s).

### 7.2 Ablauf Lehrkraft (Beamer)
1. Klassen-Dashboard → **„Quiz starten“** → Fragensatz wählen.
2. Lobby: QR-Code + Code groß, Liste beigetretener Schüler live.
3. **„Los“** → Frage + Countdown, Anzahl Antworten live.
4. Zeit abgelaufen → Auflösung: Verteilung der Antworten, richtige markiert.
5. Zwischenstand (Top 5) → nächste Frage.
6. Ende: Rangliste + **Auswertung**: welche Fragen schlecht liefen → Button **„Als Fokus-Lektion setzen“**.

### 7.3 Ablauf Schüler (Handy oder PC)
1. QR scannen → Anmelden (oder Account anlegen) → automatisch in Klasse + Quiz-Lobby.
2. Frage sehen, Antwort tippen → „Antwort gespeichert“, warten.
3. Nach Auflösung: richtig/falsch + Punkte.
4. Ende: eigener Platz.
- Quiz läuft auch im **PC-Browser** (falls Handys verboten sind).

### 7.4 Account-Sync
- Ein Account für Handy und PC. Beitritt per QR am Handy → am PC mit gleichem Account anmelden → Klasse ist da.
- Folge: **Schüler brauchen echtes Login** (Benutzername + Passwort), nicht nur Name + Code.

### 7.5 Technik
- Echtzeit über **WebSockets** im Node-Container (auch self-hosted).
- Priorität: **nach** Kern (SQLite, Lektionen, Redesign).

## 8. Offene Punkte

- [ ] Schema der echten App von Muri → Basis für Lektionsdatensatz
- [ ] Login-Methode Lehrkraft (E-Mail + Passwort? Magic Link braucht Mailserver)
- [x] Login Schüler: echter Account (wegen Handy/PC-Sync), Beitritt per QR/Code
- [ ] Aufgaben-Seite: behalten oder streichen?
- [ ] Design-Entwürfe vom Designer auf Basis dieses Dokuments
