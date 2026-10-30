// Voller Ablauf lokal (http://localhost:5194, Wegwerf-DB) im neuen Design:
// Lehrkraft registriert sich, legt Klasse an, Schüler tritt bei, macht Fehler, Lehrkraft sieht Namen + Abfrage,
// erzeugt Einmal-Code, Schüler setzt Passwort zurück, meldet sich an. Nur über die Oberfläche.
import { writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
const B = process.env.BASE || 'http://localhost:5194'
const D = '/Users/muri/.jcode/scratch/onb/loc'
const rnd = Math.random().toString(36).slice(2, 6)
const T = { email: `lk-${rnd}@test.local`, pw: 'geheimnis12', name: 'Anna Prüf' }
const S = { name: 'Lena Test', pw: 'schueler1' }
const BAD = "SELECT title FROM books WHERE year > 'kaputt"
const H = `
window.__fill = (sel, v) => { const el = document.querySelector(sel); if (!el) return 'fehlt ' + sel;
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'ok' };
window.__click = (sel, text) => { const els = [...document.querySelectorAll(sel)].filter(e=>e.offsetParent!==null||e.getClientRects().length); const el = text ? els.find(e => e.textContent.trim().includes(text)) : els[0]; if (!el) return 'fehlt ' + sel + ' ' + (text||''); el.click(); return 'ok' };
window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
`
const js = (code) => ({ js: H + code })
const waitText = (t, timeout = 30) => ({ waitFor: `document.body && document.body.innerText.includes(${JSON.stringify(t)})`, timeout })
const check = (label, expr) => ({ js: `return 'CHECK ' + ${JSON.stringify(label)} + ': ' + ((${expr}) ? 'PASS' : 'FAIL ' + location.pathname + ' | ' + document.body.innerText.slice(0,200).replace(/\\n/g,' '))` })
const results = []
async function run(label, steps, width = 1280) {
  const f = `${D}-${label}.json`
  writeFileSync(f, JSON.stringify({ width, height: 900, steps }))
  const out = await new Promise((res) => {
    let buf = ''
    const p = spawn('/Users/muri/.jcode/scratch/onb/shoot', [f], { stdio: ['ignore', 'pipe', 'pipe'] })
    const t = setTimeout(() => { buf += '\nABBRUCH ' + label; p.kill('SIGKILL') }, 300000)
    p.stdout.on('data', (d) => (buf += d)); p.stderr.on('data', (d) => (buf += d))
    p.on('close', () => { clearTimeout(t); res(buf) })
  })
  for (const line of out.split('\n')) if (/CHECK|TIMEOUT|FEHLER|fehlt|ABBRUCH|INFO/.test(line)) { console.log(`[${label}] ${line}`); results.push(line) }
}
const save = (name, expr) => js(`const v = (${expr}); return 'INFO SAVE ${name}=' + v`)
const grab = (label, name) => { const l = results.find((r) => r.includes(`SAVE ${name}=`)); return l ? l.split(`SAVE ${name}=`)[1].trim() : '' }

// 1) Lehrkraft registriert sich und legt Klasse an
await run('lehrkraft-neu', [
  { open: `${B}/login?rolle=lehrkraft` },
  { waitFor: "document.querySelector('#t-email')", timeout: 30 },
  js(`return __click('button', 'Lehrer-Konto erstellen')`),
  { waitFor: "document.querySelector('#regl-name')", timeout: 15 },
  js(`__fill('#regl-name', ${JSON.stringify(T.name)}); __fill('#regl-email', ${JSON.stringify(T.email)}); __fill('#regl-pw', ${JSON.stringify(T.pw)}); __fill('#regl-pw2', ${JSON.stringify(T.pw)}); const cb=[...document.querySelectorAll('input[type=checkbox]')].find(c=>c.offsetParent); cb.click(); return __click('button[type=submit]')`),
  waitText('Wiederherstellungscode', 40),
  check('T1 Registrierung zeigt Wiederherstellungscode', "/[a-zäöü]+(-[a-zäöü]+){5,}/.test(document.body.innerText)"),
  js(`const cb=[...document.querySelectorAll('input[type=checkbox]')].find(c=>c.offsetParent); cb.click(); await __sleep(300); return __click('button', 'Weiter zu meinen Klassen')`),
  { waitFor: "location.pathname === '/teach'", timeout: 20 },
  { wait: 2 },
  check('T2 Lehrkraft landet bei Klassen', "location.pathname === '/teach'"),
  { shot: `${D}-teach-leer.png` },
  { open: `${B}/teach/neu` },
  { waitFor: "document.querySelector('input')", timeout: 20 },
  js(`const i=[...document.querySelectorAll('input[type=text],input:not([type])')].find(x=>x.offsetParent); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Prüfklasse 10b'); i.dispatchEvent(new Event('input',{bubbles:true})); return __click('button[type=submit]')`),
  { waitFor: "/[a-z]+-[a-z]+-[a-z]+-\\d{2}/.test(document.body.innerText)", timeout: 30 },
  check('T3 Klasse angelegt, Klassencode sichtbar', "/[a-z]+-[a-z]+-[a-z]+-\\d{2}/.test(document.body.innerText)"),
  save('code', "(document.body.innerText.match(/[a-z]+-[a-z]+-[a-z]+-\\d{2}/)||[''])[0]"),
  { shot: `${D}-klasse-neu.png` },
])
const CODE = grab('lehrkraft-neu', 'code')
console.log('Klassencode:', CODE)

// 2) Schüler tritt bei und macht Fehler in einer Übung
await run('schueler-beitritt', [
  { open: `${B}/beitreten/${CODE}` },
  waitText('Dein Name', 40),
  js(`__fill('input[placeholder="z. B. Lena S."]', ${JSON.stringify(S.name)}); for (const p of document.querySelectorAll('input[type=password]')) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(p,${JSON.stringify(S.pw)}); p.dispatchEvent(new Event('input',{bubbles:true})) } return __click('button[type=submit]')`),
  waitText('Willkommen', 40),
  check('S1 Beitritt', "document.body.innerText.includes('Willkommen')"),
  { shot: `${D}-beitritt-ok.png` },
  js(`return __click('button, a', 'Los geht')`),
  { waitFor: "location.pathname === '/learn'", timeout: 30 },
  { wait: 2 },
  check('S2 Lernen nach Beitritt', "location.pathname === '/learn'"),
  { shot: `${D}-learn-schueler.png` },
  { open: `${B}/learn/beginner/where-filters` },
  { waitFor: "/SCHRITT/i.test(document.body.innerText)", timeout: 60 },
  { wait: 2 },
  js(`for (let k=0;k<8;k++){ const has=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Ausführen')) && document.querySelector('textarea'); const t=document.body.innerText; if (has && /Übung/i.test(t)) break; const n=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Weiter') && !b.disabled); if(!n) break; n.click(); await __sleep(900) } return 'INFO Stand ' + (document.body.innerText.match(/SCHRITT\\s*\\d+\\s*\\/\\s*\\d+/i)||['?'])[0]`),
  js(`__fill('textarea', ${JSON.stringify(BAD)}); for (let k=0;k<3;k++){ __click('button', 'Ausführen'); await __sleep(1000) } return 'ok'`),
  { wait: 3 },
  check('S3 Fehlermeldung sichtbar', "/unrecognized token|Text ohne|Anführungszeichen/i.test(document.body.innerText)"),
  { shot: `${D}-studio-fehler.png` },
])

// 3) Lehrkraft sieht Namen + Abfrage, erzeugt Einmal-Code
await run('lehrkraft-sieht', [
  { open: `${B}/login?rolle=lehrkraft` },
  { waitFor: "document.querySelector('#t-email')", timeout: 30 },
  js(`__fill('#t-email', ${JSON.stringify(T.email)}); __fill('#t-pw', ${JSON.stringify(T.pw)}); return __click('button[type=submit]')`),
  waitText('Prüfklasse 10b', 40),
  js(`const el=[...document.querySelectorAll('a,button,tr,[role=link]')].find(e=>e.textContent.includes('Prüfklasse 10b')); el.click(); return 'ok'`),
  waitText(S.name, 40),
  { wait: 3 },
  check('T4 Name entschlüsselt in der Übersicht', `document.body.innerText.includes(${JSON.stringify(S.name)})`),
  check('T5 Status hängt fest sichtbar', "/hängt fest|brauchen hilfe|braucht hilfe/i.test(document.body.innerText)"),
  { shot: `${D}-uebersicht.png` },
  js(`const el=[...document.querySelectorAll('button,a,tr,[role=button]')].filter(e=>e.textContent.includes(${JSON.stringify(S.name)})); (el.find(e=>/Ansehen/.test(e.textContent))||el[el.length-1]).click(); await __sleep(800); const a=[...document.querySelectorAll('button,a')].find(b=>/Ansehen/.test(b.textContent)); if(a && !document.body.innerText.includes("kaputt")) a.click(); return 'ok'`),
  { wait: 3 },
  check('T6 Letzte Abfrage entschlüsselt', `document.body.innerText.includes("kaputt")`),
  { shot: `${D}-drawer.png` },
  js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await __sleep(300); return __click('a', 'Schüler')`),
  waitText(S.name, 20),
  { wait: 2 },
  js(`const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes(${JSON.stringify(S.name)}) || x.textContent.trim()==='⋯'); b.click(); await __sleep(500); return __click('button', 'Code erzeugen')`),
  waitText('Gültig', 20),
  save('reset', "(document.body.innerText.match(/\\b[A-Z0-9]{8}\\b/)||[''])[0]"),
  { shot: `${D}-einmalcode.png` },
  js(`return __click('button', 'QR')`),
  { wait: 2 },
  check('T7 QR-Dialog mit Beitritts-Adresse', "/beitreten/.test(document.body.innerText)"),
  { shot: `${D}-qr.png` },
])
const RESET = grab('lehrkraft-sieht', 'reset')
console.log('Einmal-Code:', RESET)

// 4) Schüler: Passwort vergessen mit Einmal-Code, dann normaler Login
await run('schueler-reset', [
  { open: `${B}/login` },
  { waitFor: "document.querySelector('#cl-code')", timeout: 30 },
  js(`return __click('button, a', 'Passwort vergessen')`),
  { waitFor: "document.querySelector('#sr-code, #sr-rc')", timeout: 15 },
  js(`__fill('#sr-code', ${JSON.stringify(CODE)}); __fill('#sr-name', ${JSON.stringify(S.name)}); __fill('#sr-rc', ${JSON.stringify(RESET)}); __fill('#sr-pw', 'zweitesPw2'); __fill('#sr-pw2', 'zweitesPw2'); return __click('button[type=submit]')`),
  { waitFor: "location.pathname.startsWith('/learn')", timeout: 60 },
  check('S4 Einmal-Code setzt neues Passwort', "location.pathname.startsWith('/learn')"),
  js(`__click('.avatar-btn'); await __sleep(400); return __click('button', 'Abmelden')`),
  { waitFor: "location.pathname === '/login'", timeout: 20 },
  { waitFor: "document.querySelector('#cl-code')", timeout: 20 },
  js(`__fill('#cl-code', ${JSON.stringify(CODE)}); __fill('#cl-name', ${JSON.stringify(S.name)}); __fill('#cl-pw', 'zweitesPw2'); return __click('button[type=submit]')`),
  { waitFor: "location.pathname.startsWith('/learn')", timeout: 60 },
  check('S5 Login mit neuem Passwort', "location.pathname.startsWith('/learn')"),
  { open: `${B}/profil` },
  { wait: 3 },
  check('S6 Profil Schüler zeigt Klasse verlassen', "/Klasse verlassen/.test(document.body.innerText)"),
  { shot: `${D}-profil-schueler.png` },
])

const pass = results.filter((r) => /: PASS/.test(r)).length
const fail = results.filter((r) => /FAIL|ABBRUCH|TIMEOUT|fehlt|FEHLER/.test(r)).length
console.log(`\nErgebnis: ${pass} bestanden, ${fail} Probleme`)
