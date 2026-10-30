// Datensätze · Tabula: Seitenlogik. Rendert das Template aus <script id="tb-tpl"> mit tb-render.js.
import { DCLogic, mount } from './tb-render.js';

const DS = [
  { id: 'books', file: 'bibliothek.db', name: 'Schulbibliothek', desc: 'Bücher, Verlage und Ausleihen aus der Schulbibliothek. Der Datensatz aus den SQL-Grundlagen.', story: 'Bücher, ihre Verlage und wer sie wann ausgeliehen hat. Einige Preise und Rückgabedaten fehlen absichtlich, damit sich NULL üben lässt. Gut für erste Abfragen, Filter, Gruppierungen und JOINs über drei Tabellen.', tags: ['Einstieg', 'JOIN', 'Aggregation'], usedIn: 'Lektionen 1 bis 8, Lektion 10', main: 'books', q: 'SELECT genre, COUNT(*) AS anzahl\nFROM books\nGROUP BY genre\nORDER BY anzahl DESC;' },
  { id: 'schule', file: 'schule.db', name: 'Schule', desc: 'Klassen einer Schule. Wird für Lektion 9 (Eigene Datenbank entwerfen) verwendet.', story: 'Ein bewusst kleiner Startpunkt: nur die Tabelle klassen. Schüler, Lehrer und Noten legen die Lernenden in Lektion 9 selbst an.', tags: ['DDL', 'CREATE TABLE'], usedIn: 'Lektion 9', main: 'klassen', q: 'SELECT * FROM klassen;' },
  { id: 'traffic', file: 'app-traffic.db', name: 'App-Traffic', desc: 'Stündliche Nutzerzahlen, Antwortzeiten und Fehler einer App über sechs Wochen.', story: 'Ein Tagesrhythmus mit Abendspitze, ruhigere Wochenenden und stetiges Wachstum. Ab Release v2.4 werden die Antwortzeiten deutlich länger, v2.4.1 behebt das nur teilweise. Ideal, um mit SQL und pandas einer echten Frage nachzugehen.', tags: ['Zeitreihe', 'Python', 'Projekt'], usedIn: 'Abschlussprojekt', main: 'traffic', q: "SELECT substr(ts, 1, 10) AS tag, ROUND(AVG(avg_ms)) AS ms\nFROM traffic\nGROUP BY tag\nORDER BY tag\nLIMIT 14;" }
];
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  }
  const cs = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
