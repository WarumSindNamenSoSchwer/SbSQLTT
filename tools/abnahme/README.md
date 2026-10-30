# Abnahme (Browser, über die echte Oberfläche)

Laufen mit dem lokalen Screenshot-Werkzeug `~/.jcode/scratch/onb/shoot` (WebKit, nicht im Repo).
Zugangsdaten des Testkontos aus `~/.jcode/scratch/testkonto.json` (nicht im Repo).

| Skript | Wogegen | Prüft |
|---|---|---|
| `e2e.mjs` | live (app.tabulasql.de) | Beitritt, Fehler in Übung, Lehrkraft sieht Name/Abfrage, Einmal-Code, Passwort zurücksetzen, Entfernen (15 Prüfungen) |
| `app-e2e.mjs` | live | Testanleitung über alte www-Adressen, Fortschritt-Umzug www nach app (18) |
| `app-e2e2.mjs` | live | alte Mail-Links, Abmelden, Anker, Quiz-Link, Kanten (11) |
| `ext-check.mjs` | live oder lokal | keine Anfragen an fremde Server auf 12 Seiten |
| `local-e2e.mjs` | lokal (`tools/dev-stack.sh start`) | Registrierung mit Wiederherstellungscode, Klasse anlegen, kompletter Ablauf (13) |
| `quiz-e2e.mjs` | lokal | Live-Quiz: Beamer + Handy über /quiz/PIN, Antwort mit Punkten |

## Testanleitung (PDF für Lehrkräfte)
`shots.mjs teacher|student|register` und `quiz-shots.mjs` machen die Bilder am Live-System (Testkonto),
`build-doc.mjs` baut daraus `anleitung.html`, `topdf` (Swift, im Scratch-Ordner) druckt das PDF.
Stand 30.10.2026: Bilder im Design v12.

## Anforderungen und Prüfung (Redesign v12, 30.10.2026)

| Anforderung | Prüfung | Ergebnis live |
|---|---|---|
| Neues Aussehen übernommen | `anforderungen.mjs` R1.1-R1.6 (Merkmale aus dem Entwurf) + Screenshot-Vergleich hell/dunkel | 6/6 |
| Alle Funktionen bleiben | `e2e.mjs` (15), `app-e2e.mjs` (18), `app-e2e2.mjs` (11), lokal `local-e2e.mjs` (13), `quiz-e2e.mjs` | alle grün |
| Keine falschen Aussagen | R3.1-R3.3 (kein Konto, Klassencode-Format, Datenschutz vollständig) | 3/3 |
| Keine fremden Server | `ext-check.mjs` 12 Seiten, Build-Suche nach googleapis/unpkg/cdnjs | 12/12 ohne fremde Hosts |
| Anleitung bleibt gültig | R5.1-R5.4 (Bedienelemente vorhanden) + `e2e.mjs` | 4/4 |
| Handy 390 px hell+dunkel | R6 (31 Seiten inkl. Lehrerbereich) kein seitliches Überlaufen | 31/31 |
| Barrierefreiheit | R7 Labels an allen Feldern (Login, Beitreten, Kontakt), :focus-visible | 5/5 |
| Datenschutz Speicher | R8 nach Browsen kein localStorage, kein Cookie | 1/1 |
