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
