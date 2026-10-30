// Weitere Abnahme: Links aus alten Mails (www), Abmelden, Quiz-Seite, Lehrkraft-Fokus, App-Anker
import { writeFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
const K = JSON.parse(readFileSync('/Users/muri/.jcode/scratch/testkonto.json'))
const W = 'https://www.tabulasql.de', A = 'https://app.tabulasql.de'
const H = `
window.__fill = (sel, v) => { const el = document.querySelector(sel); if (!el) return 'fehlt ' + sel;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok' };
window.__click = (sel, text) => { const els = [...document.querySelectorAll(sel)]; const el = text ? els.find(e => e.textContent.trim().includes(text)) : els[0]; if (!el) return 'fehlt ' + sel + ' ' + (text||''); el.click(); return 'ok' };
`
const js = (code) => ({ js: H + code })
const check = (label, expr) => ({ js: `return 'CHECK ' + ${JSON.stringify(label)} + ': ' + ((${expr}) ? 'PASS' : 'FAIL ' + location.href.slice(0,140) + ' | ' + document.body.innerText.slice(0,160).replace(/\\n/g,' '))` })
async function run(label, steps) {
  const f = `app2-${label}.json`
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

await run('links', [
  // alte Mail-Links (vor dem Umzug verschickt)
  { open: `${W}/passwort-zuruecksetzen?token=ungueltig123` },
  { waitFor: "location.hostname === 'app.tabulasql.de' && document.body && document.body.innerText.length > 50", timeout: 30 },
  { wait: 2 },
  check('L1 alter Reset-Link landet auf app mit Token', "location.pathname === '/passwort-zuruecksetzen' && location.search.includes('token=ungueltig123')"),
  { open: `${W}/email-bestaetigen?token=ungueltig123` },
  { waitFor: "location.hostname === 'app.tabulasql.de' && document.body && document.body.innerText.length > 50", timeout: 30 },
  { wait: 3 },
  check('L2 alter Bestätigungslink landet auf app mit Token', "location.pathname === '/email-bestaetigen' && location.search.includes('token=ungueltig123')"),
  { open: `${W}/login?rolle=lehrkraft` },
  { waitFor: "location.hostname === 'app.tabulasql.de' && document.querySelector('#t-email')", timeout: 30 },
  check('L3 Erinnerungsmail-Link ?rolle=lehrkraft bleibt erhalten', "location.search === '?rolle=lehrkraft' && !!document.querySelector('#t-email')"),
  { open: `${A}/#lehrkraefte` },
  { waitFor: "location.hostname === 'www.tabulasql.de'", timeout: 20 },
  check('L4 app/#lehrkraefte geht zur Website mit Anker', "location.href === 'https://www.tabulasql.de/#lehrkraefte'"),
  { open: `${A}/` },
  { waitFor: "location.pathname === '/login'", timeout: 20 },
  check('L5 app/ ohne Anmeldung zeigt Login', "location.href === 'https://app.tabulasql.de/login' && !!document.querySelector('form')"),
  js(`return __click('a', 'Datenschutz')`),
  { waitFor: "location.hostname === 'www.tabulasql.de'", timeout: 20 },
  check('L6 Datenschutz-Link aus der App führt zu www', "location.pathname === '/datenschutz' && document.body.innerText.includes('app.tabulasql.de')"),
  { open: `${W}/quiz/ABC123` },
  { waitFor: "location.hostname === 'app.tabulasql.de'", timeout: 20 },
  { wait: 2 },
  check('L7 Quiz-Link mit PIN landet auf app', "location.pathname.startsWith('/quiz') || location.pathname === '/login'"),
  js(`return 'INFO quiz landet auf: ' + location.pathname + location.search`),
])

await run('logout', [
  { open: `${A}/login?rolle=lehrkraft` },
  { waitFor: "document.querySelector('#t-email')", timeout: 30 },
  js(`__fill('#t-email', ${JSON.stringify(K.email)}); __fill('#t-pw', ${JSON.stringify(K.password)}); return __click('button[type=submit]')`),
  { waitFor: "location.pathname === '/teach' && document.body.innerText.includes('Testklasse 10a')", timeout: 40 },
  js(`return __click('a', 'Lernen')`),
  { waitFor: "location.pathname === '/learn'", timeout: 20 },
  check('O1 Lernen bleibt in der App (kein Hostwechsel)', "location.hostname === 'app.tabulasql.de'"),
  js(`return __click('.avatar-btn')`),
  { wait: 1 },
  js(`return __click('button', 'Abmelden')`),
  { waitFor: "location.pathname === '/login'", timeout: 20 },
  { wait: 1 },
  check('O2 Abmelden landet auf app/login', "location.href.startsWith('https://app.tabulasql.de/login')"),
  { open: `${A}/` },
  { waitFor: "location.pathname !== '/'", timeout: 20 },
  check('O3 nach Abmelden: app/ zeigt Login', "location.pathname === '/login'"),
  { open: `${A}/teach` },
  { wait: 3 },
  check('O4 /teach ohne Anmeldung verlangt Login', "location.pathname === '/login' || document.body.innerText.includes('Anmelden')"),
])
