// Baut die Testanleitung als HTML (A4-Seiten) im Tabula-Look.
import { readFileSync, writeFileSync } from 'node:fs'
const K = JSON.parse(readFileSync('/Users/muri/.jcode/scratch/testkonto.json'))
const svg = (n) => readFileSync(`edgar-${n}.svg`, 'utf8').replace('<svg ', '<svg class="edgar" ')
const icon = readFileSync('edgar-icon.svg', 'utf8').replace('<svg ', '<svg class="logo-owl" ')
const img = (f, cls = '', alt = '', maxh = 0, w = 0) => `<figure class="shot ${cls}" style="${w ? `width:${w}mm;` : ''}${maxh ? `max-height:${maxh}mm;` : ''}"><img src="img/${f}.jpg" alt="${alt}"></figure>`

const step = (n, title, body, pic = '') => `
<div class="step">
  <div class="num">${n}</div>
  <div class="step-body"><h3>${title}</h3>${body ? `<p>${body}</p>` : ''}${pic}</div>
</div>`
const ui = (t) => `<span class="ui">${t}</span>`
const code = (t) => `<span class="code">${t}</span>`
const head = (label, title, owl) => `<header class="sec-head"><div><div class="kicker">${label}</div><h2>${title}</h2></div>${svg(owl)}</header>`
const foot = (n) => `<footer class="pfoot"><span>${icon} Tabula · Testanleitung</span><span>www.tabulasql.de</span><span>${n}</span></footer>`

const pages = []

// Seite 1: Titel + Zugangsdaten
pages.push(`
<section class="page cover">
  <div class="brand">${icon}<span>Tabula<b>.</b></span></div>
  <div class="hero">
    <div class="hero-text">
      <div class="kicker">Testanleitung · Oktober 2026</div>
      <h1>Tabula im Unterricht ausprobieren</h1>
    </div>
    ${svg('wave')}
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Lehrkraft</div>
      <dl>
        <dt>Adresse</dt><dd>www.tabulasql.de/login</dd>
        <dt>E-Mail</dt><dd class="mono">${K.email}</dd>
        <dt>Passwort</dt><dd class="mono big">${K.password}</dd>
      </dl>
      <p class="small">Wiederherstellungscode (nur falls nötig):<br><span class="mono rc">${K.recovery.split('-').join('-<wbr>')}</span></p>
    </div>
    <div class="card">
      <div class="card-label">Testklasse 10a</div>
      <dl>
        <dt>Klassencode</dt><dd class="mono big">${K.join_code}</dd>
      </dl>
      <table class="students">
        <tr><th>Schüler</th><th>Passwort</th><th>Stand</th></tr>
        <tr><td>Mia Test</td><td class="mono">schueler1</td><td><span class="pill blue">● In Arbeit</span></td></tr>
        <tr><td>Jonas Test</td><td class="mono">schueler2</td><td><span class="pill red">! Hängt fest</span></td></tr>
        <tr><td>Lea Test</td><td class="mono">schueler3</td><td><span class="pill green">✓ Fertig</span></td></tr>
      </table>
    </div>
  </div>

  <div class="how">
    <h3>So funktioniert das in zwei Sätzen</h3>
    <div class="how-grid">
      <div><b>Schüler haben kein Konto.</b> Sie treten mit dem Klassencode bei, legen selbst Name und Passwort fest und melden sich danach an jedem Rechner mit Klassencode, Name und Passwort an.</div>
      <div><b>Die Namen sind verschlüsselt.</b> Nur dein Browser kann sie lesen, auf dem Server stehen nur Nummern. Vergisst jemand sein Passwort, erzeugst du einen Einmal-Code.</div>
    </div>
  </div>

  <div class="tip"><b>Tipp:</b> Für die Schüler-Seite brauchst du ein privates Fenster oder einen zweiten Browser, weil man pro Browser nur einmal angemeldet ist. Die Testadresse hat kein Postfach, „Passwort vergessen“ per Mail geht also nur mit einem eigenen Konto (Seite 12).</div>
  ${foot(1)}
</section>`)

