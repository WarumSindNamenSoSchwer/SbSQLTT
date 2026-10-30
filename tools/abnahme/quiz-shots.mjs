// Quiz-Screenshots: Lehrkraft (Beamer) und Schüler (Handy) laufen parallel mit getrennten Sitzungen.
import { writeFileSync, readFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'

const K = JSON.parse(readFileSync('/Users/muri/.jcode/scratch/testkonto.json'))
const B = 'https://app.tabulasql.de'
const CID = 4
const SYNC = '/Users/muri/.jcode/scratch/onb/sync'
for (const f of ['pin', 'joined', 'answered', 'phase2']) rmSync(`${SYNC}-${f}`, { force: true })

const H = `
window.__fill = (sel, v) => { const el = document.querySelector(sel); if (!el) return 'fehlt ' + sel;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok' };
window.__click = (sel, text) => { const els = [...document.querySelectorAll(sel)]; const el = text ? els.find(e => e.textContent.trim().includes(text)) : els[0]; if (!el) return 'fehlt ' + sel + ' ' + (text||''); el.click(); return 'ok' };
window.__nav = (path) => { const a = document.createElement('a'); a.href = path; document.body.appendChild(a); a.click(); a.remove(); return 'ok' };
`
const js = (code) => ({ js: H + code })
const waitText = (t, timeout = 30) => ({ waitFor: `document.body && document.body.innerText.includes(${JSON.stringify(t)})`, timeout })
const mark = (name) => ({ saveJs: '"ok"', saveTo: `${SYNC}-${name}` })

const teacher = { width: 1920, height: 1080, steps: [
  { open: `${B}/login?rolle=lehrkraft` },
  { waitFor: "document.querySelector('#t-email')" },
  js(`__fill('#t-email', ${JSON.stringify(K.email)}); __fill('#t-pw', ${JSON.stringify(K.password)}); return __click('button[type=submit]')`),
  waitText('Testklasse 10a', 40),
  js(`return __nav('/teach/quiz?klasse=${CID}')`),
  waitText('Quiz starten'),
  { wait: 1 },
  js(`const rows=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Starten'); rows[2].click(); return 'ok'`),
  { waitFor: "document.querySelector('.pin-mono')", timeout: 30 },
  { saveJs: "document.querySelector('.pin-mono').textContent.trim()", saveTo: `${SYNC}-pin` },
  { wait: 1.5 },
  { shot: 'shots/q01-lobby-leer.png' },
  { waitFile: `${SYNC}-joined`, timeout: 90 },
  { waitFor: "document.querySelector('.chip')", timeout: 20 },
  { wait: 1.5 },
  { shot: 'shots/q02-lobby.png', marks: [['.pin-mono', ''], ['.btn-los', '']] },
  js(`return __click('.btn-los')`),
  { wait: 2.5 },
  { shot: 'shots/q03-frage-beamer.png' },
  { waitFile: `${SYNC}-answered`, timeout: 90 },
  { wait: 1 },
  js(`return __click('.btn-skip')`),
  { wait: 2.5 },
  { shot: 'shots/q04-aufloesung-beamer.png', marks: [['.btn-weiter', '']] },
  mark('phase2'),
  { wait: 3 },
  js(`return __click('.btn-weiter')`),
  { wait: 2.5 },
  { shot: 'shots/q05-zwischenstand-beamer.png' },
  js(`return __click('.btn-naechste')`),
  { waitFor: "document.querySelector('.btn-skip')", timeout: 20 },
  { wait: 1 },
  js(`return __click('.btn-skip')`),
  { wait: 1.5 },
  js(`return __click('.btn-weiter')`),
  { wait: 1 },
  js(`for (let k=0;k<10;k++){ const b=document.querySelector('.btn-naechste'); if(!b) break; if(b.textContent.includes('Ergebnis')){ b.click(); break } b.click(); await new Promise(r=>setTimeout(r,1500)); const s=document.querySelector('.btn-skip'); if(s) s.click(); await new Promise(r=>setTimeout(r,1500)); const w=document.querySelector('.btn-weiter'); if(w) w.click(); await new Promise(r=>setTimeout(r,800)) } return 'durch'`),
  { waitFor: "document.querySelector('.podium')", timeout: 60 },
  { wait: 2 },
  { shot: 'shots/q06-ende-beamer.png' },
  { js: "const b=document.querySelector('.btn-auswertung').getBoundingClientRect(); return 'CHECK Q1 Auswertung-Knopf ganz sichtbar: ' + (b.right <= innerWidth && b.left >= 0 ? 'PASS' : 'FAIL right=' + b.right + ' w=' + innerWidth)" },
] }

const phone = { width: 390, height: 780, mobile: true, steps: [
  { open: `${B}/login` },
  { waitFor: "document.querySelector('#cl-code')" },
  js(`__fill('#cl-code', ${JSON.stringify(K.join_code)}); __fill('#cl-name', 'Mia Test'); __fill('#cl-pw', 'schueler1'); return __click('button[type=submit]')`),
  { waitFor: "location.pathname.startsWith('/learn')", timeout: 40 },
  { waitFile: `${SYNC}-pin`, timeout: 120 },
  { openFrom: `${SYNC}-pin`, openTpl: `${B}/quiz?pin={file}` },
  { waitFor: "document.querySelector('input')", timeout: 20 },
  { wait: 1 },
  { shot: 'shots/p01-pin.png' },
  js(`return __click('button', 'Beitreten')`),
  waitText('Du bist drin', 30),
  { wait: 1 },
  { shot: 'shots/p02-drin.png' },
  mark('joined'),
  { waitFor: "document.querySelector('.opt-tile')", timeout: 90 },
  { wait: 1 },
  { shot: 'shots/p03-frage.png' },
  js(`document.querySelectorAll('.opt-tile')[1].click(); return 'ok'`),
  { wait: 1 },
  { shot: 'shots/p04-gespeichert.png' },
  mark('answered'),
  { waitFile: `${SYNC}-phase2`, timeout: 90 },
  { wait: 0.5 },
  { shot: 'shots/p05-aufloesung.png' },
  waitText('Quiz beendet', 120),
  { wait: 1 },
  { shot: 'shots/p06-ende.png' },
] }

writeFileSync('q-teacher.json', JSON.stringify(teacher))
writeFileSync('q-phone.json', JSON.stringify(phone))
const run = (f) => new Promise((res) => { const p = spawn('./shoot', [f]); p.stdout.on('data', (d) => process.stdout.write(`[${f}] ${d}`)); p.stderr.on('data', (d) => process.stdout.write(`[${f}!] ${d}`)); p.on('close', res) })
await Promise.all([run('q-teacher.json'), run('q-phone.json')])
