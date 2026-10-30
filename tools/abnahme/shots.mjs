// Erzeugt die Screenshot-Skripte für den WebKit-Runner und führt sie aus.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const K = JSON.parse(readFileSync('/Users/muri/.jcode/scratch/testkonto.json'))
const B = 'https://app.tabulasql.de'
const CID = 4
mkdirSync('shots', { recursive: true })

// Hilfsfunktionen, die in jede Seite gespritzt werden
const H = `
window.__fill = (sel, v) => { const el = document.querySelector(sel); if (!el) return 'fehlt ' + sel;
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'ok' };
window.__click = (sel, text) => { const els = [...document.querySelectorAll(sel)]; const el = text ? els.find(e => e.textContent.trim().includes(text)) : els[0]; if (!el) return 'fehlt ' + sel + ' ' + (text||''); el.click(); return 'ok' };
window.__nav = (path) => { const a = document.createElement('a'); a.href = path; document.body.appendChild(a); a.click(); a.remove(); return 'ok' };
window.__has = (text) => document.body.innerText.includes(text);
`
const js = (code) => ({ js: H + code })
const shot = (name, extra = {}) => ({ shot: `shots/${name}.png`, ...extra })
const waitText = (t, timeout = 20) => ({ waitFor: `document.body && document.body.innerText.includes(${JSON.stringify(t)})`, timeout })

function run(name, s) {
  writeFileSync(`${name}.json`, JSON.stringify(s))
  try { process.stdout.write(execFileSync('./shoot', [`${name}.json`], { encoding: 'utf8', timeout: 300000 })) }
  catch (e) { console.log('FEHLER', name, e.stdout || e.message) }
}

const which = process.argv[2] || 'all'

// ---------- Lehrkraft ----------
if (which === 'all' || which === 'teacher') run('s-teacher', { width: 1100, height: 1400, steps: [
  { open: `${B}/login?rolle=lehrkraft` },
  { waitFor: "document.querySelector('#t-email')" },
  js(`__fill('#t-email', ${JSON.stringify(K.email)}); __fill('#t-pw', ${JSON.stringify(K.password)}); return 'ok'`),
  { shot: 'shots/t01-login.png', el: 'main .wrap', pad: 28, marks: [['.seg-btn::text(Ich bin Lehrkraft)', ''], ['button[type=submit]', '']] },
  js(`return __click('button[type=submit]')`),
  waitText('Testklasse 10a', 40),
  { wait: 1.5 },
  { shot: 'shots/t02-klassen.png', el: '.page-header, .class-table-wrap', pad: 30, marks: [['.class-row', '']] },
  js(`return __click('.class-name-btn', 'Testklasse 10a')`),
  waitText('Hängt fest', 30),
  { waitFor: "document.body.innerText.includes('Mia Test')", timeout: 30 },
  { wait: 1.5 },
  { size: [1100, 620] },
  { shot: 'shots/t03-uebersicht.png', el: '.class-header, .dashboard-content', pad: 0, marks: [['.help-card', ''], ['.student-row::text(Jonas Test)', '']] },
  js(`const r=[...document.querySelectorAll('.stuck-row, .student-row')].find(x=>x.textContent.includes('Jonas')); r.click(); return 'ok'`),
  { waitFor: "/fehlermeldung/i.test(document.body.innerText)", timeout: 20 },
  { wait: 1.5 },
  { size: [1100, 760] },
  { shot: 'shots/t04-haengt-fest.png', el: '.class-header, .dashboard-content, .side-panel', pad: 0, marks: [['.query-box', ''], ['.error-msg-wrap', '']] },
  js(`const b=document.querySelector('.panel-close'); if(b) b.click(); return __click('.view-seg button, button', 'Alle Lektionen')`),
  { wait: 1.5 },
  { size: [1100, 520] },
  { shot: 'shots/t05-matrix.png', el: '.class-header, .dashboard-content', pad: 0, marks: [['button::text(Alle Lektionen)', '']] },
  js(`return __click('.tab', 'Lektionen')`),
  waitText('Alle freischalten', 20),
  { wait: 1 },
  { size: [1100, 1400] },
  { shot: 'shots/t06-lektionen.png', el: '.class-header, .lektionen-wrap', pad: 0, marks: [['.toggle-switch', ''], ['.badge-focus', '']] },
  js(`return __click('.code-btn')`),
  { waitFor: "document.querySelector('.qr-close')", timeout: 20 },
  { wait: 1.5 },
  { shot: 'shots/t07-qr.png', el: '.qr-dialog', pad: 0, marks: [['.qr-dialog-code', '']] },
  js(`document.querySelector('.qr-close').click(); return __click('.tab', 'Schüler')`),
  waitText('Zuletzt angemeldet', 20),
  { wait: 1 },
  { shot: 'shots/t08-schueler.png', el: '.class-header, .schueler-wrap', pad: 0 },
  js(`const b=[...document.querySelectorAll('.menu-btn')].find(x=>x.getAttribute('aria-label').includes('Jonas')); b.click(); return 'ok'`),
  { wait: 0.6 },
  { shot: 'shots/t09-schueler-menu.png', el: '.toolbar, .students-table, .student-menu', pad: 20, marks: [['.menu-btn[aria-label="Aktionen für Jonas Test"]', ''], ['.student-menu button::text(Code erzeugen)', '']] },
  js(`return __click('.student-menu button', 'Code erzeugen')`),
  waitText('Gültig noch', 20),
  { wait: 1 },
  { shot: 'shots/t10-einmalcode.png', el: '.dialog-box', pad: 0, marks: [['.pw-text', '']] },
  { saveJs: "document.querySelector('.pw-text').textContent.trim()", saveTo: 'demo-code' },
  js(`const t=document.querySelector('.pw-text'); return t ? t.textContent.trim() : 'kein code'`),
  js(`return __click('.dialog-actions button', 'Fertig')`),
  js(`return __click('.tab', 'Einstellungen')`),
  waitText('Klasse löschen', 20),
  { wait: 1 },
  { shot: 'shots/t11-einstellungen.png', el: '.settings-section, .danger-section', pad: 24 },
  js(`return __nav('/teach/quiz?klasse=${CID}')`),
  waitText('Quiz starten', 20),
  { wait: 1.5 },
  { size: [1100, 760] },
  { shot: 'shots/t12-quiz-start.png', el: 'main', pad: 0, marks: [['#quiz-class', ''], ['.btn-starten', '']] },
] })

