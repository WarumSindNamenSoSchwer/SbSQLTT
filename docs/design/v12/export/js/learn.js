// Lernen · Tabula: Seitenlogik. Rendert das Template aus <script id="tb-tpl"> mit tb-render.js.
import { DCLogic, mount } from './tb-render.js';

class Component extends DCLogic {
  state = { theme: 'light', prog: { cur: 0, reached: 0 }, toast: '' };
  rootRef = React.createRef();
  async componentDidMount() {
    this.C = await import('./tabula-core.js');
    const theme = this.C.getTheme('light'); document.documentElement.dataset.tb = theme;
    let prog = { cur: 0, reached: 0 }; try { prog = JSON.parse(localStorage.getItem('tabula-l3') || '{}'); } catch (e) {}
    this.setState({ theme, prog: { cur: prog.cur || 0, reached: prog.reached || 0 } });
    await this.C.loadOwl();
    const G = (await import('./owl-gen.js')).default;
    this.icons = { light: G.icon({}), dark: G.icon(G.DARK) };
    this.paint();
  }
  componentDidUpdate() { this.paint(); }
  componentWillUnmount() { clearTimeout(this.tt); }
  paint() {
    const root = this.rootRef.current; if (!this.C || !root) return;
    const dark = this.state.theme === 'dark';
    this.C.paintOwls(root, dark);
    if (this.icons) root.querySelectorAll('[data-owl-icon]').forEach(el => { const k = dark ? 'dark' : 'light'; if (el.dataset.k !== k) { el.innerHTML = this.icons[k].replace('<svg ', '<svg style="width:100%;height:100%;display:block" aria-hidden="true" '); el.dataset.k = k; } });
  }
  say(t) { clearTimeout(this.tt); this.setState({ toast: t }); this.tt = setTimeout(() => this.setState({ toast: '' }), 3000); }
  renderVals() {
    const C = this.C, S = this.state;
    const inClass = this.props.inClass ?? false;
    const mode = this.props.progress ?? 'gespeichert';
    if (!C) return { inClass, tracks: [], heroOwl: 'loading', heroTitle: '', heroKicker: '', heroCta: 'Starten' };
    const total = C.LESSON.steps.length;
    let reached = S.prog.reached;
    if (mode === 'erstbesuch') reached = 0; else if (mode === 'fortgeschritten') reached = Math.max(reached, 4);
    const first = mode === 'erstbesuch' || (mode === 'gespeichert' && reached === 0 && !localStorage.getItem('tabula-l3'));
    const doneSet = first ? [] : ['1', '2'];
    const l3Started = reached > 0;
    const lockFrom = inClass ? 6 : 99;
    const tracks = C.TRACKS.map(t => {
      const ls = C.CATALOG.filter(c => c.track === t.num);
      const lessons = ls.map(c => {
        const idx = C.CATALOG.indexOf(c), locked = idx >= lockFrom, done = doneSet.includes(c.n), cur = c.id === 'where-filters';
        const begun = cur && l3Started && !done;
        const status = locked ? 'Gesperrt' : done ? 'Fertig' : begun ? 'Begonnen · Schritt ' + (reached + 1) + '/' + total : cur && !first ? 'Als Nächstes' : 'Offen';
        return { n: c.n, title: c.title, dur: c.dur, locked, done, status, lockedAria: locked ? 'true' : 'false', cursor: locked ? 'not-allowed' : 'pointer',
          tooltip: locked ? 'Von deiner Lehrkraft noch nicht freigeschaltet' : '',
          rowBg: cur && !first && !locked ? 'var(--accent-soft)' : 'transparent',
          numBg: done ? 'var(--ok-soft)' : cur && !first ? 'var(--accent)' : 'var(--surface)', numInk: done ? 'var(--ok-ink)' : cur && !first ? '#fff' : locked ? 'var(--ink-3)' : 'var(--ink-2)', numBorder: done ? 'var(--ok)' : cur && !first ? 'var(--accent)' : 'var(--line-strong)',
          titleInk: locked ? 'var(--ink-3)' : 'var(--ink)', statusInk: locked ? 'var(--ink-3)' : done ? 'var(--ok-ink)' : begun || (cur && !first) ? 'var(--accent-ink)' : 'var(--ink-3)',
          open: () => { if (locked) return this.say('Von deiner Lehrkraft noch nicht freigeschaltet.'); if (cur || c.n === '1') { window.location.href = '/learn/beginner/where-filters'; return; } this.say('Im Prototyp ist Lektion 3 spielbar.'); } };
      });
      const d = lessons.filter(l => l.done).length;
      return { name: t.name, desc: t.desc, progress: d + ' / ' + ls.length, lessons, row: t.num === 1 ? 'span 2' : 'auto', col: 'auto' };
    });
    return {
      rootRef: this.rootRef, inClass,
      toggleTheme: () => { const th = S.theme === 'dark' ? 'light' : 'dark'; C.setTheme(th); this.setState({ theme: th }); },
      heroOwl: first ? 'wave' : 'point',
      heroKicker: first ? 'Willkommen bei Tabula' : 'Weiter, wo du aufgehört hast',
      heroTitle: first ? 'Starte mit Lektion 1: Erste Abfrage mit SELECT' : 'Lektion 3 · Mit WHERE filtern',
      showHeroBar: !first, heroPct: Math.round(reached / (total - 1) * 100) + '%', heroSteps: 'Schritt ' + (reached + 1) + ' / ' + total, stepsTotal: total, stepsDone: reached + 1,
      heroCta: first ? 'Jetzt lernen' : l3Started ? 'Weitermachen' : 'Lektion starten',
      guestNote: true, tracks, toast: !!S.toast, toastText: S.toast
    };
  }
}

mount(Component, document.getElementById('app'), document.getElementById('tb-tpl').textContent);
