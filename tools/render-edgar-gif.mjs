// Rendert Edgar-Animationen aus owl-gen.js als GIF-Einzelbilder (für E-Mails, die kein CSS animieren).
// Wertet die CSS-Keyframes der Animation selbst aus und schreibt pro Bild ein SVG mit festen transform-Attributen.
// Aufruf: node tools/render-edgar-gif.mjs <pose> <breite px> <fps> <ausgabeordner>
// Braucht @resvg/resvg-js (npx --yes -p @resvg/resvg-js@2.6.2 ...). Danach mit ffmpeg zum GIF:
//   ffmpeg -framerate 25 -i <ordner>/f%03d.png -vf "split[a][b];[a]palettegen=max_colors=32[p];[b][p]paletteuse=dither=none" -loop 0 server/assets/mail/edgar-<pose>.gif
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import G from "../src/lib/edgar/owl-gen.js"

const [pose, width = '240', fps = '25', out = './frames'] = process.argv.slice(2)
const [state, css] = G.ANIMS[pose]
const base = G.owl({ ...state })
mkdirSync(out, { recursive: true })

// --- CSS parsen ---------------------------------------------------------------
function blocks(src) {
  const res = []; let i = 0
  while (i < src.length) {
    const o = src.indexOf('{', i); if (o < 0) break
    let d = 1, j = o + 1; while (d && j < src.length) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++ }
    res.push([src.slice(i, o).trim(), src.slice(o + 1, j - 1)]); i = j
  }
  return res
}
const keyframes = {}, rules = []
for (const [sel, body] of blocks(css)) {
  if (sel.startsWith('@keyframes')) {
    const name = sel.split(/\s+/)[1]; const stops = []
    for (const [s, decl] of blocks(body)) for (const p of s.split(',')) {
      const pct = p.trim() === 'from' ? 0 : p.trim() === 'to' ? 100 : parseFloat(p)
      stops.push([pct / 100, decls(decl)])
    }
    keyframes[name] = stops.sort((a, b) => a[0] - b[0])
  } else {
    const d = decls(body)
    if (!d.animation) continue
    for (const s of sel.split(',')) rules.push({ cls: s.trim().replace(/^\./, ''), anim: parseAnim(d.animation), origin: d['transform-origin'] })
  }
}
function decls(s) { const o = {}; for (const part of s.split(';')) { const k = part.indexOf(':'); if (k > 0) o[part.slice(0, k).trim()] = part.slice(k + 1).trim() } return o }
function parseAnim(a) {
  const toks = a.match(/cubic-bezier\([^)]*\)|steps\([^)]*\)|\S+/g)
  const times = toks.filter(t => /^-?[\d.]+s$/.test(t)).map(parseFloat)
  const timing = toks.find(t => /^(cubic-bezier|steps|ease|linear)/.test(t)) || 'ease'
  return { name: toks[0], dur: times[0], delay: times[1] || 0, timing, alternate: toks.includes('alternate') }
}
if (rules.some(r => r.cls.includes(' '))) throw new Error('Nachfahren-Selektoren nicht unterstützt: ' + pose)

// --- Zeitfunktionen -------------------------------------------------------------
function bezier(x1, y1, x2, y2) {
  return x => { let lo = 0, hi = 1, t = x; for (let i = 0; i < 40; i++) { t = (lo + hi) / 2; const bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3; if (bx < x) lo = t; else hi = t } return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3 }
}
function ease(name) {
  if (name.startsWith('cubic-bezier')) return bezier(...name.match(/[\d.]+/g).map(Number))
  if (name.startsWith('steps')) return () => 0
  if (name === 'linear') return x => x
  if (name === 'ease-in') return bezier(0.42, 0, 1, 1)
  if (name === 'ease-out') return bezier(0, 0, 0.58, 1)
  if (name === 'ease-in-out') return bezier(0.42, 0, 0.58, 1)
  return bezier(0.25, 0.1, 0.25, 1)
}