// Seite 2: Lehrkraft 1
pages.push(`
<section class="page">
  ${head('Teil 1 · Lehrkraft', 'Anmelden und die Klasse ansehen', 'point')}
  <div class="row">
    ${step(1, 'Anmelden', `Öffne ${ui('www.tabulasql.de')}, klick oben rechts auf ${ui('Anmelden')} und dann ${ui('Ich bin Lehrkraft')}. E-Mail und Passwort von Seite 1 eingeben.`)}
    ${img('t01-login', 'narrow')}
  </div>
  ${step(2, 'Klasse öffnen', `Du landest bei ${ui('Klassen')}. Die Zeile zeigt die Fokus-Lektion und wie viele gerade festhängen. Klick auf ${ui('Testklasse 10a')}.`, img('t02-klassen'))}
  ${foot(2)}
</section>`)

// Seite 3: Übersicht
pages.push(`
<section class="page">
  ${head('Teil 1 · Lehrkraft', 'Wer kommt mit, wer hängt fest?', 'thinking')}
  ${step(3, 'Übersicht', `Oben siehst du die Fokus-Lektion und vier Zähler. Die Tabelle zeigt pro Schüler Status, Schritt und Fehlversuche.`, img('t03-uebersicht'))}
  ${step(4, 'Alle Lektionen', `Mit ${ui('Alle Lektionen')} siehst du statt der Fokus-Lektion den ganzen Kurs: grün fertig, blau begonnen, rot hängt fest.`, img('t05-matrix'))}
  ${foot(3)}
</section>`)

pages.push(`
<section class="page">
  ${head('Teil 1 · Lehrkraft', 'Was hat Jonas falsch gemacht?', 'thinking')}
  ${step(5, 'Auf einen Namen klicken', `Klick auf ${ui('Jonas Test')}. Rechts erscheinen die Aufgabe, seine letzte Abfrage und die Fehlermeldung. Die Abfrage ist verschlüsselt gespeichert, nur dein Browser kann sie lesen. Mit ${ui('✓ Als erledigt markieren')} nimmst du ihn aus der Liste, wenn du ihm geholfen hast.`, img('t04-haengt-fest'))}
  ${foot(4)}
</section>`)

// Lektionen + QR
pages.push(`
<section class="page">
  ${head('Teil 1 · Lehrkraft', 'Lektionen und Beitreten', 'hint')}
  ${step(6, 'Lektionen freischalten', `Tab ${ui('Lektionen')}: Schalter für frei oder gesperrt, mit dem Stern setzt du die Fokus-Lektion.`, img('t06-lektionen', 'w130'))}
  <div class="row">
    ${step(7, 'Code für den Beamer', `Oben rechts auf ${code(K.join_code)} ${ui('QR')} klicken. Klassencode und QR-Code erscheinen groß, Schüler scannen ihn mit dem Handy.`)}
    ${img('t07-qr', 'qr')}
  </div>
  ${foot(5)}
</section>`)

pages.push(`
<section class="page">
  ${head('Teil 1 · Lehrkraft', 'Passwort vergessen und Einstellungen', 'hint')}
  ${step(8, 'Einmal-Code erzeugen', `Tab ${ui('Schüler')}, bei Jonas auf ${ui('⋯')} und dann ${ui('Passwort vergessen: Code erzeugen')}.`, img('t09-schueler-menu', 'w140'))}
  ${step(9, 'Code weitergeben', `Der Code gilt 15 Minuten und nur einmal. Merk ihn dir für Teil 2, Schritt 5.`, img('t10-einmalcode', 'w90'))}
  ${step(10, 'Einstellungen', `Tab ${ui('Einstellungen')}: Name ändern, neuer Beitrittscode, archivieren oder löschen. <b>Bitte die Testklasse nicht löschen</b>, sonst sind die Testschüler weg.`, img('t11-einstellungen', 'w100'))}
  ${foot(6)}
</section>`)

// Schüler
pages.push(`
<section class="page">
  ${head('Teil 2 · Schüler', 'Beitreten mit dem Klassencode', 'wave')}
  <p class="intro">Öffne dafür ein <b>privates Fenster</b> oder einen anderen Browser. Dein Lehrer-Fenster bleibt offen.</p>
  <div class="duo">
    <div>${step(1, 'Code eingeben', `${ui('www.tabulasql.de/beitreten')}, Code ${code(K.join_code)} eingeben, ${ui('Weiter')}.`)}${img('s01-beitreten-code')}</div>
    <div>${step(2, 'Name und Passwort', `Erfundener Name, Passwort mit mindestens 8 Zeichen, ${ui('Beitreten')}.`)}${img('s02-beitreten-name')}</div>
  </div>
  ${foot(7)}
</section>`)

