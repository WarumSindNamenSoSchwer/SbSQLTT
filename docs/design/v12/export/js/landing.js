// Tabula · SQL im Informatikunterricht, kostenlos im Browser: Seitenlogik. Rendert das Template aus <script id="tb-tpl"> mit tb-render.js.
import { DCLogic, mount } from './tb-render.js';

const HERO_START = 'SELECT title, year\nFROM books\nWHERE year > 2010;';
const HERO_SOL = 'SELECT title, year FROM books WHERE year > 2020';
const BOOK_COLS = [['id', 'int'], ['title', 'text'], ['author', 'text'], ['year', 'int'], ['pages', 'int'], ['price', 'real'], ['genre', 'text'], ['publisher_id', 'int']];
const CLAUSES = [{ id: 'where', label: 'WHERE year > 2015' }, { id: 'krimi', label: "AND genre = 'Krimi'" }, { id: 'order', label: 'ORDER BY year DESC' }, { id: 'limit', label: 'LIMIT 5' }];
const T_STEPS = [
  ['Klasse verbinden', 'Schüler treten mit einem Klassencode wie sonne-apfel-kugel-33 bei oder scannen den QR-Code am Beamer. Ohne Installation, auf jedem Schulrechner.', 'wave'],
  ['Fortschritt sehen', 'Wer fertig ist, wer arbeitet und wer festhängt. Wer Hilfe braucht, steht oben.', 'lookaround'],
  ['Gezielt helfen', 'Letzte Abfrage und Fehler auf einen Blick. So wissen Sie, wo Sie ansetzen können.', 'hint'],
  ['Gemeinsam wiederholen', 'Live-Quiz am Beamer, Antworten am Handy. Danach sehen Sie, welche Fragen am schwersten waren.', 'quiz']
];
const ROLES = [
  ['Erklärt Konzepte', 'Jede neue Klausel beginnt mit einem kurzen Beispiel.', 'read'],
  ['Fragt zurück', 'Erst ein Denkanstoß. Ein konkreter Hinweis nur auf Wunsch.', 'thinking'],
  ['Würdigt Fortschritt', 'Nach einer ganzen Lektion, nicht nach jedem Klick.', 'trophy'],
  ['Hält sich zurück', 'Keine Noten und keine Kommentare zu Personen. Den Lernstand sieht nur die Lehrkraft.', 'sleep']
];
const FAQ = [
  ['Brauchen Schüler ein Konto?', 'Nein. Zum Ausprobieren braucht es gar keine Anmeldung. Im Unterricht treten Schüler mit dem Klassencode bei und wählen selbst Name und Passwort. Ein Konto mit E-Mail gibt es für Schüler nicht.'],
  ['Für welche Klassenstufen ist Tabula gedacht?', 'Ab Klasse 10 bis zum Abitur. Die Lektionen bauen aufeinander auf und lassen sich in einzelnen Stunden einsetzen.'],
  ['Was kostet Tabula?', 'Nichts. Tabula ist kostenlos und Open Source unter AGPL-3.0.'],
  ['Muss die Schule etwas installieren?', 'Nein. Tabula läuft im Browser.'],
  ['Wo liegen die Daten?', 'Auf Servern in Deutschland (Hetzner, Nürnberg). Es gibt keine Werbung und kein Tracking. SQL-Abfragen verlassen den Browser nicht.'],
  ['Wie geht es nach SQL weiter?', 'Der Lernpfad führt über den Entwurf einer eigenen Datenbank zu Python und pandas. Im Abschlussprojekt analysieren Schüler eigene Fragestellungen mit echten Daten.'],
  ['Wie bekomme ich eine Demo?', 'Schreiben Sie uns über die Kontaktseite. Wir zeigen Ihnen Tabula und richten auf Wunsch eine erste Klasse ein.']
];
const TRACK_DESC = { 1: 'Wähle Spalten aus, filtere Zeilen, fasse Daten zusammen und verbinde Tabellen.', 2: 'Entwirf Tabellen, setze Schlüssel und mache die Beziehungen zwischen deinen Daten sichtbar.', 3: 'Schüler nehmen ihre Daten mit nach Python und werten sie mit pandas aus.' };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const PHASES = [
  [0, 10, 'Live-Quiz zur letzten Stunde', 'Am Beamer läuft ein kurzes Quiz zur vorherigen Lektion, die Klasse antwortet am Handy. Danach sehen Sie, welche Fragen am schwersten waren.', 'quiz'],
  [10, 15, 'Fokus setzen', 'Sie setzen die Lektion des Tages als Fokus. Die Klasse sieht sie direkt oben in ihrer Übersicht.', 'point'],
  [15, 70, 'Üben im eigenen Tempo', 'Die Schüler arbeiten die Lektion durch. Edgar gibt Hinweise, Sie sehen im Dashboard, wer festhängt, und helfen gezielt.', 'typing'],
  [70, 85, 'Gemeinsam besprechen', 'Sie greifen die häufigsten Fehler aus dem Dashboard auf und besprechen sie mit der ganzen Klasse.', 'lookaround'],
  [85, 90, 'Hausaufgabe freischalten', 'Die nächste Lektion wird freigeschaltet. Wer zu Hause weitermacht, macht dort weiter, wo er aufgehört hat.', 'wave']
];