// --- Transform-Werte --------------------------------------------------------------
const ID = { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 }
function parseTransform(s) {
  const v = { ...ID }; const order = []
  for (const [, fn, args] of (s || '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = args.split(/[\s,]+/).filter(Boolean).map(parseFloat)
    if (fn === 'translate') { v.translateX = a[0]; v.translateY = a[1] ?? 0; order.push('t') }
    else if (fn === 'translateX') { v.translateX = a[0]; order.push('t') }
    else if (fn === 'translateY') { v.translateY = a[0]; order.push('t') }
    else if (fn === 'rotate') { v.rotate = a[0]; order.push('r') }
    else if (fn === 'scale') { v.scaleX = a[0]; v.scaleY = a[1] ?? a[0]; order.push('s') }
  }
  return { v, order }
}
function valueAt(name, p, timing) {
  const stops = keyframes[name]
  const full = [...stops]
  if (full[0][0] > 0) full.unshift([0, {}])
  if (full.at(-1)[0] < 1) full.push([1, {}])
  let i = 0; while (i < full.length - 2 && p > full[i + 1][0]) i++
  const [p0, d0] = full[i], [p1, d1] = full[i + 1]
  const local = p1 === p0 ? 0 : ease(timing)((p - p0) / (p1 - p0))
  const a = parseTransform(d0.transform), b = parseTransform(d1.transform)
  const v = {}; for (const k in ID) v[k] = a.v[k] + (b.v[k] - a.v[k]) * local
  const o0 = d0.opacity ?? 1, o1 = d1.opacity ?? 1
  const order = (b.order.length >= a.order.length ? b.order : a.order)
  return { v, order: [...new Set(order)], opacity: +o0 + (+o1 - +o0) * local, hasT: !!(d0.transform || d1.transform), hasO: d0.opacity != null || d1.opacity != null }
}
function svgTransform({ v, order }, [ox, oy]) {
  const parts = order.map(o => o === 't' ? `translate(${v.translateX.toFixed(3)} ${v.translateY.toFixed(3)})` : o === 'r' ? `rotate(${v.rotate.toFixed(3)})` : `scale(${v.scaleX.toFixed(4)} ${v.scaleY.toFixed(4)})`)
  return `translate(${ox} ${oy}) ${parts.join(' ')} translate(${-ox} ${-oy})`
}

// --- Bilder erzeugen --------------------------------------------------------------
const cycles = rules.map(r => r.anim.dur * (r.anim.alternate ? 2 : 1))
const gcdish = (a, b) => { a = Math.round(a * 100); b = Math.round(b * 100); while (b) [a, b] = [b, a % b]; return a / 100 }
const loop = cycles.reduce((l, c) => l * c / gcdish(l, c))
const n = Math.round(loop * +fps)
for (let f = 0; f < n; f++) {
  const t = f / +fps
  let svg = base
  for (const r of rules) {
    let tt = t - r.anim.delay; if (tt < 0) tt += Math.ceil(-tt / r.anim.dur) * r.anim.dur
    const k = Math.floor(tt / r.anim.dur); let p = (tt % r.anim.dur) / r.anim.dur
    if (r.anim.alternate && k % 2 === 1) p = 1 - p
    const val = valueAt(r.anim.name, p, r.anim.timing)
    const re = new RegExp(`<g class="${r.cls}"( style="transform-origin:([\\d.]+)px ([\\d.]+)px")?`)
    const m = svg.match(re); if (!m) continue
    let origin = m[1] ? [+m[2], +m[3]] : [0, 0]
    if (r.origin) origin = r.origin.match(/[\d.]+/g).map(Number)
    let attrs = ''
    if (val.hasT) attrs += ` transform="${svgTransform(val, origin)}"`
    if (val.hasO) attrs += ` opacity="${val.opacity.toFixed(3)}"`
    svg = svg.replace(re, `<g class="${r.cls}"${attrs}`)
  }
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: +width }, background: '#ffffff' }).render().asPng()
  writeFileSync(`${out}/f${String(f).padStart(3, '0')}.png`, png)
}
console.log(pose, 'Bilder:', n, 'Dauer:', loop, 's')