pages.push(`
<section class="page">
  ${head('Teil 2 · Schüler', 'Anmelden und lernen', 'read')}
  <div class="row">
    ${step(3, 'Wieder anmelden', `Später oder an einem anderen Rechner: ${ui('Anmelden')}, ${ui('Ich bin Schüler')}, dann Klassencode, Name und Passwort. Groß- und Kleinschreibung beim Namen ist egal.`)}
    ${img('s03-login', 'w52')}
  </div>
  ${step(4, 'Lernen', `Nach der Anmeldung zeigt Tabula oben die Fokus-Lektion der Klasse. Mach ein paar Schritte, auch gern mit Fehlern, und schau danach im Lehrer-Fenster in die Übersicht. Das Bild zeigt Mia, die schon etwas weiter ist, bei einem neuen Schüler ist noch alles offen.`, img('s04-lernen', 'w105'))}
  ${foot(8)}
</section>`)

pages.push(`
<section class="page">
  ${head('Teil 2 · Schüler', 'Passwort vergessen und Profil', 'hint')}
  <div class="row">
    ${step(5, 'Mit dem Einmal-Code', `Bei ${ui('Ich bin Schüler')} klickst du auf ${ui('Passwort vergessen?')} und gibst Klassencode, Name, den Einmal-Code von vorhin (Teil 1, Schritt 9) und ein neues Passwort ein.`)}
    ${img('s06-passwort-vergessen', 'w52')}
  </div>
  ${step(6, 'Profil', `Oben rechts auf den eigenen Namen, dann ${ui('Profil')}: Name und Passwort ändern oder aus der Klasse austreten.`, img('s05-profil', 'w95'))}
  ${foot(9)}
</section>`)

// Quiz
pages.push(`
<section class="page">
  ${head('Teil 3 · Live-Quiz', 'Quiz am Beamer, Antworten am Handy', 'quiz')}
  <p class="intro">Wechsle zurück in dein <b>Lehrer-Fenster</b>. Das Schüler-Fenster brauchst du gleich zum Mitspielen.</p>
  ${step(1, 'Quiz starten', `Im Klassen-Kopf rechts auf ${ui('Quiz starten')}. Klasse wählen, unter ${ui('Automatisch')} einen Fragensatz ${ui('Starten')}. Eigene Fragen legst du mit ${ui('+ Neuer Fragensatz')} an.`, img('t12-quiz-start', 'mid'))}
  ${step(2, 'Schüler kommen dazu', `Am Beamer stehen PIN und QR-Code. Schüler öffnen ${ui('www.tabulasql.de/quiz')} und geben die PIN ein. Mitmachen kann nur, wer in der Klasse angemeldet ist. Wenn alle dabei sind, klickst du am Beamer auf ${ui('Los')}.`, img('q02-lobby', 'mid'))}
  ${foot(10)}
</section>`)

pages.push(`
<section class="page">
  ${head('Teil 3 · Live-Quiz', 'So sieht eine Runde aus', 'trophy')}
  <div class="duo">
    <div>${img('q03-frage-beamer')}<p class="cap">Beamer: Frage mit Timer</p></div>
    <div>${img('q04-aufloesung-beamer')}<p class="cap">Beamer: Auflösung, dann ${ui('Weiter')}</p></div>
  </div>
  <div class="phones">
    <div>${img('p03-frage', 'phone')}<p class="cap">Handy: antworten</p></div>
    <div>${img('p05-aufloesung', 'phone')}<p class="cap">Handy: richtig oder falsch</p></div>
    <div>${img('p06-ende', 'phone')}<p class="cap">Handy: eigener Platz</p></div>
  </div>
  <div class="row podium-row">
    <div class="phone-note">
      <h3>Wer sieht welche Namen?</h3>
      <p>Die Rangliste mit Namen sieht nur der Beamer der Lehrkraft. Am Handy sieht jeder nur seinen eigenen Platz und seine Punkte.</p>
    </div>
    <div class="podium-shot">${img('q06-ende-beamer')}<p class="cap">Beamer: Ende mit Podium</p></div>
  </div>
  ${foot(11)}
</section>`)

