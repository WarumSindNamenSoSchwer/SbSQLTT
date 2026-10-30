// Prüft alle Seiten (lokal oder live) auf Requests an fremde Hosts und auf sichtbare Fehler.
// node ext-check.mjs [basis-www] [basis-app]
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const WWW = process.argv[2] || 'http://localhost:5194'
const APP = process.argv[3] || WWW
const pages = [WWW + '/', WWW + '/datasets', WWW + '/impressum', WWW + '/datenschutz', WWW + '/kontakt', WWW + '/gibtsnicht',
  APP + '/learn', APP + '/learn/beginner/where-filters', APP + '/learn/python/python', APP + '/login', APP + '/beitreten', APP + '/quiz']
const allowed = new Set([new URL(WWW).host, new URL(APP).host])
const f = '/Users/muri/.jcode/scratch/onb/ext-check.json'
const steps = []
for (const p of pages) {
  steps.push({ open: p }, { wait: 4 }, { js: `const hosts=[...new Set(performance.getEntriesByType('resource').map(r=>{try{return new URL(r.name).host}catch(e){return ''}}).filter(Boolean))]; const bad=hosts.filter(h=>!${JSON.stringify([...allowed])}.includes(h)); const t=document.body.innerText; return 'PAGE ${p} ext='+(bad.join(',')||'none')+' len='+t.length+' err='+(/konnte nicht geladen|Internal Error|is not defined/.test(t)?'JA':'nein')` })
}
writeFileSync(f, JSON.stringify({ width: 1280, height: 800, steps }))
const out = execFileSync('/Users/muri/.jcode/scratch/onb/shoot', [f], { encoding: 'utf8', maxBuffer: 1e8 })
for (const l of out.split('\n')) if (l.includes('PAGE ') || /TIMEOUT|FEHLER/.test(l)) console.log(l.replace(/^JS \d+: /, ''))
