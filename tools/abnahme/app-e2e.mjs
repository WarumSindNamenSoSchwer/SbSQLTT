// Abnahme app.tabulasql.de (30.10.2026): Schritte der Testanleitung über die alten www-Adressen.
// Nur lesend (keine Daten ändern), Testkonto aus testkonto.json.
import { writeFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const K = JSON.parse(readFileSync('/Users/muri/.jcode/scratch/testkonto.json'))
const W = 'https://www.tabulasql.de'
const H = `
window.__fill = (sel, v) => { const el = document.querySelector(sel); if (!el) return 'fehlt ' + sel;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok' };
window.__click = (sel, text) => { const els = [...document.querySelectorAll(sel)]; const el = text ? els.find(e => e.textContent.trim().includes(text)) : els[0]; if (!el) return 'fehlt ' + sel + ' ' + (text||''); el.click(); return 'ok' };
window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
`
const js = (code) => ({ js: H + code })
const waitText = (t, timeout = 40) => ({ waitFor: `document.body && document.body.innerText.includes(${JSON.stringify(t)})`, timeout })
const check = (label, expr) => ({ js: `return 'CHECK ' + ${JSON.stringify(label)} + ': ' + ((${expr}) ? 'PASS' : 'FAIL ' + location.href.slice(0,120))` })

async function run(label, steps) {
  const f = `app-${label}.json`
  writeFileSync(f, JSON.stringify({ width: 1280, height: 860, steps }))
  const out = await new Promise((res) => {
    let buf = ''
    const p = spawn('./shoot', [f], { stdio: ['ignore', 'pipe', 'pipe'] })
    const t = setTimeout(() => { buf += '\nABBRUCH ' + label; p.kill('SIGKILL') }, 240000)
    p.stdout.on('data', (d) => (buf += d)); p.stderr.on('data', (d) => (buf += d))
    p.on('close', () => { clearTimeout(t); res(buf) })
  })
  for (const line of out.split('\n')) if (/CHECK|TIMEOUT|FEHLER|fehlt|ABBRUCH|INFO/.test(line)) console.log(`[${label}] ${line}`)
}

// A) Gast-Fortschritt auf www wird beim Wechsel mitgenommen
await run('gast', [
  { open: `${W}/` },
  { wait: 2 },
  js(`localStorage.setItem('tabula-progress', JSON.stringify({'select-basics':{done:true},'where-filters':{step:3,of:9}})); localStorage.setItem('tabula-theme','dark'); return 'ok'`),
  js(`return __click('a', 'Lernen')`),
  { waitFor: "location.hostname === 'app.tabulasql.de' && document.body && document.body.innerText.length > 200", timeout: 30 },
  { wait: 2 },
  check('A1 Klick auf Lernen landet auf app/learn', "location.href === 'https://app.tabulasql.de/learn'"),
  check('A2 Fortschritt übernommen', "JSON.parse(localStorage.getItem('tabula-progress')||'{}')['select-basics']?.done === true && JSON.parse(localStorage.getItem('tabula-progress'))['where-filters'].step === 3"),
  check('A3 Theme übernommen', "localStorage.getItem('tabula-theme') === 'dark' && !document.documentElement.classList.contains('light')"),
  check('A4 kein Fragment in der Adresse', "!location.hash"),
  check('A5 keine Cookies ohne Anmeldung', "document.cookie === ''"),
  { open: `${W}/datasets` },
  { wait: 2 },
  check('A6 Fortschritt auf www gelöscht', "localStorage.getItem('tabula-progress') === null"),
  check('A7 Theme bleibt auf www', "localStorage.getItem('tabula-theme') === 'dark'"),
])

// B) Lehrkraft: Anleitung Teil 1 Schritt 1/2 (www, Anmelden, Ich bin Lehrkraft)
await run('lehrkraft', [
  { open: `${W}/` },
  { wait: 2 },
  js(`return __click('a', 'Anmelden')`),
  { waitFor: "location.hostname === 'app.tabulasql.de' && document.querySelector('form')", timeout: 30 },
  check('B1 Anmelden auf www führt zu app/login', "location.href.startsWith('https://app.tabulasql.de/login')"),
  js(`return __click('button', 'Lehrkraft')`),
  { waitFor: "document.querySelector('#t-email')", timeout: 20 },
  js(`__fill('#t-email', ${JSON.stringify(K.email)}); __fill('#t-pw', ${JSON.stringify(K.password)}); return __click('button[type=submit]')`),
  waitText('Testklasse 10a'),
  check('B2 Lehrkraft landet bei Klassen', "location.pathname === '/teach' && document.body.innerText.includes('Testklasse 10a')"),
  js(`const el=[...document.querySelectorAll('a,button,[role=link],.card,article')].find(e=>e.textContent.includes('Testklasse 10a')); el.click(); return 'ok'`),
  waitText('Jonas Test'),
  check('B3 Klasse offen, Namen entschlüsselt', "document.body.innerText.includes('Jonas Test') && document.body.innerText.includes('Mia Test')"),
  js(`return __click('button', 'QR')`), { wait: 2 },
  check('B4 QR-Dialog zeigt app-Adresse', "document.body.innerText.includes('app.tabulasql.de/beitreten')"),
  js(`return 'INFO cookie sichtbar fuer js: ' + JSON.stringify(document.cookie)`),
  { open: `https://app.tabulasql.de/` },
  { waitFor: "location.pathname !== '/'", timeout: 20 },
  check('B5 app/ angemeldet geht direkt zu Klassen', "location.pathname === '/teach'"),
  { open: `${W}/login` },
  { waitFor: "location.hostname === 'app.tabulasql.de' && location.pathname !== '/login'", timeout: 20 },
  check('B6 alte Adresse www/login angemeldet geht direkt zu Klassen', "location.pathname === '/teach'"),
  { open: `${W}/impressum` },
  { wait: 2 },
  check('B7 Website zeigt Anmelden, keine Session auf www', "location.hostname === 'www.tabulasql.de'"),
])

// C) Schüler: Anleitung Teil 2 (www/beitreten mit Code, Anmelden als Schüler)
await run('schueler', [
  { open: `${W}/beitreten/${K.join_code}` },
  { waitFor: "location.hostname === 'app.tabulasql.de' && document.body && document.body.innerText.includes('Testklasse')", timeout: 40 },
  check('C1 www/beitreten/CODE landet auf app mit Klasse', `location.pathname === '/beitreten/${K.join_code}'`),
  { open: `${W}/login` },
  { waitFor: "location.hostname === 'app.tabulasql.de' && document.querySelector('form')", timeout: 30 },
  js(`__fill('#cl-code', ${JSON.stringify(K.join_code)}); __fill('#cl-name', 'Mia Test'); __fill('#cl-pw', 'schueler1'); return __click('button[type=submit]')`),
  { waitFor: "location.pathname === '/learn'", timeout: 40 },
  { wait: 3 },
  check('C2 Schüler-Login landet bei Lernen', "location.href === 'https://app.tabulasql.de/learn' && document.body.innerText.length > 200"),
  { open: `https://app.tabulasql.de/` },
  { waitFor: "location.pathname !== '/'", timeout: 20 },
  check('C3 app/ angemeldet geht direkt zu Lernen', "location.pathname === '/learn'"),
  js(`return __click('a', 'Datensätze')`),
  { waitFor: "location.hostname === 'www.tabulasql.de'", timeout: 20 },
  check('C4 Datensätze-Link führt zur Website', "location.href === 'https://www.tabulasql.de/datasets'"),
])