// Eigenes Konto + Feedback
pages.push(`
<section class="page">
  ${head('Teil 4 · Wenn du magst', 'Ein eigenes Konto anlegen', 'graduate')}
  <div class="row">
    <div>
      ${step(1, 'Registrieren', `Abmelden, dann ${ui('Anmelden')}, ${ui('Ich bin Lehrkraft')} und unten ${ui('Lehrer-Konto erstellen')}. Name, E-Mail, Passwort, optional Schule. Den Datenschutz-Hinweis abhaken, dann wieder ${ui('Lehrer-Konto erstellen')}.`)}
      ${step(2, 'Wiederherstellungscode notieren', `Danach zeigt Tabula einen Code aus 8 Wörtern. Damit bekommst du die Schülernamen zurück, falls du dein Passwort vergisst. Ohne Code gehen nur die Namen verloren, und die kommen zurück, sobald sich deine Schüler das nächste Mal anmelden.`)}
      ${step(3, 'Klasse anlegen', `${ui('Neue Klasse')}. Das Konto kannst du später unter ${ui('Profil')} wieder löschen.`)}
    </div>
    ${img('r01-registrieren', 'narrow')}
  </div>
  </div>
  ${foot(12)}
</section>`)

const css = `
@font-face { font-family: Plex; font-weight: 400; src: url(ibm-plex-sans-latin-400-normal.woff2); }
@font-face { font-family: Plex; font-weight: 500; src: url(ibm-plex-sans-latin-500-normal.woff2); }
@font-face { font-family: Plex; font-weight: 600; src: url(ibm-plex-sans-latin-600-normal.woff2); }
@font-face { font-family: PlexMono; font-weight: 400; src: url(ibm-plex-mono-latin-400-normal.woff2); }
@font-face { font-family: PlexMono; font-weight: 500; src: url(ibm-plex-mono-latin-500-normal.woff2); }
:root { --ink:#0f172a; --ink2:#475569; --ink3:#64748b; --line:#e2e8f0; --bg:#f8fafc; --accent:#3b82f6; --accent2:#2563eb; --soft:#eff6ff; --aline:#bfdbfe; }
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: 210mm 297mm; margin: 0; }
html, body { background: #fff; }
body { font-family: Plex, sans-serif; color: var(--ink); font-size: 10.5pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.mono, .code { font-family: PlexMono, monospace; }
.page { width: 793.7px; height: 1122.5px; padding: 16mm 16mm 20mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
.page:last-child { page-break-after: auto; break-after: auto; }
.edgar { width: 34mm; height: auto; flex: none; }
.logo-owl { width: 5mm; height: 5mm; vertical-align: -1mm; }
.brand { display: flex; align-items: center; gap: 2.5mm; font-size: 14pt; font-weight: 600; }
.brand .logo-owl { width: 8mm; height: 8mm; }
.brand b { color: var(--accent); }
.kicker { font-family: PlexMono, monospace; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: var(--accent2); margin-bottom: 1.5mm; }
.cover .hero { display: flex; align-items: center; gap: 8mm; margin: 12mm 0 9mm; }
.cover .hero .edgar { width: 46mm; }
.cover h1 { font-size: 27pt; line-height: 1.12; font-weight: 600; letter-spacing: -.01em; margin-bottom: 4mm; }
.lead { font-size: 11pt; color: var(--ink2); }
.cards { display: grid; grid-template-columns: 1fr 1.25fr; gap: 5mm; }
.card { border: 1px solid var(--line); border-radius: 3mm; padding: 5mm; background: var(--bg); }
.card-label { font-weight: 600; font-size: 11.5pt; margin-bottom: 3mm; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 1.5mm 4mm; align-items: baseline; }
dt { color: var(--ink3); font-size: 9pt; }
dd { font-weight: 500; }
dd.big { font-size: 13pt; color: var(--accent2); }
.small { margin-top: 3mm; font-size: 8.5pt; color: var(--ink3); }
.small .mono { color: var(--ink2); font-size: 8.5pt; }
.rc { word-break: keep-all; overflow-wrap: normal; hyphens: none; }
table.students { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 9.5pt; }
table.students th { text-align: left; font-family: PlexMono, monospace; font-weight: 400; font-size: 7.5pt; letter-spacing: .06em; text-transform: uppercase; color: var(--ink3); padding: 1mm 0; border-bottom: 1px solid var(--line); }
table.students td { padding: 1.6mm 0; border-bottom: 1px solid var(--line); }
.pill { display: inline-block; font-size: 8pt; font-weight: 500; padding: .4mm 2mm; border-radius: 9mm; }
.pill.blue { background: #dbeafe; color: #1d4ed8; } .pill.red { background: #fee2e2; color: #991b1b; } .pill.green { background: #dcfce7; color: #166534; }
.how { margin-top: 7mm; }
.how h3 { font-size: 11.5pt; margin-bottom: 2.5mm; }
.how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; color: var(--ink2); }
.how-grid b { color: var(--ink); }
.tip { margin-top: 7mm; background: var(--soft); border: 1px solid var(--aline); border-radius: 3mm; padding: 4mm 5mm; font-size: 9.5pt; color: var(--ink); }
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 6mm; padding-bottom: 4mm; margin-bottom: 5mm; border-bottom: 1px solid var(--line); }
.sec-head h2 { font-size: 19pt; line-height: 1.2; font-weight: 600; }
.sec-head .edgar { width: 24mm; }
.intro { margin-bottom: 4mm; color: var(--ink2); }
.step { display: flex; gap: 4mm; margin-bottom: 5mm; }
.num { flex: none; width: 8mm; height: 8mm; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 600; font-size: 10pt; display: flex; align-items: center; justify-content: center; margin-top: .3mm; }
.step-body { flex: 1; min-width: 0; }
.step h3 { font-size: 11.5pt; font-weight: 600; margin-bottom: 1mm; }
.step p { color: var(--ink2); }
.ui { font-weight: 600; color: var(--ink); background: #f1f5f9; border: 1px solid var(--line); border-radius: 1.2mm; padding: 0 1.4mm; white-space: nowrap; }
.code { color: var(--accent2); font-weight: 500; white-space: nowrap; }
.shot { margin-top: 3mm; border: 1px solid var(--line); border-radius: 2.5mm; overflow: hidden; box-shadow: 0 1.5mm 5mm -2mm rgba(15,23,42,.18); background: #fff; }
.shot img { display: block; width: 100%; height: auto; }
.shot.narrow { width: 64mm; flex: none; margin-top: 0; }
.shot.mid { width: 120mm; }
.shot.mid2 { width: 100mm; }
.shot.w52 { width: 62mm; flex: none; margin-top: 0; }
.shot.qr { width: 52mm; flex: none; margin-top: 0; }
.shot.w90 { width: 90mm; }
.shot.w95 { width: 95mm; }
.shot.w110 { width: 110mm; }
.shot.w115 { width: 115mm; }
.shot.w105 { width: 105mm; }
.shot.w130 { width: 130mm; }
.shot.w150 { width: 150mm; }
.shot.w100 { width: 100mm; }
.shot.w140 { width: 140mm; }
.shot.narrow2 { width: 56mm; flex: none; margin-top: 0; }
.row { display: flex; gap: 8mm; align-items: flex-start; margin-bottom: 5mm; }
.row > .step { flex: 1; }
.trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
.trio .step { margin-bottom: 1mm; min-height: 27mm; }
.duo { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.duo .step { margin-bottom: 1mm; }
.phones { display: grid; grid-template-columns: repeat(3, 42mm); justify-content: center; gap: 10mm; margin-top: 6mm; align-items: start; }
.podium-row { margin-top: 6mm; align-items: center; }
.podium-shot { width: 80mm; flex: none; }
.shot.phone { border-radius: 4mm; }
.phone-note h3 { font-size: 11pt; margin-bottom: 1.5mm; }
.phone-note p { color: var(--ink2); font-size: 9.5pt; }
.cap { margin-top: 1.5mm; font-size: 8.5pt; color: var(--ink3); text-align: center; }
.feedback { display: flex; gap: 6mm; align-items: center; margin-top: 4mm; background: var(--soft); border: 1px solid var(--aline); border-radius: 3mm; padding: 5mm 6mm; }
.feedback .edgar { width: 28mm; }
.feedback h3 { font-size: 12pt; margin-bottom: 2mm; }
.feedback ul { padding-left: 4.5mm; color: var(--ink2); }
.feedback li { margin-bottom: 1mm; }
.pfoot { position: absolute; left: 16mm; right: 16mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 8pt; color: var(--ink3); border-top: 1px solid var(--line); padding-top: 2.5mm; }
`
writeFileSync('anleitung.html', `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Tabula Testanleitung</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`)
console.log('Seiten:', pages.length)