const csvCell = v => v === null ? '' : /[",\n;]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);

class Component extends DCLogic {
  state = { theme: 'light', sel: 'books', info: {}, status: {}, tab: {}, q: {}, qres: {}, toast: '', copied: false };
  rootRef = React.createRef(); pyRef = React.createRef(); qHl = React.createRef(); dbs = {};
  async componentDidMount() {
    this.C = await import('./tabula-core.js');
    const theme = this.C.getTheme('light'); document.documentElement.dataset.tb = theme;
    let sel = 'books'; const m = location.hash.slice(1); if (DS.some(d => d.id === m)) sel = m;
    this.setState({ theme, sel, q: Object.fromEntries(DS.map(d => [d.id, d.q])) });
    await this.C.loadOwl();
    const G = (await import('./owl-gen.js')).default;
    this.icons = { light: G.icon({}), dark: G.icon(G.DARK) };
    this.load(sel); DS.forEach(d => d.id !== sel && this.load(d.id));
  }
  componentDidUpdate() { this.paint(); }
  componentWillUnmount() { clearTimeout(this.tt); }
  paint() {
    const root = this.rootRef.current; if (!this.C || !root) return;
    const dark = this.state.theme === 'dark';
    this.C.paintOwls(root, dark);
    if (this.icons) root.querySelectorAll('[data-owl-icon]').forEach(el => { const k = dark ? 'dark' : 'light'; if (el.dataset.k !== k) { el.innerHTML = this.icons[k].replace('<svg ', '<svg style="width:100%;height:100%;display:block" aria-hidden="true" '); el.dataset.k = k; } });
    if (this.qHl.current) this.qHl.current.innerHTML = this.C.highlight(this.state.q[this.state.sel] || '');
    if (this.pyRef.current) this.pyRef.current.innerHTML = this.pyHtml();
  }
  async load(id) {
    if (this.state.status[id] === 'ok' || this.state.status[id] === 'loading') return;
    this.setState(S => ({ status: { ...S.status, [id]: 'loading' } }));
    try {
      let seed = this.C.BOOKS_SEED;
      if (id !== 'books') { const X = await import('./tabula-datasets.js'); seed = id === 'schule' ? X.SCHOOL_SEED : X.TRAFFIC_SEED; }
      const db = await this.C.openDb(seed); this.dbs[id] = db;
      const schema = this.C.readSchema(db);
      const rels = []; schema.forEach(t => this.C.run(db, 'PRAGMA foreign_key_list("' + t.table + '")').rows.forEach(r => rels.push({ from: t.table + '.' + r[3], to: r[2] + '.' + r[4] })));
      const rows = schema.reduce((a, t) => a + t.count, 0);
      this.setState(S => ({ status: { ...S.status, [id]: 'ok' }, info: { ...S.info, [id]: { schema, rels, rows, size: db.export().byteLength } } }));
    } catch (e) { console.error(e); this.setState(S => ({ status: { ...S.status, [id]: 'fail' } })); }
  }
  ds() { return DS.find(d => d.id === this.state.sel); }
  py() { const d = this.ds(); return 'import sqlite3\nimport pandas as pd\n\ncon = sqlite3.connect("' + d.file + '")\ndf = pd.read_sql_query("SELECT * FROM ' + d.main + '", con)\nprint(df.head())'; }
  pyHtml() {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return this.py().split('\n').map(l => esc(l).replace(/("[^"]*")/g, '<span style="color:#86efac">$1</span>').replace(/^(import|from)\b/, '<span style="color:#60a5fa">$1</span>').replace(/\bas\b/, '<span style="color:#60a5fa">as</span>')).join('\n');
  }
  say(t) { clearTimeout(this.tt); this.setState({ toast: t }); this.tt = setTimeout(() => this.setState({ toast: '', copied: false }), 2600); }
  runQ() {
    const id = this.state.sel, db = this.dbs[id]; if (!db) return;
    const sql = (this.state.q[id] || '').trim(); if (!sql) return;
    const t0 = performance.now();
    let r;
    try { const res = this.C.runChecked(db, sql); r = { res, ms: Math.max(1, Math.round(performance.now() - t0)) }; }
    catch (e) { const x = this.C.explainError(sql, e); r = { err: x.msg, orig: x.orig }; }
    this.setState(S => ({ qres: { ...S.qres, [id]: r } }));
  }
  renderVals() {
    const S = this.state, C = this.C, d = this.ds(), info = S.info[d.id], st = S.status[d.id] || 'loading';
    const fmt = b => b < 1024 ? b + ' B' : Math.round(b / 1024) + ' KB';
    const cellOf = v => ({ v: v === null ? 'NULL' : String(v), color: v === null ? 'var(--ink-3)' : 'var(--ink)', fs: v === null ? 'italic' : 'normal' });
    let pvCols = [], pvRows = [], pvFoot = '';
    const tab = info ? (S.tab[d.id] || d.main) : d.main;
    if (info && this.dbs[d.id]) {
      const r = C.run(this.dbs[d.id], 'SELECT * FROM "' + tab + '" LIMIT 10'), t = info.schema.find(x => x.table === tab);
      pvCols = r.columns; pvRows = r.rows.map(row => ({ cells: row.map(cellOf) }));
      pvFoot = 'Erste ' + r.rows.length + ' von ' + (t ? t.count : r.rows.length) + ' Zeilen';
    }
    const qr = S.qres[d.id], q = S.q[d.id] || '';
    const qn = qr && qr.res ? qr.res.rows.length : 0;
    let qOwl = 'curious'; if (qr && qr.err) qOwl = 'error'; else if (qr && qr.res) qOwl = 'success';
    return {
      rootRef: this.rootRef, pyRef: this.pyRef, qHl: this.qHl,
      toggleTheme: () => { const th = S.theme === 'dark' ? 'light' : 'dark'; C.setTheme(th); this.setState({ theme: th }); },
      headOwl: st === 'loading' ? 'loading' : d.id === 'traffic' ? 'laptop' : d.id === 'schule' ? 'graduate' : 'read',
      list: DS.map(x => { const i = S.info[x.id], cur = x.id === d.id; return { name: x.name, file: x.file, desc: x.desc, tags: x.tags, current: cur ? 'page' : 'false',
        meta: i ? i.schema.length + (i.schema.length === 1 ? ' Tabelle' : ' Tabellen') + ' · ' + i.rows.toLocaleString('de-DE') + ' Zeilen' : S.status[x.id] === 'fail' ? 'Fehler' : '…',
        bg: cur ? 'var(--accent-soft)' : 'var(--surface)', border: cur ? 'var(--accent)' : 'var(--line)', pick: () => { this.setState({ sel: x.id }); history.replaceState(null, '', '#' + x.id); this.load(x.id); } }; }),
      file: d.file, name: d.name, story: d.story, usedIn: d.usedIn,
      metaLine: info ? info.schema.length + (info.schema.length === 1 ? ' Tabelle' : ' Tabellen') + ' · ' + info.rows.toLocaleString('de-DE') + ' Zeilen · ' + fmt(info.size) : '',
      noDb: !info, dbOpacity: info ? 1 : .55, dbLabel: d.file + (info ? ' · ' + fmt(info.size) : ''),
      dlDb: () => { if (this.dbs[d.id]) { C.exportDb(this.dbs[d.id], d.file); this.say(d.file + ' wird heruntergeladen.'); } },
      dlCsv: () => {
        const db = this.dbs[d.id]; if (!db) return;
        const files = info.schema.map(t => { const r = C.run(db, 'SELECT * FROM "' + t.table + '"'); return { name: t.table + '.csv', text: [r.columns.join(','), ...r.rows.map(row => row.map(csvCell).join(','))].join('\n') }; });
        const a = document.createElement('a'); a.href = URL.createObjectURL(zip(files)); a.download = d.file.replace('.db', '') + '-csv.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        this.say(files.length + (files.length === 1 ? ' Tabelle' : ' Tabellen') + ' als CSV heruntergeladen.');
      },
      loading: st === 'loading', failed: st === 'fail', ready: st === 'ok', retry: () => { this.setState(X => ({ status: { ...X.status, [d.id]: undefined } }), () => this.load(d.id)); },
      tableCount: info ? info.schema.length + (info.schema.length === 1 ? ' Tabelle' : ' Tabellen') : '',
      schema: info ? info.schema.map(t => ({ table: t.table, countLabel: t.count.toLocaleString('de-DE') + ' Zeilen', cols: t.cols.map(c => ({ name: c.name, type: c.type, key: c.key, keyInk: c.key === 'PK' ? 'var(--accent-ink)' : 'var(--ink-3)' })) })) : [],
      hasRels: !!(info && info.rels.length), rels: info ? info.rels : [],
      copyLabel: S.copied ? 'Kopiert' : 'Kopieren',
      copyPy: () => { navigator.clipboard && navigator.clipboard.writeText(this.py()).catch(() => {}); this.setState({ copied: true }); this.say('Python-Code kopiert.'); },
      tabs: info ? info.schema.map(t => { const s = t.table === tab; return { name: t.table, sel: s ? 'true' : 'false', bg: s ? 'var(--surface)' : 'transparent', ink: s ? 'var(--ink)' : 'var(--ink-2)', shadow: s ? '0 1px 2px rgb(15 23 42/.12)' : 'none', pick: () => this.setState(X => ({ tab: { ...X.tab, [d.id]: t.table } })) }; }) : [],
      pvCols, pvRows, pvFoot,
      qOwl, q, qH: (Math.max(5, q.split('\n').length) * 22 + 28) + 'px',
      onQ: e => { const v = e.target.value; this.setState(X => ({ q: { ...X.q, [d.id]: v } })); },
      onQKey: e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.runQ(); } },
      runQ: () => this.runQ(),
      qErr: !!(qr && qr.err), qErrMsg: qr && qr.err, qErrOrig: qr && qr.orig,
      qMeta: qr && qr.res ? qn + (qn === 1 ? ' Zeile' : ' Zeilen') + ' · ' + qr.ms + ' ms' : qr && qr.err ? 'Fehler' : 'Bereit',
      qEmpty: !qr || !qr.res || qn === 0, qEmptyText: qr && qr.res ? 'Die Abfrage liefert keine Zeilen.' : qr && qr.err ? 'Kein Ergebnis, weil die Abfrage einen Fehler hat.' : 'Führe die Abfrage aus, um das Ergebnis zu sehen.',
      qHasRows: !!(qr && qr.res && qn > 0), qCols: qr && qr.res ? qr.res.columns : [], qRows: qr && qr.res ? qr.res.rows.slice(0, 100).map(r => ({ cells: r.map(cellOf) })) : [],
      toast: !!S.toast, toastText: S.toast
    };
  }
}

mount(Component, document.getElementById('app'), document.getElementById('tb-tpl').textContent);
