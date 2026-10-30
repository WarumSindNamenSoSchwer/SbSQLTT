// Mit WHERE filtern · Tabula: Seitenlogik. Rendert das Template aus <script id="tb-tpl"> mit tb-render.js.
import { DCLogic, mount } from './tb-render.js';

class Component extends DCLogic {
  state = { cur: 0, reached: 0, theme: 'light', dbState: 'loading', schema: [], open: { books: true }, st: [], confirm: null, finished: false, guest: false, total: 0 };
  rootRef = React.createRef(); taRef = React.createRef(); hlRef = React.createRef(); exHlRef = React.createRef();
  core = null; db = null;

  async componentDidMount() {
    this.core = await import('./tabula-core.js');
    const C = this.core, L = C.LESSON;
    const theme = C.getTheme('light'); document.documentElement.dataset.tb = theme;
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('tabula-l3') || '{}'); } catch (e) {}
    let guest = false; try { guest = !localStorage.getItem('tabula-guest-hint'); } catch (e) {}
    const st = L.steps.map(s => ({ code: s.kind === 'exercise' ? s.starter : s.kind === 'example' ? s.code : s.kind === 'explain' ? s.example : '', attempts: 0, state: 'new', result: null, errLine: null, errMsg: '', errOrig: '', sub: '', tipOpen: false, ms: 0 }));
    const reached = Math.min(saved.reached || 0, L.steps.length - 1);
    this.setState({ theme, st, reached, cur: Math.min(saved.cur || 0, reached), guestAllowed: guest });
    this.onGlobalKey = e => { if (e.key === 'Escape' && this.state.confirm) this.setState({ confirm: null }); };
    window.addEventListener('keydown', this.onGlobalKey);
    C.loadOwl().then(() => this.paint());
    this.loadDb();
  }
  componentWillUnmount() { window.removeEventListener('keydown', this.onGlobalKey); }
  componentDidUpdate() { this.paint(); }
  paint() {
    const C = this.core; if (!C) return;
    C.paintOwls(this.rootRef.current, this.state.theme === 'dark');
    const s = this.state.st[this.state.cur];
    if (this.hlRef.current && s) this.hlRef.current.innerHTML = C.highlight(s.code);
    const step = C.LESSON.steps[this.state.cur];
    if (this.exHlRef.current && step && step.kind === 'explain') this.exHlRef.current.innerHTML = C.highlight(step.example);
  }
  async loadDb() {
    this.setState({ dbState: 'loading' });
    try {
      this.db = await this.core.openDb();
      this.setState({ dbState: 'ok', schema: this.core.readSchema(this.db), total: this.core.run(this.db, 'SELECT COUNT(*) FROM books').rows[0][0] });
    } catch (e) { console.error(e); this.setState({ dbState: 'fail' }); }
  }
  save(cur, reached) { try { localStorage.setItem('tabula-l3', JSON.stringify({ cur, reached })); } catch (e) {} }
  patch(fn) { this.setState(S => { const st = S.st.slice(); st[S.cur] = { ...st[S.cur], ...fn(st[S.cur]) }; return { st }; }); }
  goto(i) { if (i > this.state.reached || i < 0) return; this.setState({ cur: i, confirm: null, finished: false }); this.save(i, this.state.reached); }
  advance() {
    const L = this.core.LESSON, n = Math.min(this.state.cur + 1, L.steps.length - 1);
    const reached = Math.max(this.state.reached, n);
    this.setState({ cur: n, reached, confirm: null }); this.save(n, reached);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  insertText(txt) {
    const ta = this.taRef.current, s = this.state.st[this.state.cur]; if (!s) return;
    const a = ta ? ta.selectionStart : s.code.length, b = ta ? ta.selectionEnd : s.code.length;
    const before = s.code.slice(0, a), pad = before && !/[\s(,]$/.test(before) ? ' ' : '';
    const code = before + pad + txt + s.code.slice(b);
    this.patch(() => ({ code, errLine: null }));
    const pos = a + pad.length + txt.length;
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.setSelectionRange(pos, pos); } });
  }
  async exec() {
    const C = this.core, L = C.LESSON, step = L.steps[this.state.cur], s = this.state.st[this.state.cur];
    if (!this.db || !s || s.state === 'running') return;
    const sql = s.code.trim(); if (!sql) return;
    const prevState = s.state;
    this.patch(() => ({ state: 'running' }));
    const t0 = performance.now();
    let res = null, err = null;
    try { res = C.runChecked(this.db, sql); } catch (e) { err = e; }
    const ms = Math.max(1, Math.round(performance.now() - t0));
    await new Promise(r => setTimeout(r, 220));
    if (err) {
      const x = C.explainError(sql, err);
      this.patch(o => ({ state: 'error', result: null, errMsg: x.msg, errOrig: x.orig, errLine: x.line, attempts: o.attempts + (step.kind === 'exercise' ? 1 : 0), ms }));
      return;
    }
    if (step.kind === 'exercise') {
      if (prevState === 'shown' || prevState === 'solved') { const c = C.compare(res, C.run(this.db, step.solution), step.ordered); this.patch(() => ({ state: c.ok ? prevState : 'wrong', result: res, errLine: null, sub: c.ok ? '' : c.sub, ms })); return; }
      const c = C.compare(res, C.run(this.db, step.solution), step.ordered);
      this.patch(o => ({ state: c.ok ? 'solved' : 'wrong', result: res, errLine: null, errOrig: '', sub: c.ok ? step.okSub : c.sub, attempts: o.attempts + (c.ok ? 0 : 1), ms }));
      if (c.ok && this.state.guestAllowed) this.setState({ guest: true });
    } else {
      this.patch(() => ({ state: 'ran', result: res, errLine: null, errOrig: '', ms }));
    }
  }

  renderVals() {
    const C = this.core, S = this.state;
    const L = C ? C.LESSON : null;
    if (!L || !S.st.length) return { showWork: true, dbLoading: true, segs: [], tables: [], lines: [{ n: 1 }], stepLabel: '', owl: 'loading', fbTitle: 'Datenbank wird geladen …', fbSub: '', resultEmpty: true, emptyText: '' };
    const step = L.steps[S.cur], s = S.st[S.cur], K = step.kind;
    const isEx = K === 'exercise', isSum = K === 'summary';
    const solved = s.state === 'solved' || s.state === 'shown';
    const exDone = i => { const k = L.steps[i].kind; return k !== 'exercise' || ['solved', 'shown'].includes(S.st[i].state) || i < S.reached; };
    const segs = L.steps.map((x, i) => {
      const cur = i === S.cur, locked = i > S.reached, done = i < S.reached || (i === S.cur && solved) || (i <= S.reached && !cur && i < S.cur);
      return { title: (i + 1) + '. ' + x.name + (locked ? ' (gesperrt)' : ''), current: cur ? 'step' : 'false', locked, cursor: locked ? 'not-allowed' : 'pointer', go: () => this.goto(i),
        h: cur ? '8px' : '5px', bg: cur ? 'var(--accent)' : done ? 'var(--accent-line)' : 'var(--line)' };
    });
    const lineArr = s.code.split('\n');
    const lines = lineArr.map((_, i) => { const e = s.state === 'error' && s.errLine === i + 1; return { n: i + 1, color: e ? 'var(--danger)' : 'inherit', bg: e ? 'var(--danger-soft)' : 'transparent', weight: e ? 600 : 400 }; });
    const longest = Math.max(20, ...lineArr.map(l => l.length));
    const tipReady = isEx && s.attempts >= 3;
    // Edgar
    let owl = 'idle';
    if (S.dbState === 'loading' || s.state === 'running') owl = 'loading';
    else if (S.dbState === 'fail') owl = 'sleep';
    else if (K === 'explain') owl = s.state === 'ran' ? 'wink' : 'read';
    else if (K === 'example') owl = s.state === 'ran' ? 'success' : 'point';
    else if (s.state === 'error') owl = tipReady && !s.tipOpen ? 'raisehand' : 'error';
    else if (s.state === 'wrong') owl = s.tipOpen ? 'hint' : tipReady ? 'raisehand' : 'thinking';
    else if (s.state === 'solved') owl = 'success';
    else if (s.state === 'shown') owl = 'curious';
    else if (s.tipOpen) owl = 'hint';
    // Feedback
    const tones = { neutral: ['var(--surface)', 'var(--line)', 'var(--ink)'], danger: ['var(--danger-soft)', 'var(--danger-line)', 'var(--danger-ink)'], ok: ['var(--ok-soft)', 'var(--ok-line)', 'var(--ok-ink)'], accent: ['var(--accent-soft)', 'var(--accent-line)', 'var(--accent-ink)'] };
    let tone = 'neutral', fbTitle = '', fbSub = '';
    const rows = s.result ? s.result.rows.length : 0;
    if (S.dbState === 'loading') { fbTitle = 'Datenbank wird geladen …'; fbSub = 'Die Schulbibliothek läuft gleich direkt in deinem Browser.'; }
    else if (S.dbState === 'fail') { tone = 'danger'; fbTitle = 'Datenbank konnte nicht geladen werden.'; fbSub = 'Prüfe die Internetverbindung und versuche es erneut.'; }
    else if (s.state === 'running') { fbTitle = 'Edgar prüft deine Abfrage …'; }
    else if (s.state === 'error') { tone = 'danger'; fbTitle = s.errMsg; fbSub = tipReady && !s.tipOpen ? 'Du hängst hier schon eine Weile. Edgar hat einen Tipp für dich.' : 'Korrigiere die markierte Stelle und führe die Abfrage erneut aus.'; }
    else if (s.state === 'wrong') { tone = 'accent'; fbTitle = 'Noch nicht ganz.'; fbSub = s.sub + (tipReady && !s.tipOpen ? ' Ein Tipp ist jetzt verfügbar.' : ''); }
    else if (s.state === 'solved') { tone = 'ok'; fbTitle = 'Richtig!'; fbSub = s.sub || step.okSub; }
    else if (s.state === 'shown') { tone = 'accent'; fbTitle = 'Das ist die Musterlösung.'; fbSub = 'Führe sie aus und vergleiche sie mit deinem Versuch. Danach geht es weiter.'; }
    else if (s.state === 'ran' && K === 'example') { tone = 'ok'; fbTitle = rows + ' von ' + S.total + ' Büchern erfüllen die Bedingung year > 2010.'; fbSub = step.sub; }
    else if (s.state === 'ran') { fbTitle = 'Ausgeführt.'; fbSub = 'Lies weiter oder ändere die Abfrage und probiere es noch einmal.'; }
    else if (K === 'explain') { fbTitle = 'Lies die Erklärung.'; fbSub = 'Das Beispiel kannst du direkt im Editor ausprobieren.'; }
    else if (K === 'example') { fbTitle = 'Führe das Beispiel aus.'; fbSub = step.taskSub; }
    else if (s.tipOpen) { fbTitle = 'Edgar hat dir einen Tipp gegeben.'; fbSub = 'Lies ihn und versuche es noch einmal.'; }
    else { fbTitle = 'Schreib deine Abfrage.'; fbSub = 'Ergänze die Bedingung nach WHERE und führe die Abfrage aus.'; }
    const t = tones[tone];
    const res = s.result, shown = res ? res.rows.slice(0, 100) : [];
    const canAdvance = !isEx || solved;
    const confirmMap = { reset: ['Startcode wiederherstellen?', 'Deine Änderungen in diesem Schritt gehen verloren.', 'Zurücksetzen'], solution: ['Lösung wirklich anzeigen?', 'Die Musterlösung ersetzt deinen Code. Die Übung zählt dann als angesehen, nicht als gelöst.', 'Lösung zeigen'] };
    const cf = S.confirm ? confirmMap[S.confirm] : ['', '', ''];
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || '');
    const attemptsLeft = Math.max(0, 3 - s.attempts);
    return {
      rootRef: this.rootRef, taRef: this.taRef, hlRef: this.hlRef, exHlRef: this.exHlRef,
      segs, stepLabel: (S.cur + 1) + ' / ' + L.steps.length,
      showWork: !isSum && !S.finished, showSummary: isSum && !S.finished, finished: S.finished,
      stepType: step.type, stepName: step.name,
      isExplain: K === 'explain', explainTitle: step.title, paras: step.paras || [],
      isTask: K === 'exercise' || K === 'example', task: step.task, taskSub: step.taskSub,
      hasCols: isEx, cols: step.cols || [],
      isExercise: isEx,
      dbLoading: S.dbState === 'loading', dbFail: S.dbState === 'fail', noDb: !this.db, retryDb: () => this.loadDb(),
      tables: S.schema.map(tb => ({ table: tb.table, countLabel: tb.count + ' Zeilen', open: !!S.open[tb.table], rot: S.open[tb.table] ? 'rotate(90deg)' : 'none',
        toggle: () => this.setState(X => ({ open: { ...X.open, [tb.table]: !X.open[tb.table] } })), insert: () => this.insertText(tb.table),
        cols: tb.cols.map(c => ({ name: c.name, type: c.type, key: c.key, keyColor: c.key === 'PK' ? 'var(--accent-ink)' : 'var(--ink-3)', insert: () => this.insertText(c.name) })) })),
      showGuest: S.guest, hideGuest: () => { this.setState({ guest: false, guestAllowed: false }); try { localStorage.setItem('tabula-guest-hint', '1'); } catch (e) {} },
      download: () => this.db && C.exportDb(this.db, L.db),
      toggleTheme: () => { const th = S.theme === 'dark' ? 'light' : 'dark'; C.setTheme(th); this.setState({ theme: th }); },
      tryExample: () => { this.patch(() => ({ code: step.example, state: 'new', result: null })); requestAnimationFrame(() => this.taRef.current && this.taRef.current.focus()); },
      code: s.code, lines, taWidth: 'calc(' + longest + 'ch + 40px)', taHeight: (Math.max(lineArr.length, 7) * 22 + 28) + 'px',
      hasErrLine: s.state === 'error' && !!s.errLine, errTop: (14 + ((s.errLine || 1) - 1) * 22) + 'px', invalid: s.state === 'error' ? 'true' : 'false',
      onCode: e => { const v = e.target.value; this.patch(o => ({ code: v, errLine: o.state === 'error' ? o.errLine : null })); },
      onKey: e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.exec(); }
        else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); this.insertRaw('  '); }
      },
      exec: () => this.exec(), runDisabled: !this.db || s.state === 'running' || !s.code.trim(), runOpacity: !this.db || !s.code.trim() ? 0.55 : 1,
      runLabel: s.state === 'running' ? 'Läuft …' : res || s.state === 'error' ? 'Erneut ausführen' : 'Ausführen',
      modKey: mac ? '⌘' : 'Strg',
      attemptsLabel: isEx && s.attempts ? s.attempts + (s.attempts === 1 ? ' Versuch' : ' Versuche') : '',
      tipLocked: !tipReady || s.tipOpen, tipTitle: tipReady ? 'Tipp anzeigen' : 'Der Tipp erscheint nach 3 Versuchen',
      tipLabel: s.tipOpen ? 'Tipp offen' : tipReady ? 'Tipp anzeigen' : 'Tipp in ' + attemptsLeft + (attemptsLeft === 1 ? ' Versuch' : ' Versuchen'),
      tipBg: tipReady && !s.tipOpen ? 'var(--warn-soft)' : 'var(--surface)', tipBorder: tipReady && !s.tipOpen ? 'var(--warn-line)' : 'var(--line)', tipInk: tipReady && !s.tipOpen ? 'var(--warn-ink)' : 'var(--ink-3)',
      openTip: () => this.patch(() => ({ tipOpen: true })), tipShown: isEx && s.tipOpen, tip: step.tip,
      canSolution: isEx && s.tipOpen && s.state !== 'solved' && s.state !== 'shown',
      askSolution: () => this.setState({ confirm: 'solution' }), askReset: () => this.setState({ confirm: 'reset' }),
      confirmOpen: !!S.confirm, confirmTitle: cf[0], confirmText: cf[1], confirmCta: cf[2], closeConfirm: () => this.setState({ confirm: null }),
      doConfirm: () => {
        if (S.confirm === 'reset') this.patch(() => ({ code: isEx ? step.starter : K === 'example' ? step.code : step.example, state: 'new', result: null, errLine: null, sub: '' }));
        else this.patch(() => ({ code: step.solution, state: 'shown', errLine: null }));
        this.setState({ confirm: null });
      },
      owl, fbBg: t[0], fbLine: t[1], fbInk: t[2], fbSubInk: tone === 'neutral' ? 'var(--ink-2)' : 'var(--ink)', fbTitle, fbSub,
      hasOrig: s.state === 'error' && !!s.errOrig, errOrig: s.errOrig,
      canNext: isEx && solved && S.cur < L.steps.length - 1, next: () => canAdvance && this.advance(),
      running: s.state === 'running', resultMeta: res ? rows + (rows === 1 ? ' Zeile' : ' Zeilen') + ' · ' + s.ms + ' ms' : s.state === 'error' ? 'Fehler' : 'Bereit',
      resultEmpty: !res && s.state !== 'running', emptyText: s.state === 'error' ? 'Kein Ergebnis, weil die Abfrage einen Fehler hat.' : 'Führe deine Abfrage aus, um das Ergebnis zu sehen.',
      hasRows: !!res && rows > 0 && s.state !== 'running', noRows: !!res && rows === 0 && s.state !== 'running',
      resCols: res ? res.columns : [], resRows: shown.map(r => ({ cells: r.map(v => ({ v: v === null ? 'NULL' : String(v), color: v === null ? 'var(--ink-3)' : 'var(--ink)', fs: v === null ? 'italic' : 'normal' })) })),
      truncated: rows > 100, truncLabel: 'Erste 100 von ' + rows + ' Zeilen',
      isFirst: S.cur === 0, prevOpacity: S.cur === 0 ? 0.45 : 1, prev: () => this.goto(S.cur - 1),
      nextLocked: !canAdvance, nextBg: canAdvance ? 'var(--surface)' : 'var(--subtle)', nextBorder: 'var(--line)', nextInk: canAdvance ? 'var(--ink)' : 'var(--ink-3)',
      nextHint: canAdvance ? 'Nächster Schritt: ' + (L.steps[S.cur + 1] ? L.steps[S.cur + 1].name : '') : 'Löse die Übung, um weiterzugehen.',
      showSkip: isEx && !solved, skip: () => { this.patch(() => ({ state: 'shown' })); this.advance(); },
      sumPoints: isSum ? step.points : [], sumReal: isSum ? step.real : '',
      finish: () => { this.setState({ finished: true }); this.save(S.cur, S.reached); },
      doneSub: L.done.sub, restart: () => { this.setState({ finished: false, cur: 0 }); this.save(0, S.reached); }
    };
  }
  insertRaw(txt) {
    const ta = this.taRef.current, s = this.state.st[this.state.cur]; if (!ta || !s) return;
    const a = ta.selectionStart, b = ta.selectionEnd, code = s.code.slice(0, a) + txt + s.code.slice(b);
    this.patch(() => ({ code }));
    requestAnimationFrame(() => ta.setSelectionRange(a + txt.length, a + txt.length));
  }
}

mount(Component, document.getElementById('app'), document.getElementById('tb-tpl').textContent);