class Component extends DCLogic {
  state = { theme: 'dark', code: HERO_START, hero: 'new', res: null, fb: null, typing: false, docked: false, on: {}, clauseOwl: 'read', sel: 2, tStep: 0, role: 0, awake: false, boxW: 1100, books: [], pinned: false };
  rootRef = React.createRef(); heroRef = React.createRef(); edgarRef = React.createRef(); anchorA = React.createRef(); anchorB = React.createRef();
  heroHl = React.createRef(); heroTa = React.createRef(); clauseHl = React.createRef(); tileBox = React.createRef();
  marqueeRef = React.createRef(); roleRef = React.createRef(); stundeRef = React.createRef(); roleTrack = React.createRef(); roleViewport = React.createRef(); mqOwl = React.createRef(); clauseRef = React.createRef(); pathRef = React.createRef(); teachRef = React.createRef(); footRef = React.createRef();

  async componentDidMount() {
    this.C = await import('./tabula-core.js');
    const theme = this.C.getTheme('dark'); document.documentElement.dataset.tb = theme;
    const books = [...this.C.BOOKS_SEED.matchAll(/\((\d+),'((?:[^']|'')*)','(?:[^']|'')*',(\d+|NULL),(?:\d+|NULL),(?:[\d.]+|NULL),'(\w+)',\d+\)/g)].map(m => ({ id: +m[1], title: m[2].replace("''", "'"), year: +m[3], genre: m[4] }));
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.setState({ theme, books, pinned: this.canPin() });
    await this.C.loadOwl();
    const G = (await import('./owl-gen.js')).default;
    this.icons = { light: G.icon({}), dark: G.icon(G.DARK) };
    this.paint();
    this.ro = new ResizeObserver(es => { const w = Math.round(es[0].contentRect.width); if (w && w !== this.state.boxW) this.setState({ boxW: w }); });
    if (this.tileBox.current) this.ro.observe(this.tileBox.current);
    this.onMove = e => {
      const o = this.edgarRef.current, p = o && o.querySelector('.pupils'); if (!p) return;
      const r = o.getBoundingClientRect(), dx = e.clientX - (r.left + r.width * .47), dy = e.clientY - (r.top + r.height * .43);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 240);
      p.style.transition = 'transform .12s'; p.style.transform = 'translate(' + (dx / d * 4 * k).toFixed(2) + 'px,' + (dy / d * 4 * k).toFixed(2) + 'px)';
    };
    this.onScroll = () => { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.tick(); }); };
    this.onResize = () => { const p = this.canPin(); if (p !== this.state.pinned) this.setState({ pinned: p }); this.onScroll(); };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);
    this.tick();
    this.C.openDb().then(db => { this.db = db; this.forceUpdate(); }).catch(() => this.setState({ hero: 'fail' }));
  }
  componentWillUnmount() { ['pointermove', 'scroll', 'resize'].forEach((ev, i) => window.removeEventListener(ev, [this.onMove, this.onScroll, this.onResize][i])); this.ro && this.ro.disconnect(); clearTimeout(this.tt); clearTimeout(this.ct); }
  componentDidUpdate() { this.paint(); this.tick(); }
  fx() { return (this.props.scrollFx ?? true) && !this.reduce; }
  canPin() { return this.fx() && innerWidth >= 900 && innerHeight >= 680; }
  tick() {
    const vh = innerHeight, root = this.rootRef.current; if (!root) return;
    const fx = this.fx();
    // Hero: Edgar klettert hinter der Tafel hervor, sobald sie ins Bild kommt
    const hero = this.heroRef.current, ed = this.edgarRef.current;
    if (hero && ed) {
      const card = ed.parentElement.parentElement.getBoundingClientRect();
      const p = fx ? clamp((vh * .92 - card.top) / (vh * .3)) : 1;
      const e = p < 1 ? 1 - Math.pow(1 - p, 3) : 1;
      hero.style.setProperty('--hp', e.toFixed(3));
      const docked = e > .96;
      if (docked !== this.state.docked) this.setState({ docked });
    }
    const m = this.marqueeRef.current;
    if (m) { const r = m.getBoundingClientRect(); m.style.setProperty('--mp', fx ? clamp((vh - r.top) / (vh + r.height)).toFixed(4) : '.5'); }
    const mo = this.mqOwl.current;
    if (mo) { const r = mo.getBoundingClientRect(); const w = r.left <= innerWidth * .85 && r.right > 0 && r.bottom > 0 && r.top < vh; if (w !== !!this.state.mqWave) this.setState({ mqWave: w }); }
        if (!this.state.pinned) return;
    const prog = el => { const r = el.getBoundingClientRect(); return clamp((68 - r.top) / Math.max(1, r.height - vh + 68)); };
    const c = this.clauseRef.current;
    if (c) { const p = prog(c); c.style.setProperty('--cp', p.toFixed(3)); const n = Math.min(4, Math.floor(p * 5.2)); if (n !== this.lastClause) { this.lastClause = n; const on = {}; CLAUSES.slice(0, n).forEach(x => { on[x.id] = true; }); this.setState({ on }); if (n) this.flash(['curious', 'curious', 'lookaround', 'surprised'][n - 1]); } }
    const pa = this.pathRef.current;
    if (pa) { const p = prog(pa); const s = Math.min(10, Math.round(p * 10)); if (s !== this.lastSel) { this.lastSel = s; if (s !== this.state.sel) this.setState({ sel: s }); } }
    const ro = this.roleRef.current, tr = this.roleTrack.current, rv = this.roleViewport.current;
    if (ro && tr && rv) { const p = prog(ro); const max = Math.max(0, tr.scrollWidth - rv.clientWidth); ro.style.setProperty('--rp', p.toFixed(3)); tr.style.setProperty('--rx', (p * max).toFixed(1)); }
    const sd = this.stundeRef.current;
    if (sd) { const p = prog(sd); sd.style.setProperty('--sp', p.toFixed(3)); const s = Math.min(4, Math.floor(p * 5)); if (s !== this.lastPh) { this.lastPh = s; this.setState({ ph: s }); } }
    const t = this.teachRef.current;
    if (t) { const p = prog(t); t.style.setProperty('--tp', p.toFixed(3)); const s = Math.min(3, Math.floor(p * 4)); if (s !== this.lastT) { this.lastT = s; this.setState({ tStep: s }); } }
  }
  paint() {
    const C = this.C, root = this.rootRef.current; if (!C || !root) return;
    const dark = this.state.theme === 'dark';
    C.paintOwls(root, dark);
    if (this.icons) root.querySelectorAll('[data-owl-icon]').forEach(el => { const k = dark ? 'dark' : 'light'; if (el.dataset.k !== k) { el.innerHTML = this.icons[k].replace('<svg ', '<svg style="width:100%;height:100%;display:block" aria-hidden="true" '); el.dataset.k = k; } });
    if (this.heroHl.current) this.heroHl.current.innerHTML = C.highlight(this.state.code);
    if (this.clauseHl.current) this.clauseHl.current.innerHTML = C.highlight(this.clauseSql());
  }
  clauseSql() { const o = this.state.on; let s = 'SELECT title, year\nFROM books'; if (o.where || o.krimi) s += '\n' + (o.where ? 'WHERE year > 2015' : '') + (o.krimi ? (o.where ? ' AND ' : 'WHERE ') + "genre = 'Krimi'" : ''); if (o.order) s += '\nORDER BY year DESC'; if (o.limit) s += '\nLIMIT 5'; return s + ';'; }
  insertHero(txt) {
    const ta = this.heroTa.current, code = this.state.code;
    const a = ta ? ta.selectionStart : code.length, b = ta ? ta.selectionEnd : code.length;
    const before = code.slice(0, a), pad = before && !/[\s(,]$/.test(before) ? ' ' : '';
    this.setState({ code: before + pad + txt + code.slice(b) });
    const pos = a + pad.length + txt.length;
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.setSelectionRange(pos, pos); } });
  }
  async heroRun() {
    const C = this.C; if (!this.db || this.state.hero === 'running') return;
    const sql = this.state.code.trim(); if (!sql) return;
    this.setState({ hero: 'running', typing: false });
    await new Promise(r => setTimeout(r, 380));
    try {
      const res = C.runChecked(this.db, sql), c = C.compare(res, C.run(this.db, HERO_SOL), false);
      this.setState({ hero: c.ok ? 'ok' : 'wrong', res, fb: c.ok ? null : c.sub });
    } catch (e) { this.setState({ hero: 'error', res: null, fb: C.explainError(sql, e).msg }); }
  }
  flash(pose) { clearTimeout(this.ct); this.setState({ clauseOwl: pose }); this.ct = setTimeout(() => this.setState({ clauseOwl: 'read' }), 1400); }
  renderVals() {
    const S = this.state, C = this.C;
    let heroOwl = 'idle', bubble = 'Ich bin Edgar. Schreib die Abfrage, ich schaue mit drauf.';
    let fbBg = 'var(--surface)', fbInk = 'var(--text)', fbTitle = 'Bereit, wenn du es bist.', fbSub = 'Die Abfrage ist fast fertig. Führe sie aus und schau, was Edgar sagt.';
    if (S.typing) { heroOwl = 'typing'; bubble = 'Ich lese mit …'; }
    if (S.hero === 'running') { heroOwl = 'loading'; bubble = 'Einen Moment …'; fbTitle = 'Abfrage läuft …'; fbSub = ''; }
    else if (S.hero === 'wrong') { heroOwl = S.typing ? 'typing' : 'thinking'; bubble = 'Fast. Schau dir die Jahreszahl an.'; fbBg = 'var(--blue-soft)'; fbInk = 'var(--blue)'; fbTitle = 'Noch nicht ganz.'; fbSub = S.fb; }
    else if (S.hero === 'error') { heroOwl = S.typing ? 'typing' : 'error'; bubble = 'Hoppla. Das kennt SQL nicht.'; fbBg = 'var(--err-bg)'; fbInk = 'var(--err)'; fbTitle = S.fb; fbSub = 'Korrigiere die Stelle und führe die Abfrage erneut aus.'; }
    else if (S.hero === 'ok') { heroOwl = S.typing ? 'typing' : 'celebrate'; bubble = 'Genau so!'; fbBg = 'var(--ok-bg)'; fbInk = 'var(--ok)'; fbTitle = 'Richtig!'; fbSub = 'WHERE lässt nur die passenden Zeilen durch. In der ersten Lektion geht es so weiter.'; }
    else if (S.hero === 'fail') { heroOwl = 'sleep'; fbTitle = 'Datenbank konnte nicht geladen werden.'; fbSub = 'Prüfe die Internetverbindung und lade die Seite neu.'; }
    if (!this.db && S.hero === 'new') fbSub = 'Die Datenbank wird geladen …';
    if (S.hero === 'new' && !S.typing) heroOwl = S.docked ? 'wave' : 'curious';
    const res = S.res, n = res ? res.rows.length : 0;
    const o = S.on;
    let kept = S.books.filter(b => (!o.where || b.year > 2015) && (!o.krimi || b.genre === 'Krimi'));
    if (o.order) kept = kept.slice().sort((a, b) => b.year - a.year || a.id - b.id);
    if (o.limit) kept = kept.slice(0, 5);
    const keptIds = kept.map(b => b.id), dropped = S.books.filter(b => !keptIds.includes(b.id));
    const W = S.boxW, cols = W > 1300 ? 8 : W > 1050 ? 6 : W > 800 ? 5 : W > 600 ? 4 : W > 400 ? 3 : 2, gap = 8;
    const cw = (W - gap * (cols - 1)) / cols;
    const pos = {}; [...kept, ...dropped].forEach((b, i) => { pos[b.id] = i; });
    const any = Object.values(o).some(Boolean);
    const tiles = S.books.map(b => { const i = pos[b.id], k = keptIds.includes(b.id); return { title: b.title, meta: b.year + ' · ' + b.genre, w: cw + 'px', tf: 'translate(' + ((i % cols) * (cw + gap)).toFixed(1) + 'px,' + (Math.floor(i / cols) * 68) + 'px) scale(' + (k ? 1 : .92) + ')', op: k ? 1 : .18, bg: k && any ? 'var(--blue-soft)' : 'var(--surface)', border: k && any ? 'var(--blue)' : 'var(--line)' }; });
    const cat = C ? C.CATALOG : [], sel = cat[S.sel] || {};
    const poseFor = i => { const c = cat[i]; if (!c) return 'idle'; if (c.n === 'P') return 'trophy'; if (c.track === 3) return 'laptop'; if (c.track === 2) return 'graduate'; return i === 2 ? 'typing' : i === 6 ? 'thinking' : 'read'; };
    const tracks = C ? C.TRACKS : [];
    const pinned = S.pinned;
    return {
      rootRef: this.rootRef, heroRef: this.heroRef, edgarRef: this.edgarRef, anchorA: this.anchorA, anchorB: this.anchorB,
      heroHl: this.heroHl, heroTa: this.heroTa, clauseHl: this.clauseHl, tileBox: this.tileBox,
      marqueeRef: this.marqueeRef, roleRef: this.roleRef, stundeRef: this.stundeRef, stundeWrapH: pinned ? '300vh' : 'auto', roleTrack: this.roleTrack, roleViewport: this.roleViewport, mqOwl: this.mqOwl, marqueeOwl: S.mqWave ? 'wave' : 'lookaround', roleWrapH: pinned ? '340vh' : 'auto', roleOverflow: pinned ? 'hidden' : 'auto', clauseRef: this.clauseRef, pathRef: this.pathRef, teachRef: this.teachRef, footRef: this.footRef,
      toggleTheme: () => { const t = S.theme === 'dark' ? 'light' : 'dark'; C.setTheme(t); this.setState({ theme: t }); },
      showMarquee: this.props.marquee ?? true,
      pinned, stickyPos: pinned ? 'sticky' : 'relative', stickyMinH: pinned ? 'calc(100vh - 68px)' : '0',
      clauseWrapH: pinned ? '300vh' : 'auto', pathWrapH: pinned ? '320vh' : 'auto', teachWrapH: pinned ? '280vh' : 'auto',
      clauseIntro: pinned ? 'Scrolle weiter: Klausel für Klausel wächst die Abfrage, und die 30 Bücher der Schulbibliothek ordnen sich neu. Du kannst jede Klausel auch selbst an- und ausschalten.' : 'Schalte die Klauseln an und aus. Die Abfrage wächst, und die 30 Bücher der Schulbibliothek ordnen sich neu.',
      heroOwl, heroBubble: bubble, bubbleOp: S.docked ? 1 : 0, bubbleY: S.docked ? '0' : '10px', heroCode: S.code, heroLines: S.code.split('\n').map((_, i) => i + 1), heroH: (Math.max(3, S.code.split('\n').length) * 24 + 28) + 'px',
      schemaCols: BOOK_COLS.map(c => ({ name: c[0], type: c[1], insert: () => this.insertHero(c[0]) })),
      onHeroCode: e => { const v = e.target.value; clearTimeout(this.tt); this.setState({ code: v, typing: true }); this.tt = setTimeout(() => this.setState({ typing: false }), 1200); },
      onHeroKey: e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.heroRun(); } },
      heroRun: () => this.heroRun(), heroBusy: S.hero === 'running' || !this.db, heroRunLabel: S.hero === 'running' ? 'Läuft …' : res || S.hero === 'error' ? 'Erneut ausführen' : 'Ausführen',
      heroReset: () => this.setState({ code: HERO_START, hero: 'new', res: null, fb: null }),
      heroFbBg: fbBg, heroFbInk: fbInk, heroFbTitle: fbTitle, heroFbSub: fbSub,
      heroMeta: res ? n + (n === 1 ? ' Zeile' : ' Zeilen') : '–',
      heroEmpty: !res || n === 0, heroEmptyText: res ? 'Keine Zeile erfüllt die Bedingung.' : 'Hier erscheint das Ergebnis deiner Abfrage.',
      heroHasRows: !!res && n > 0, heroCols: res ? res.columns : [], heroRows: res ? res.rows.slice(0, 60).map((r, i) => ({ delay: Math.min(i, 12) * 35 + 'ms', cells: r.map(v => v === null ? 'NULL' : String(v)) })) : [],
      clauses: CLAUSES.map(c => ({ label: c.label, on: !!o[c.id], bg: o[c.id] ? 'var(--blue-soft)' : 'var(--surface)', border: o[c.id] ? 'var(--blue)' : 'var(--line)', track: o[c.id] ? 'var(--primary)' : 'var(--line)', knob: o[c.id] ? '14px' : '2px',
        toggle: () => { this.setState(X => ({ on: { ...X.on, [c.id]: !X.on[c.id] } })); this.flash(c.id === 'order' ? 'lookaround' : c.id === 'limit' ? 'surprised' : 'curious'); } })),
      clauseOwl: S.clauseOwl, clauseCount: kept.length, clauseCountLabel: 'von ' + S.books.length + ' Zeilen im Ergebnis',
      tiles, tileH: (Math.ceil(S.books.length / cols) * 68) + 'px',
      stops: cat.map((c, i) => ({ n: c.n, aria: 'Lektion ' + c.n + ': ' + c.title, sel: i === S.sel ? 'true' : 'false', pick: () => this.state.sel !== i && this.setState({ sel: i }), pickHover: () => !pinned && this.state.sel !== i && this.setState({ sel: i }),
        size: i === S.sel ? '44px' : '30px', bg: i === S.sel ? 'var(--primary)' : i < S.sel ? 'var(--blue-soft)' : 'var(--bg)', border: i <= S.sel ? 'var(--primary)' : 'var(--line)', ink: i === S.sel ? '#fff' : i < S.sel ? 'var(--blue)' : 'var(--muted)' })),
      pathOwl: poseFor(S.sel), owlLeft: ((S.sel + .5) / 11 * 100) + '%', pathFill: (S.sel / 10 * 91) + '%',
      selN: sel.n || '', selMeta: (sel.n === 'P' ? 'Abschlussprojekt' : 'Lektion ' + sel.n) + ' · ' + sel.dur + ' · ' + ((tracks[(sel.track || 1) - 1] || {}).name || ''),
      selTitle: sel.title, selTrackDesc: TRACK_DESC[sel.track || 1], selTags: sel.tags || [],
      selHref: sel.id === 'where-filters' ? 'https://app.tabulasql.de/learn/beginner/where-filters' : 'https://app.tabulasql.de/learn', selCta: sel.id === 'where-filters' ? 'Diese Lektion öffnen' : 'Zum Lernpfad',
      tSteps: T_STEPS.map((t, i) => ({ title: t[0], copy: t[1], sel: i === S.tStep ? 'true' : 'false', op: i === S.tStep ? 1 : .5, bar: i === S.tStep ? 'var(--blue)' : 'transparent', pick: () => this.setState({ tStep: i }) })),
      tOwl: T_STEPS[S.tStep][2], t0: S.tStep === 0, t1: S.tStep === 1, t2: S.tStep === 2, t3: S.tStep === 3,
      joined: ['Mia', 'Jonas', 'Lea', 'Tim', 'Noah', 'Emma', 'Ben', 'Sophie', 'Paul', 'Hannah', 'Elias', 'Lina'],
      students: [['Mia K.', 'Braucht Hilfe', '4/5', 'var(--err)'], ['Jonas S.', 'Braucht Hilfe', '3/5', 'var(--err)'], ['Lea A.', 'In Arbeit', '3/5', 'var(--blue)'], ['Tim B.', 'Fertig', '5/5', 'var(--ok)']].map(s => ({ name: s[0], status: s[1], step: s[2], ink: s[3] })),
      answers: [['WHERE', '#ef4444', '0', 'none'], ['HAVING', '#3b82f6', '2px', 'rotate(45deg)'], ['GROUP BY', '#eab308', '50%', 'none'], ['ORDER BY', '#22c55e', '2px', 'none']].map((a, i) => ({ label: a[0], color: a[1], radius: a[2], rot: a[3], bg: i === 1 ? 'var(--blue-soft)' : 'var(--surface)', border: i === 1 ? 'var(--blue)' : 'var(--line)' })),
      roles: ROLES.map(r => ({ title: r[0], copy: r[1], pose: r[2] })),
      phases: PHASES.map((p, i) => { const s = i === (S.ph || 0); return { min: (p[1] - p[0]) >= 10 ? (p[1] - p[0]) + ' min' : (p[1] - p[0]) + '′', flex: (p[1] - p[0]) + ' 1 0', sel: s ? 'true' : 'false', bg: s ? 'var(--primary)' : 'var(--surface)', border: s ? 'var(--primary)' : 'var(--line)', ink: s ? '#fff' : 'var(--muted)', pick: () => (this.state.ph || 0) !== i && this.setState({ ph: i }), hover: () => !pinned && (this.state.ph || 0) !== i && this.setState({ ph: i }) }; }),
      phOwl: PHASES[S.ph || 0][4], phLeft: ((PHASES[S.ph || 0][0] + PHASES[S.ph || 0][1]) / 2 / 90 * 100) + '%', phRange: PHASES[S.ph || 0][0] + '–' + PHASES[S.ph || 0][1] + ' min', phTitle: PHASES[S.ph || 0][2], phCopy: PHASES[S.ph || 0][3],
      faq: FAQ.map(f => ({ q: f[0], a: f[1] })),
      ctaOwl: S.cta || 'sleep',
      wake: () => { if (this.state.awake) return; clearTimeout(this.wt); clearTimeout(this.wt2); this.setState({ awake: true, cta: 'surprised' }); this.wt = setTimeout(() => this.setState({ cta: 'wave' }), 650); this.wt2 = setTimeout(() => this.setState({ cta: 'heart' }), 2200); },
      doze: () => {}
    };
  }
}

mount(Component, document.getElementById('app'), document.getElementById('tb-tpl').textContent);