// ---------- Schüler ----------
if (which === 'all' || which === 'student') run('s-student', { width: 1100, height: 1500, steps: [
  { open: `${B}/beitreten` },
  { waitFor: "document.querySelector('input')" },
  js(`return __fill('input', ${JSON.stringify(K.join_code)})`),
  { shot: 'shots/s01-beitreten-code.png', el: 'main .wrap', pad: 28, marks: [['input', '']] },
  js(`return __click('button[type=submit]')`),
  waitText('Dein Name', 20),
  { wait: 1 },
  js(`const i=[...document.querySelectorAll('input')]; __fill('input[placeholder="z. B. Lena S."]', 'Ben Beispiel'); const pw=i.filter(x=>x.type==='password'); pw.forEach(p=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(p,'beispiel1'); p.dispatchEvent(new Event('input',{bubbles:true}))}); return 'ok'`),
  { shot: 'shots/s02-beitreten-name.png', el: 'main .wrap', pad: 28, marks: [['input[placeholder="z. B. Lena S."]', ''], ['button[type=submit]', '']] },
  { open: `${B}/login` },
  { waitFor: "document.querySelector('#cl-code')" },
  js(`__fill('#cl-code', ${JSON.stringify(K.join_code)}); __fill('#cl-name', 'Mia Test'); __fill('#cl-pw', 'schueler1'); return 'ok'`),
  { shot: 'shots/s03-login.png', el: 'main .wrap', pad: 28, marks: [['.seg-btn::text(Ich bin Schüler)', '']] },
  js(`return __click('button[type=submit]')`),
  { waitFor: "location.pathname.startsWith('/learn')", timeout: 40 },
  { wait: 3 },
  { size: [1100, 1600] },
  { shot: 'shots/s04-lernen.png', el: '.focus-banner, .hero, .tracks', pad: 24, marks: [['.focus-banner', '']] },
  js(`return __nav('/profil')`),
  waitText('Klasse verlassen', 20),
  { wait: 1 },
  { size: [1100, 1500] },
  { shot: 'shots/s05-profil.png', el: '.content', pad: 28 },
  js(`return __click('.btn-logout, button', 'Abmelden')`),
  { wait: 2 },
  { open: `${B}/login` },
  { waitFor: "document.querySelector('#cl-code')" },
  js(`return __click('.link-sm', 'Passwort vergessen')`),
  waitText('Einmal-Code der Lehrkraft', 20),
  js(`__fill('#sr-code', ${JSON.stringify(K.join_code)}); __fill('#sr-name', 'Jonas Test'); __fill('#sr-rc', ${JSON.stringify((()=>{try{return readFileSync('demo-code','utf8').trim()}catch{return 'K7M4QX2P'}})())}); return 'ok'`),
  { shot: 'shots/s06-passwort-vergessen.png', el: 'main .wrap', pad: 28, marks: [['#sr-rc', '']] },
] })

// ---------- Registrierung (nur Formular und Ansicht, nichts absenden) ----------
if (which === 'all' || which === 'register') run('s-register', { width: 1100, height: 1500, steps: [
  { open: `${B}/login?rolle=lehrkraft` },
  { waitFor: "document.querySelector('#t-email')" },
  js(`return __click('.link-sm', 'Lehrer-Konto erstellen')`),
  { waitFor: "document.querySelector('#regl-name')", timeout: 20 },
  js(`__fill('#regl-name', 'Anna Beispiel'); __fill('#regl-email', 'anna.beispiel@schule.de'); __fill('#regl-school', 'Gymnasium am Park'); return 'ok'`),
  { wait: 0.6 },
  { shot: 'shots/r01-registrieren.png', el: 'main .wrap', pad: 28 },
] })
