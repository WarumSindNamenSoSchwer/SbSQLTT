// Tabula: kleiner Template-Renderer ohne Framework und ohne externe Abhängigkeiten.
// Template-Syntax (wie in den Entwürfen, nah an Svelte):
//   {{ pfad }}                        Wert einsetzen (escaped)
//   <sc-for list="{{ xs }}" as="x">   Schleife   (Svelte: {#each xs as x})
//   <sc-if value="{{ b }}">           Bedingung  (Svelte: {#if b})
//   onClick="{{ fn }}" usw.           Event-Handler
//   ref="{{ r }}"                     Element-Referenz (r.current)
//   value="{{ v }}"                   Wert von textarea/input
//   disabled="{{ b }}"                Boolesches Attribut
// Die Seitenlogik ist eine Klasse mit state, setState(), renderVals() und den
// Lebenszyklen componentDidMount / componentDidUpdate / componentWillUnmount.

window.React = window.React || { createRef: () => ({ current: null }) };

const TAG = /<sc-for\s([^>]*)>|<\/sc-for>|<sc-if\s([^>]*)>|<\/sc-if>/g;
const HOLE = /(\s)(on[A-Z]\w*|ref|value|disabled|hidden)="\{\{\s*([\w.$]+)\s*\}\}"|\{\{\s*([\w.$]+)\s*\}\}/g;
const EVT = { onClick: 'click', onChange: 'input', onInput: 'input', onKeyDown: 'keydown', onMouseEnter: 'mouseenter', onMouseLeave: 'mouseleave', onFocus: 'focus', onBlur: 'blur', onScroll: 'scroll' };
const holeOf = s => ((s || '').match(/\{\{\s*([\w.$]+)\s*\}\}/) || [])[1];
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function compileText(s) {
  const parts = []; let last = 0, m;
  HOLE.lastIndex = 0;
  while ((m = HOLE.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    last = HOLE.lastIndex;
    if (m[2]) parts.push({ ws: m[1], kind: m[2], path: m[3] });
    else parts.push({ kind: 'text', path: m[4] });
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
function parse(src) {
  const root = { kids: [] }, stack = [root]; let last = 0, m;
  const text = s => s && stack[stack.length - 1].kids.push({ t: 'text', parts: compileText(s) });
  TAG.lastIndex = 0;
  while ((m = TAG.exec(src))) {
    text(src.slice(last, m.index)); last = TAG.lastIndex;
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<sc-for')) { const a = {}; m[1].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { a[k] = v; }); const n = { t: 'for', list: holeOf(a.list), as: a.as, kids: [] }; top.kids.push(n); stack.push(n); }
    else if (m[0].startsWith('<sc-if')) { const n = { t: 'if', val: holeOf((m[2].match(/value="([^"]*)"/) || [])[1]), kids: [] }; top.kids.push(n); stack.push(n); }
    else if (stack.length > 1) stack.pop();
  }
  text(src.slice(last));
  return root;
}
function get(scope, path) {
  if (path === 'true') return true; if (path === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
  let v = scope; for (const k of path.split('.')) { if (v == null) return undefined; v = v[k]; } return v;
}
function render(node, scope, H, out) {
  for (const n of node.kids) {
    if (n.t === 'text') {
      for (const p of n.parts) {
        if (typeof p === 'string') { out.push(p); continue; }
        if (p.kind === 'ref') { out.push(p.ws + 'data-ref="' + p.path + '"'); continue; }
        const v = get(scope, p.path);
        if (p.kind === 'text') out.push(v == null ? '' : typeof v === 'function' ? String(H.push(v) - 1) : esc(v));
        else if (p.kind === 'value') out.push(p.ws + 'data-value="' + esc(v == null ? '' : v) + '"');
        else if (p.kind === 'disabled' || p.kind === 'hidden') { if (v) out.push(p.ws + p.kind); }
        else if (typeof v === 'function') { const e = EVT[p.kind] || p.kind.slice(2).toLowerCase(); out.push(p.ws + 'data-on-' + e + '="' + (H.push(v) - 1) + '"'); }
      }
    } else if (n.t === 'if') { if (get(scope, n.val)) render(n, scope, H, out); }
    else if (n.t === 'for') {
      const list = get(scope, n.list) || [];
      list.forEach((item, i) => { const s = Object.create(scope); s[n.as] = item; s.$index = i; render(n, s, H, out); });
    }
  }
}

const keep = el => el.hasAttribute('data-owl') || el.hasAttribute('data-owl-icon') || el.hasAttribute('data-keep') || el.tagName === 'TEXTAREA';
function stamp(el) {
  if (el.nodeType !== 1) return;
  const t = {}; for (const a of el.attributes) t[a.name] = a.value; el.__t = t;
  for (const c of el.children) stamp(c);
}
function syncAttrs(o, n) {
  const prev = o.__t || {}, cur = {};
  for (const a of n.attributes) { cur[a.name] = a.value; if (prev[a.name] !== a.value || !o.hasAttribute(a.name)) o.setAttribute(a.name, a.value); }
  for (const k in prev) if (!(k in cur)) o.removeAttribute(k);
  o.__t = cur;
}
function morph(live, next) {
  const a = [...live.childNodes], b = [...next.childNodes];
  b.forEach((n, i) => {
    const o = a[i];
    if (!o) { live.appendChild(n); stamp(n); return; }
    if (o.nodeType !== n.nodeType || (o.nodeType === 1 && o.tagName !== n.tagName)) { live.replaceChild(n, o); stamp(n); return; }
    if (o.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; return; }
    syncAttrs(o, n);
    if (!keep(o)) morph(o, n);
  });
  for (let i = a.length - 1; i >= b.length; i--) a[i].remove();
}
function bind(root, vals, H) {
  root.querySelectorAll('*').forEach(el => {
    const evs = el.__evs || [], now = [];
    for (const a of el.attributes) if (a.name.startsWith('data-on-')) { const e = a.name.slice(8), fn = H[+a.value]; el['on' + e] = fn ? ev => fn(ev) : null; now.push(e); }
    evs.forEach(e => { if (!now.includes(e)) el['on' + e] = null; });
    el.__evs = now;
    if (el.hasAttribute('data-ref')) { const r = get(vals, el.getAttribute('data-ref')); if (r && typeof r === 'object') r.current = el; }
    if (el.hasAttribute('data-value')) { const v = el.getAttribute('data-value'); if (el.value !== v) el.value = v; }
  });
}

export class DCLogic {
  constructor() { this.props = {}; this.state = {}; }
  setState(u, cb) {
    const p = typeof u === 'function' ? u(this.state, this.props) : u;
    if (p) this.state = { ...this.state, ...p };
    this.__sched(cb);
  }
  forceUpdate(cb) { this.__sched(cb); }
}

export function mount(Comp, root, tplSrc, props = {}) {
  const tree = parse(tplSrc), c = new Comp();
  c.props = props;
  let mounted = false, queued = false, cbs = [];
  const run = () => {
    queued = false;
    const vals = c.renderVals(), H = [], out = [];
    render(tree, vals, H, out);
    const tmp = document.createElement('div'); tmp.innerHTML = out.join('');
    if (!mounted) { root.replaceChildren(...tmp.childNodes); [...root.children].forEach(stamp); }
    else morph(root, tmp);
    bind(root, vals, H);
    if (!mounted) { mounted = true; c.componentDidMount && c.componentDidMount(); }
    else c.componentDidUpdate && c.componentDidUpdate();
    const l = cbs; cbs = []; l.forEach(f => f());
  };
  c.__sched = cb => { if (cb) cbs.push(cb); if (!queued) { queued = true; queueMicrotask(run); } };
  run();
  addEventListener('pagehide', () => c.componentWillUnmount && c.componentWillUnmount());
  return c;
}
