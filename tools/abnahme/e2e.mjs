// Echter Abnahmeweg über die öffentliche Seite www.tabulasql.de, nur über die Oberfläche (Klicks, Eingaben).
// Zwei Sitzungen (Lehrkraft, Schüler), nacheinander statt parallel, damit WebKit nicht drosselt.
import { writeFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const K = JSON.parse(readFileSync('/Users/muri/.jcode/scratch/testkonto.json'))
const B = 'https://app.tabulasql.de'
const NAME = 'Abnahme Test ' + Math.random().toString(36).slice(2, 6).replace(/[0-9]/g, 'x')
const BAD = "SELECT titel FROM buecher WHERE jahr > 'kaputt"
const results = []

const H = `
window.__fill = (sel, v) => { const el = document.querySelector(sel); if (!el) return 'fehlt ' + sel;
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok' };
window.__click = (sel, text) => { const els = [...document.querySelectorAll(sel)]; const el = text ? els.find(e => e.textContent.trim().includes(text)) : els[0]; if (!el) return 'fehlt ' + sel + ' ' + (text||''); el.click(); return 'ok' };
window.__nav = (path) => { const a = document.createElement('a'); a.href = path; document.body.appendChild(a); a.click(); a.remove(); return 'ok' };
window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
`
const js = (code) => ({ js: H + code })
const waitText = (t, timeout = 40) => ({ waitFor: `document.body && document.body.innerText.includes(${JSON.stringify(t)})`, timeout })
const check = (label, expr) => ({ js: `return 'CHECK ' + ${JSON.stringify(label)} + ': ' + ((${expr}) ? 'PASS' : 'FAIL ' + location.pathname)` })
const save = (file, expr) => ({ saveJs: expr, saveTo: file })

const teacherLogin = [
  { open: `${B}/login?rolle=lehrkraft` },
  { waitFor: "document.querySelector('#t-email')" },
  js(`__fill('#t-email', ${JSON.stringify(K.email)}); __fill('#t-pw', ${JSON.stringify(K.password)}); return __click('button[type=submit]')`),
  waitText('Testklasse 10a'),
]

async function run(label, steps, width = 1280, height = 860) {
  const f = `e2e-${label}.json`
  writeFileSync(f, JSON.stringify({ width, height, steps }))
  const out = await new Promise((res) => {
    let buf = ''
    const p = spawn('./shoot', [f], { stdio: ['ignore', 'pipe', 'pipe'] })
    const t = setTimeout(() => { buf += '\nABBRUCH ' + label; p.kill('SIGKILL') }, 240000)
    p.stdout.on('data', (d) => (buf += d)); p.stderr.on('data', (d) => (buf += d))
    p.on('close', () => { clearTimeout(t); res(buf) })
  })
  for (const line of out.split('\n')) {
    if (/CHECK|TIMEOUT|FEHLER|fehlt|ABBRUCH|Stand/.test(line)) { console.log(`[${label}] ${line}`); results.push(line) }
  }
}

// 1) Schüler: beitreten, in einer Übung dreimal mit Fehler ausführen
await run('schueler-1', [
  { open: `${B}/beitreten/${K.join_code}` },
  waitText('Dein Name'),
  js(`__fill('input[placeholder="z. B. Lena S."]', ${JSON.stringify(NAME)}); for (const p of document.querySelectorAll('input[type=password]')) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(p,'erstesPw1'); p.dispatchEvent(new Event('input',{bubbles:true})) } return __click('button[type=submit]')`),
  waitText('Willkommen'),
  check('S1 Beitritt über die echte Seite', "document.body.innerText.includes('Willkommen')"),
  js(`return __click('button', "Los geht")`),
  { waitFor: "location.pathname === '/learn'", timeout: 30 },
  js(`return __nav('/learn/beginner/where-filters')`),
  { waitFor: "document.body.innerText.includes('SCHRITT')", timeout: 60 },
  { wait: 2 },
  js(`for (let k=0;k<8;k++){ const has=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Ausführen')) && document.querySelector('textarea'); if (has && /Übung/i.test(document.body.innerText)) break; const n=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Weiter') && !b.disabled && b.getClientRects().length); if(!n) break; n.click(); await __sleep(900) } return 'Stand: ' + (document.body.innerText.match(/SCHRITT\\s*\\d+\\s*\\/\\s*\\d+/i)||['?'])[0]`),
  js(`__fill('textarea', ${JSON.stringify(BAD)}); for (let k=0;k<3;k++){ __click('button', 'Ausführen'); await __sleep(1000) } return 'ok'`),
  { wait: 4 },
  check('S2 Fehlermeldung beim Schüler sichtbar', "document.body.innerText.includes('unrecognized token')"),
  check('S3 Avatar zeigt Initialen des Schülers statt G', `[...document.querySelectorAll('.avatar')].some(a => a.textContent.trim() === ${JSON.stringify((NAME.split(' ')[0][0] + NAME.split(' ').at(-1)[0]).toUpperCase())})`),
], 1100, 900)

// 2) Lehrkraft: Namen und Abfrage entschlüsselt sehen, Einmal-Code erzeugen
await run('lehrkraft-1', [
  ...teacherLogin,
  js(`return __click('.class-name-btn', 'Testklasse 10a')`),
  waitText(NAME),
  { wait: 1.5 },
  check('L1 Lehrkraft sieht den neuen Namen entschlüsselt', `document.body.innerText.includes(${JSON.stringify(NAME)})`),
  check('L2 Status des neuen Schülers: Hängt fest', `[...document.querySelectorAll('tr, .stuck-row')].some(r => r.textContent.includes(${JSON.stringify(NAME)}) && /Hängt fest/.test(r.textContent))`),
  js(`const r=[...document.querySelectorAll('.stuck-row, tr')].find(x=>x.textContent.includes(${JSON.stringify(NAME)})); r.click(); return 'ok'`),
  { waitFor: "/fehlermeldung/i.test(document.body.innerText)", timeout: 20 },
  { wait: 2 },
  check('L3 Letzte Abfrage im Browser entschlüsselt', `document.body.innerText.includes("WHERE jahr > 'kaputt")`),
  { shot: 'shots/e2e-lehrkraft-haengt-fest.png' },
  js(`return __click('a.tab, .tab', 'Schüler')`),
  waitText('Zuletzt angemeldet'),
  js(`[...document.querySelectorAll('.menu-btn')].find(x=>x.getAttribute('aria-label').includes(${JSON.stringify(NAME)})).click(); await __sleep(400); return __click('.student-menu button', 'Code erzeugen')`),
  waitText('Gültig noch', 20),
  check('L4 Einmal-Code angezeigt', "/^[A-Z0-9]{8}$/.test(document.querySelector('.pw-text')?.textContent.trim() || '')"),
  save('e2e-code', "document.querySelector('.pw-text').textContent.trim()"),
])

const CODE = (() => { try { return readFileSync('e2e-code', 'utf8').trim() } catch { return '' } })()

// 3) Schüler an einem "anderen PC" (frische Sitzung): Passwort vergessen, mit Code neues Passwort, dann Anmelden
await run('schueler-2', [
  { open: `${B}/login` },
  { waitFor: "document.querySelector('.link-sm')" },
  js(`return __click('.link-sm', 'Passwort vergessen')`),
  waitText('Einmal-Code der Lehrkraft'),
  js(`__fill('#sr-code', ${JSON.stringify(K.join_code)}); __fill('#sr-name', ${JSON.stringify(NAME)}); __fill('#sr-rc', ${JSON.stringify(CODE)}); __fill('#sr-pw', 'zweitesPw2'); __fill('#sr-pw2', 'zweitesPw2'); return __click('button[type=submit]')`),
  { waitFor: "location.pathname.startsWith('/learn')", timeout: 60 },
  check('S4 Neues Passwort mit Einmal-Code gesetzt und angemeldet', "location.pathname.startsWith('/learn')"),
])
await run('schueler-3', [
  { open: `${B}/login` },
  { waitFor: "document.querySelector('#cl-code')" },
  js(`__fill('#cl-code', ${JSON.stringify(K.join_code)}); __fill('#cl-name', ${JSON.stringify(NAME)}); __fill('#cl-pw', 'erstesPw1'); __click('button[type=submit]'); await __sleep(6000); return 'ok'`),
  check('S5 Altes Passwort abgelehnt', "!location.pathname.startsWith('/learn')"),
  js(`__fill('#cl-code', ${JSON.stringify(K.join_code.toUpperCase())}); __fill('#cl-name', ${JSON.stringify('  ' + NAME.toLowerCase() + ' ')}); __fill('#cl-pw', 'zweitesPw2'); return __click('button[type=submit]')`),
  { waitFor: "location.pathname.startsWith('/learn')", timeout: 60 },
  check('S6 Neues Passwort, Code groß und Name klein mit Leerzeichen', "location.pathname.startsWith('/learn')"),
  check('S7 Fortschritt vom Server da (Fokus-Lektion begonnen)', "document.body.innerText.includes('Begonnen')"),
])
await run('schueler-4', [
  { open: `${B}/login` },
  { waitFor: "document.querySelector('#t-email, #cl-code')" },
  js(`__click('.link-sm', 'Passwort vergessen'); await __sleep(500); __fill('#sr-code', ${JSON.stringify(K.join_code)}); __fill('#sr-name', ${JSON.stringify(NAME)}); __fill('#sr-rc', ${JSON.stringify(CODE)}); __fill('#sr-pw', 'drittesPw3'); __fill('#sr-pw2', 'drittesPw3'); __click('button[type=submit]'); await __sleep(6000); return 'ok'`),
  check('S8 Einmal-Code kein zweites Mal nutzbar', "!location.pathname.startsWith('/learn')"),
])

// 4) Lehrkraft: Schüler entfernen
await run('lehrkraft-2', [
  ...teacherLogin,
  js(`return __click('.class-name-btn', 'Testklasse 10a')`),
  waitText('Mia Test'),
  js(`return __click('a.tab, .tab', 'Schüler')`),
  waitText('Zuletzt angemeldet'),
  { wait: 2 },
  js(`for (let k=0;k<10;k++){ const row=[...document.querySelectorAll('tr.student-row, tr')].find(r=>/abnahme test/i.test(r.querySelector('.td-name')?.textContent||'')); if(!row) break; row.querySelector('.menu-btn').click(); await __sleep(400); __click('.student-menu button', 'Aus Klasse entfernen'); await __sleep(600); __click('.btn-remove-confirm'); await __sleep(3000) } return 'ok'`),
  check('L5 Alle Abnahme-Schüler entfernt', "!/abnahme test/i.test(document.body.innerText)"),
  check('L6 Mia, Jonas, Lea noch da', "['Mia Test','Jonas Test','Lea Test'].every(n => document.body.innerText.includes(n))"),
])

// 5) Entfernter Schüler kommt nicht mehr rein
await run('schueler-5', [
  { open: `${B}/login` },
  { waitFor: "document.querySelector('#cl-code')" },
  js(`__fill('#cl-code', ${JSON.stringify(K.join_code)}); __fill('#cl-name', ${JSON.stringify(NAME)}); __fill('#cl-pw', 'zweitesPw2'); __click('button[type=submit]'); await __sleep(6000); return 'ok'`),
  check('S9 Entfernter Schüler kann sich nicht mehr anmelden', "!location.pathname.startsWith('/learn')"),
])

const pass = results.filter((r) => /: PASS/.test(r)).length
const fail = results.filter((r) => /FAIL|ABBRUCH|TIMEOUT|fehlt|FEHLER/.test(r)).length
console.log(`\nErgebnis: ${pass} bestanden, ${fail} Probleme · Name ${NAME}`)
