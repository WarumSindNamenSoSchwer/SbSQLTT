// Live-Quiz lokal: Lehrkraft startet Quiz (Beamer), Schüler tritt mit PIN bei (Handy), beantwortet eine Frage.
// Parallel laufen zwei shoot-Prozesse (Beamer und Handy). Voraussetzung: local-e2e.mjs lief (Konten).
import { writeFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
const B = 'http://localhost:5194'
const D = '/Users/muri/.jcode/scratch/onb/quiz'
const [email, pw, code, sname, spw] = process.argv.slice(2)
let pin = ''
const H = `window.__fill=(s,v)=>{const el=document.querySelector(s);if(!el)return 'fehlt '+s;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'};
window.__click=(s,t)=>{const els=[...document.querySelectorAll(s)].filter(e=>e.getClientRects().length);const el=t?els.find(e=>e.textContent.trim().includes(t)):els[0];if(!el)return 'fehlt '+s+' '+(t||'');el.click();return 'ok'};window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));`
const js = (c) => ({ js: H + c })
const check = (l, e) => ({ js: `return 'CHECK ${l}: '+((${e})?'PASS':'FAIL '+location.pathname+' | '+document.body.innerText.slice(0,240).replace(/\\n/g,' '))` })
function run(label, steps, w, h) {
  writeFileSync(`${D}-${label}.json`, JSON.stringify({ width: w, height: h, steps }))
  return new Promise((res) => {
    let buf = ''; const p = spawn('/Users/muri/.jcode/scratch/onb/shoot', [`${D}-${label}.json`], { stdio: ['ignore', 'pipe', 'pipe'] })
    p.stdout.on('data', (d) => { buf += d; const m = String(d).match(/PIN=([A-Z0-9]{4,8})/); if (m) pin = m[1] }); p.stderr.on('data', (d) => (buf += d))
    p.on('close', () => { for (const l of buf.split('\n')) if (/CHECK|TIMEOUT|fehlt|PIN=|INFO|los disabled/.test(l)) console.log(`[${label}] ${l}`); res(buf) })
  })
}
const beamer = run('beamer', [
  { open: `${B}/login?rolle=lehrkraft` }, { waitFor: "document.querySelector('#t-email')", timeout: 30 },
  js(`__fill('#t-email',${JSON.stringify(email)});__fill('#t-pw',${JSON.stringify(pw)});return __click('button[type=submit]')`),
  { waitFor: "location.pathname==='/teach'", timeout: 30 }, { wait: 2 },
  { open: `${B}/teach/quiz` }, { wait: 4 },
  js(`return __click('button','Starten')`),
  { waitFor: "location.pathname.includes('/teach/quiz/live/')", timeout: 30 },
  { waitFor: "/\\b\\d{6}\\b|[A-Z0-9]{6}/.test(document.body.innerText)", timeout: 30 },
  js(`const m=document.body.innerText.match(/quiz\\/([A-Z0-9]{4,8})/i)||document.body.innerText.match(/\\b([A-Z0-9]{6})\\b/); require=null; return 'PIN='+(m?m[1]:'')`),
  { shot: `${D}-beamer-lobby.png` },
  { waitFor: "/1 von 1|1 Teilnehm|1 sind/i.test(document.body.innerText)", timeout: 90 },
  check('Q0 Beamer sieht Schüler in der Lobby', "/1 von 1|1 sind/i.test(document.body.innerText)"),
  { shot: `${D}-beamer-lobby2.png` },
  { waitFor: "[...document.querySelectorAll('button')].some(x=>x.textContent.includes('Los') && !x.disabled)", timeout: 30 },
  js(`const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Los')); return 'los disabled='+b?.disabled+' '+(b?.click(),'geklickt')`),
  { wait: 6 },
  { wait: 3 },
  check('Q3 Beamer zeigt Frage', "/FRAGE\\s*1/i.test(document.body.innerText)"),
  js(`return 'INFO beamer: '+document.body.innerText.slice(0,200).replace(/\\n/g,' ')`),
  { shot: `${D}-beamer-frage.png` },
  { wait: 6 },
  { shot: `${D}-beamer-frage2.png` },
  { wait: 22 },
  { shot: `${D}-beamer-nach.png` },
], 1440, 900)
for (let i=0;i<40 && !pin;i++){ await new Promise(r=>setTimeout(r,1000)) }
const HANDY = [
  { open: `${B}/login` }, { waitFor: "document.querySelector('#cl-code')", timeout: 30 },
  js(`__fill('#cl-code',${JSON.stringify(code)});__fill('#cl-name',${JSON.stringify(sname)});__fill('#cl-pw',${JSON.stringify(spw)});return __click('button[type=submit]')`),
  { waitFor: "location.pathname.startsWith('/learn')", timeout: 40 },
  { open: `${B}/quiz/__PIN__` },
  { js: "window.__ws=[]; const O=WebSocket.prototype.send; WebSocket.prototype.send=function(d){ window.__ws.push('>'+String(d).slice(0,120)); if(!this.__h){ this.__h=1; this.addEventListener('message',e=>window.__ws.push('<'+String(e.data).slice(0,120))) } return O.call(this,d) }; return 'hook'" },
  { wait: 6 },
  check('Q1 Handy kommt über QR-Adresse /quiz/PIN rein', "location.pathname.startsWith('/quiz/') && !/PIN eingeben/.test(document.body.innerText)"),
  { shot: `${D}-handy-lobby.png` },
  { shot: `${D}-handy-lobby.png` },
  check('Q2 Schüler im Quiz-Raum', "location.pathname.startsWith('/quiz/')"),
  { waitFor: "/FRAGE\\s*1/i.test(document.body.innerText)", timeout: 90 },
  { shot: `${D}-handy-frage.png` },
  js(`const b=[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length && !e.disabled && /Zeigt alle Spalten/.test(e.textContent)); if(b.length) { b[0].click(); return 'INFO antwort '+b[0].textContent.trim().slice(0,30)} return 'INFO keine Antwortknöpfe'`),
  { wait: 3 },
  js(`return 'INFO nach Klick: '+document.body.innerText.slice(0,200).replace(/\\n/g,' ')+' disabled='+[...document.querySelectorAll('.opt-tile')].map(b=>b.disabled).join(',')`),
  { shot: `${D}-handy-antwort.png` },
  { js: "return 'INFO WS: '+(window.__ws||[]).join(' || ')" },
  check('Q4 Antwort angenommen', "/Antwort|gespeichert|Warte|Punkte|richtig|falsch/i.test(document.body.innerText)"),
]
const handy = run('handy', JSON.parse(JSON.stringify(HANDY).replaceAll('__PIN__', pin)), 390, 844)
console.log('PIN', pin)
await Promise.all([beamer, handy])
