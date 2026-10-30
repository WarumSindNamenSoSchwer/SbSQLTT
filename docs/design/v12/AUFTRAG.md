# Redesign v12: Arbeitsauftrag für alle Lanes

Repo: /Users/muri/Repos/SbSQLTT (SvelteKit 2, Svelte 5 Runes, statischer Build). Sprache der UI: Deutsch,
Schüler mit "du", Lehrkräfte mit "Sie". Keine Gedankenstriche (—, –) in UI-Texten, keine Semikolons als Ersatz.

## Ziel
Die Seiten bekommen das neue Aussehen aus `docs/design/v12/` (Designer-Lieferung). ALLE bestehenden Funktionen
bleiben erhalten. Wo der Entwurf etwas zeigt, das Tabula nicht kann, wird es weggelassen. Wo der Entwurf etwas
weglässt, das Tabula kann, bleibt es (im neuen Stil). Nur Aussehen und Anordnung ändern sich, keine Logik,
keine API-Aufrufe, keine Datenflüsse.

## Referenzen
- `docs/design/v12/export/` : bereinigte Fassungen (Startseite index.html, learn.html, studio.html, datasets.html,
  CSS in css/, Verhalten in js/). Markup steht in `<script type="text/template" id="tb-tpl">`, Syntax `{{ x }}`,
  `<sc-for>`, `<sc-if>`. Hover als `[data-hv="n"]:hover` in der Seiten-CSS.
- `docs/design/v12/Tabula *.dc.html` : Entwürfe für Konto, Lehrerbereich, Quiz, Python-Lektion, Systemseiten
  (React-Prototyp, Markup in `<x-dc>`, Logik in `<script data-dc-script>`). Nur als Vorlage für Aussehen lesen.
  Lokal ansehen: `cd docs/design/v12 && python3 -m http.server 8770` (lädt Google Fonts/unpkg, nur zum Ansehen ok).
- Tokens: `src/lib/tabula/theme.css` (Klasse `.tb`, hell/dunkel über `html.light`). Die Design-Tokens
  (--bg, --surface, --subtle, --line, --ink, --ink-2, --ink-3, --accent ...) sind dort schon identisch.
  Die Kopfleiste `src/lib/tabula/TopNav.svelte` ist schon im neuen Stil, nicht ändern.

## Harte Regeln
1. Keine externen Server: keine Google Fonts, kein CDN, keine Bilder/Skripte von fremden Hosts. Schriften kommen
   über `@fontsource` (schon in theme.css). SQL-Engine bleibt die vorhandene (`$lib/tabula/sql.ts`).
2. Kein React, kein Babel, kein dc-runtime/support.js, kein tb-render.js in der App. Svelte-Komponenten.
3. Keine falschen Aussagen. Fakten:
   - Schüler haben KEIN Konto, keine E-Mail, keinen Benutzernamen. Klassen-Login mit Klassencode + Name + Passwort.
     Name/Passwort verlassen das Gerät nicht, Server kennt Nummer, Prüfwert, verschlüsselten Namen, Fortschritt.
   - Klassencodes: drei Wörter + Zahl, z. B. `sonne-apfel-kugel-33`. Beitreten: `app.tabulasql.de/beitreten`.
   - Schüler-Passwort vergessen: Lehrkraft erzeugt einen Einmal-Code (15 min, einmal), Schüler setzt damit neues
     Passwort (Login-Seite "Passwort vergessen?" beim Schüler-Login). NICHT "aus der Klasse entfernen".
   - Lehrkraft bekommt nach der Registrierung einen Wiederherstellungscode (muss bleiben).
   - Quiz: Beitritt mit Quiz-PIN unter /quiz/PIN (nicht mit Klassencode). Es gibt keinen "Pausiert"-Zustand.
   - Es gibt KEIN: Schuljahr, Schalter "Beitreten erlauben", "Häufigste Fehler · letzte 7 Tage",
     "Zuletzt aktiv"-Zeitstempel je Schüler, Self-Hosting. Nur zeigen, was die API liefert.
   - Server: Hetzner, Nürnberg. Ein Cookie `tabula_session` nur nach Anmeldung.
4. Barrierefreiheit: Kontrast WCAG AA (Hauptblau #2563eb), sichtbarer Fokus, Labels an Feldern, `prefers-reduced-motion`.
5. Bestehende Element-IDs/Selektoren, auf die Tests bauen, BEHALTEN: `#t-email`, `#t-pw`, `#cl-code`, `#cl-name`,
   `#cl-pw`, Buttons "Ich bin Schüler"/"Ich bin Lehrkraft", `button[type=submit]`, `.avatar-btn`, Texte
   "Testklasse", "Willkommen", "Los geht", "Ausführen", "SCHRITT x / y" in der Lektion, "QR"-Knopf in der Klasse,
   "Abmelden". Die Abnahme-Skripte `~/.jcode/scratch/onb/app-e2e.mjs` und `e2e.mjs` klicken genau darauf.
6. Mobil (390 px) und Dark Mode müssen funktionieren.
7. Nur Dateien deiner Lane anfassen. Gemeinsame Dateien (TopNav, theme.css, session, api, lessons, host.ts,
   app.html, +layout.svelte) NICHT ändern. Wenn nötig: dem Koordinator melden.

## Prüfen (Pflicht, vor dem Melden)
- `npx svelte-check --threshold error` : 0 Fehler.
- `npm test` grün.
- Lokaler Stack läuft schon: `tools/dev-stack.sh start` (Seite http://localhost:5194, API mit Wegwerf-DB).
  Konten dort selbst über die Oberfläche anlegen. Screenshots: `~/.jcode/scratch/onb/shoot <json>`
  (Format: {"width":1440,"height":900,"steps":[{"open":URL},{"wait":3},{"js":"return ..."},{"shot":"pfad.png"}]};
  `{"js":"document.documentElement.classList.add('light');return 1"}` für hell). Hell, dunkel, 390 px prüfen
  und mit dem Entwurf vergleichen (Bild ansehen).
- Kein Request an fremde Hosts: im Screenshot-Lauf `performance.getEntriesByType('resource')` prüfen.
- Commit nur deiner Dateien mit klarer Nachricht (deutsch). Nicht pushen, nicht deployen.

## Melden
Kurz: was umgebaut, welche Entwurfsteile weggelassen und warum, welche Prüfungen mit Ergebnis.
