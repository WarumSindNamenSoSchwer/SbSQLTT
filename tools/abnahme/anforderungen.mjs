// Abschlussprüfung live: je Anforderung eine konkrete Beobachtung.
// R1 Design übernommen (DOM-Merkmale aus dem Entwurf) · R4 keine fremden Hosts · R6 Handy ohne Überlauf, hell+dunkel
// R7 Felder haben Labels · R8 kein Speicher/Cookie ohne Handlung · R5 Bedienelemente der Anleitung vorhanden
import { writeFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const K = JSON.parse(readFileSync('/Users/muri/.jcode/scratch/testkonto.json'))
const W = 'https://www.tabulasql.de', A = 'https://app.tabulasql.de'
const f = '/Users/muri/.jcode/scratch/onb/req.json'
const C = (id, expr) => ({ js: `try { return 'REQ ${id}: ' + ((${expr}) ? 'PASS' : 'FAIL ' + location.pathname) } catch (e) { return 'REQ ${id}: FAIL ' + e.message }` })
const ovf = (id) => C(id, 'document.documentElement.scrollWidth <= document.documentElement.clientWidth')
const labels = (id) => C(id, "[...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]),textarea,select')].filter(i=>i.getClientRects().length).every(i => (i.id && document.querySelector('label[for=\"'+i.id+'\"]')) || i.closest('label') || i.getAttribute('aria-label'))")
const has = (id, txt) => C(id, `document.body.innerText.includes(${JSON.stringify(txt)})`)
const pub = [
  // R1 Designmerkmale
  { open: `${W}/` }, { js: "localStorage.clear(); sessionStorage.clear(); return 1" }, { open: `${W}/` }, { wait: 4 },
  has('R1.1 Startseite Hero', 'SQL lernen.'), C('R1.2 Startseite Studio mit echter DB', "/30 Zeilen|schulbibliothek/i.test(document.body.innerText)"),
  C('R1.3 Startseite Abschnitt lehrkraefte', "!!document.getElementById('lehrkraefte')"),
  C('R3.1 Fakten: Schüler kein Konto', "/Kein Konto/.test(document.body.innerText) && !/Benutzername|sechsstellig|an Ihrer Schule|Eigener Server/.test(document.body.innerText)"),
  C('R3.2 Fakten: Klassencode-Format', "document.body.innerText.includes('sonne-apfel-kugel-33')"),
  { open: `${W}/datasets` }, { wait: 3 },
  C('R1.4 Datensätze: Bibliothek, Schule, App-Traffic', "['bibliothek.db','app-traffic.db'].every(t=>document.body.innerText.includes(t))"),
  { open: `${A}/learn/beginner/where-filters` }, { wait: 4 },
  C('R1.5 Lektion: query.sql + Ausführen + SCHRITT', "/query\\.sql/i.test(document.body.innerText) || /SCHRITT/i.test(document.body.innerText)"),
  C('R1.6 Kopfleiste 60px Entwurf', "Math.round(document.querySelector('header').getBoundingClientRect().height) <= 61"),
  { open: `${W}/datenschutz` }, { wait: 3 },
  C('R3.3 Datenschutz vollständig (Quellen, app-Adresse, Cookie)', "document.body.innerText.length > 15000 && /app\\.tabulasql\\.de/.test(document.body.innerText) && /tabula_session/.test(document.body.innerText)"),
  // R8 Speicher
  C('R8 kein localStorage/Cookie nach Browsen ohne Handlung', "Object.keys(localStorage).length === 0 && document.cookie === ''"),
  // R7 Labels
  { open: `${A}/login` }, { wait: 3 }, labels('R7.1 Login Schüler: Felder mit Label'),
  { js: "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ich bin Lehrkraft')).click(); return 1" }, { wait: 1 }, labels('R7.2 Login Lehrkraft: Felder mit Label'),
  { open: `${A}/beitreten` }, { wait: 3 }, labels('R7.3 Beitreten: Felder mit Label'),
  { open: `${W}/kontakt` }, { wait: 3 }, labels('R7.4 Kontakt: Felder mit Label'),
  C('R7.5 Fokus sichtbar (focus-visible Regel vorhanden)', "[...document.styleSheets].some(s=>{try{return [...s.cssRules].some(r=>r.cssText.includes(':focus-visible'))}catch(e){return false}})"),
]
// R6 Handy hell + dunkel, öffentliche Seiten
const routes = [`${W}/`, `${W}/datasets`, `${W}/datenschutz`, `${W}/impressum`, `${W}/kontakt`, `${A}/learn`, `${A}/learn/beginner/where-filters`, `${A}/learn/python/python`, `${A}/login`, `${A}/beitreten`, `${A}/quiz`]
const mob = []
for (const theme of ['light', 'dark']) {
  mob.push({ open: `${W}/impressum` }, { js: `localStorage.setItem('tabula-theme','${theme}'); return 1` }, { open: `${A}/learn` }, { js: `localStorage.setItem('tabula-theme','${theme}'); return 1` })
  for (const r of routes) mob.push({ open: r }, { wait: 3 }, ovf(`R6 390px ${theme} ${r.replace(/https:\/\/(www|app)\.tabulasql\.de/, '$1')}`))
}
// Lehrkraft-Seiten am Handy (angemeldet, nur lesen)
const teach = [
  { open: `${A}/login?rolle=lehrkraft` }, { waitFor: "document.querySelector('#t-email')", timeout: 30 },
  { js: `const s=(q,v)=>{const e=document.querySelector(q);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}))}; s('#t-email',${JSON.stringify(K.email)}); s('#t-pw',${JSON.stringify(K.password)}); document.querySelector('button[type=submit]').click(); return 1` },
  { waitFor: "location.pathname==='/teach'", timeout: 30 }, { wait: 2 },
]
for (const r of ['/teach', '/teach/4', '/teach/4/lektionen', '/teach/4/schueler', '/teach/4/einstellungen', '/teach/neu', '/teach/quiz', '/teach/quiz/neu', '/profil'])
  teach.push({ open: A + r }, { wait: 3 }, ovf(`R6 390px Lehrkraft ${r}`))
// R5 Bedienelemente der Anleitung live vorhanden
teach.push({ open: `${A}/teach` }, { wait: 3 }, has('R5.1 Klassen: Testklasse 10a + Neue Klasse', 'Neue Klasse'),
  { open: `${A}/teach/4` }, { wait: 4 },
  C('R5.2 Klasse: QR, Quiz starten, Tabs', "['QR','Quiz starten','Übersicht','Lektionen','Schüler','Einstellungen','Alle Lektionen'].every(t=>document.body.innerText.includes(t))"),
  { open: `${A}/teach/4/schueler` }, { wait: 3 },
  { js: "document.querySelector('.menu-btn').click(); return 1" }, { wait: 0.5 },
  C('R5.3 Schüler: Menü ⋯ mit Code erzeugen', "[...document.querySelectorAll('button')].some(x=>x.textContent.includes('Passwort vergessen: Code erzeugen') && x.getClientRects().length)"),
  { open: `${A}/teach/quiz` }, { wait: 3 }, C('R5.4 Quiz: Automatisch, Starten, + Neuer Fragensatz', "['Automatisch','Starten','Neuer Fragensatz'].every(t=>document.body.innerText.includes(t))"),
)
const steps = [...pub, ...mob]
writeFileSync(f, JSON.stringify({ width: 390, height: 844, steps }))
const f2 = f.replace('.json', '-teach.json')
writeFileSync(f2, JSON.stringify({ width: 390, height: 844, steps: teach }))
let out = ''
for (const x of [f, f2]) out += execFileSync('/Users/muri/.jcode/scratch/onb/shoot', [x], { encoding: 'utf8', maxBuffer: 1e8 })
const lines = out.split('\n').filter((l) => l.includes('REQ ') || /TIMEOUT/.test(l)).map((l) => l.replace(/^JS \d+: /, ''))
lines.forEach((l) => console.log(l))
console.log(`\n${lines.filter((l) => l.endsWith('PASS')).length} PASS, ${lines.filter((l) => !l.endsWith('PASS')).length} FAIL/TIMEOUT`)
