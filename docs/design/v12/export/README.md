# Tabula: Export ohne externe Server

Reines HTML + CSS + kleines Vanilla-JS pro Seite. Kein Framework, kein CDN.

## Dateien

| Seite | Route | HTML | CSS | JS |
|---|---|---|---|---|
| Startseite | www `/` | `index.html` | `css/landing.css` | `js/landing.js` |
| Lernen | app `/learn` | `learn.html` | `css/learn.css` | `js/learn.js` |
| Lektion (Studio) | app `/learn/beginner/where-filters` | `studio.html` | `css/studio.css` | `js/studio.js` |
| Datensätze | www `/datasets` | `datasets.html` | `css/datasets.css` | `js/datasets.js` |

Gemeinsam: `css/fonts.css`, `js/tb-render.js` (Template-Renderer, ca. 150 Zeilen), `js/tabula-core.js` (SQL, Prüfung, Highlighting, Edgar), `js/owl-gen.js` (Edgar), `js/tabula-datasets.js` (Seeds Schule und App-Traffic).

Das Markup jeder Seite steht lesbar in `<script type="text/template" id="tb-tpl">`. Syntax: `{{ wert }}`, `<sc-for list="{{ xs }}" as="x">` (Svelte: `{#each}`), `<sc-if value="{{ b }}">` (Svelte: `{#if}`). Hover-Zustände stehen als `[data-hv="n"]:hover` in der Seiten-CSS.

`vorschau-*.html` sind Kopien mit relativen Pfaden, nur zum Ansehen im Projekt. Nicht ausliefern.

## Noch zu ergänzen

- `/sql/sql-wasm.js` fehlt (im Repo liegt nur `sql-wasm.wasm`). Aus `node_modules/sql.js/dist/sql-wasm.js` kopieren. Ohne die Datei zeigen Studio und Datensätze „Datenbank konnte nicht geladen werden“.
- Schriften: vorhanden sind IBM Plex Sans 400/500/600 und Plex Mono 400 (`fonts/`). Es fehlen `ibm-plex-sans-700.woff2`, `ibm-plex-mono-500.woff2`, `ibm-plex-mono-600.woff2` (z. B. aus `@fontsource/ibm-plex-sans` und `@fontsource/ibm-plex-mono`).
- `/favicon.svg` wird referenziert.

## Externe Adressen

Nur klickbare Links: `https://app.tabulasql.de/...` (von der Website zur App), `https://www.tabulasql.de/...` (von der App zur Website), GitHub. Edgars SVG enthält den Namespace `http://www.w3.org/2000/svg`; das ist kein Abruf.

## Geänderte Texte

**Startseite**
- Datenschutz, Einleitung: „Keine Werbung, kein Tracking. Tabula läuft auf Servern von Hetzner in Deutschland oder auf Wunsch direkt an Ihrer Schule.“ → „Keine Werbung, kein Tracking, keine Analyse-Tools. Tabula läuft auf Servern von Hetzner im Rechenzentrum Nürnberg.“
- Datenschutz, Schüler: „Benutzername, Anzeigename, Klasse und Lernfortschritt. …“ → „Kein Konto. Name und Passwort bleiben auf dem Gerät. Der Server kennt nur eine Nummer und den Lernfortschritt. Den Namen kann nur die eigene Lehrkraft lesen.“
- Datenschutz, Hinweis: „Lehrkräfte und Schüler können ihre Daten jederzeit löschen. Zum Ausprobieren braucht es gar kein Konto.“ → „Lehrkräfte können ihr Konto jederzeit löschen, Schüler können ihre Klasse jederzeit verlassen. Zum Ausprobieren braucht es gar keine Anmeldung.“
- Kurzblock Lehrkräfte, Datenschutz: „Server in Deutschland oder direkt an Ihrer Schule. Kein Tracking.“ → „Server in Deutschland (Hetzner, Nürnberg). Kein Tracking.“
- Karte „Eigener Server möglich“ → „Offen und prüfbar: Der gesamte Quellcode liegt auf GitHub, jede Datenschutzaussage lässt sich nachprüfen.“
- Klasse verbinden: „… mit einem sechsstelligen Code bei. …“ → „Schüler treten mit einem Klassencode wie sonne-apfel-kugel-33 bei oder scannen den QR-Code am Beamer. Ohne Installation, auf jedem Schulrechner.“
- Mockup: „ABC123“ → „sonne-apfel-kugel-33“, „tabulasql.de/join“ → „app.tabulasql.de/beitreten“ (Kachel breiter, Schrift kleiner).
- FAQ „Brauchen Schüler ein Konto?“ → „Nein. Zum Ausprobieren braucht es gar keine Anmeldung. Im Unterricht treten Schüler mit dem Klassencode bei und wählen selbst Name und Passwort. Ein Konto mit E-Mail gibt es für Schüler nicht.“
- FAQ „Muss die Schule etwas installieren?“ → „Nein. Tabula läuft im Browser.“
- FAQ „Wo liegen die Daten?“: „… (Hetzner) oder auf dem Server Ihrer Schule.“ → „… (Hetzner, Nürnberg).“
- FAQ „Wie bekomme ich eine Demo?“: „Schreiben Sie eine kurze E-Mail an kontakt@tabulasql.de.“ → „Schreiben Sie uns über die Kontaktseite.“
- Kontaktbereich: neuer Link „Klasse beitreten“ neben „Demo anfragen“.

**Lernen und Studio**
- Gast-Hinweis „… Anmelden / Melde dich an, um ihn zu sichern.“ → „Fortschritt wird nur in diesem Browser gespeichert. Mit dem Klassencode deiner Lehrkraft kannst du einer Klasse beitreten.“ (Link auf `/beitreten`)

**Links (alle Seiten)**
- Lernen `/learn`, Lektion `/learn/beginner/where-filters`, nächste Lektion `/learn/beginner/order-limit`, Datensätze `/datasets`, Anmelden `/login`, Lehrer-Konto `/login?rolle=lehrkraft`, Beitreten `/beitreten`, Impressum `/impressum`, Datenschutz `/datenschutz`, Demo anfragen und Kontakt `/kontakt`, Für Lehrkräfte `/#lehrkraefte`.
