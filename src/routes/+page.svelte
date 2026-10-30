<script lang="ts">
	// Startseite v12: Markup aus docs/design/v12/export/index.html, als Svelte 5 Runes ohne tb-render.js.
	import { onMount } from 'svelte';
	import G from '$lib/edgar/owl-gen.js';
	import { tok } from '$lib/tabula/highlight';
	import { BOOKS_SEED } from '$lib/tabula/lessons';
	import { CATALOG, TRACK_INFO } from '$lib/tabula/lessons';
	import type { Result } from '$lib/tabula/sql';

	// ---- Konstanten ----
	const HERO_START = 'SELECT title, year\nFROM books\nWHERE year > 2010;';
	const HERO_SOL = 'SELECT title, year FROM books WHERE year > 2020';
	const BOOK_COLS: [string, string][] = [
		['id', 'int'], ['title', 'text'], ['author', 'text'], ['year', 'int'],
		['pages', 'int'], ['price', 'real'], ['genre', 'text'], ['publisher_id', 'int']
	];
	const CLAUSES = [
		{ id: 'where', label: 'WHERE year > 2015' },
		{ id: 'krimi', label: "AND genre = 'Krimi'" },
		{ id: 'order', label: 'ORDER BY year DESC' },
		{ id: 'limit', label: 'LIMIT 5' }
	];
	const T_STEPS = [
		['Klasse verbinden', 'Schüler treten mit einem Klassencode wie sonne-apfel-kugel-33 bei oder scannen den QR-Code am Beamer. Ohne Installation, auf jedem Schulrechner.', 'wave'],
		['Fortschritt sehen', 'Wer fertig ist, wer arbeitet und wer festhängt. Wer Hilfe braucht, steht oben.', 'lookaround'],
		['Gezielt helfen', 'Letzte Abfrage und Fehler auf einen Blick. So wissen Sie, wo Sie ansetzen können.', 'hint'],
		['Gemeinsam wiederholen', 'Live-Quiz am Beamer, Antworten am Handy. Danach sehen Sie, welche Fragen am schwersten waren.', 'quiz']
	];
	const ROLES = [
		{ title: 'Erklärt Konzepte', copy: 'Jede neue Klausel beginnt mit einem kurzen Beispiel.', pose: 'read' },
		{ title: 'Fragt zurück', copy: 'Erst ein Denkanstoß. Ein konkreter Hinweis nur auf Wunsch.', pose: 'thinking' },
		{ title: 'Würdigt Fortschritt', copy: 'Nach einer ganzen Lektion, nicht nach jedem Klick.', pose: 'trophy' },
		{ title: 'Hält sich zurück', copy: 'Keine Noten und keine Kommentare zu Personen. Den Lernstand sieht nur die Lehrkraft.', pose: 'sleep' }
	];
	const FAQ = [
		{ q: 'Brauchen Schüler ein Konto?', a: 'Nein. Zum Ausprobieren braucht es gar keine Anmeldung. Im Unterricht treten Schüler mit dem Klassencode bei und wählen selbst Name und Passwort. Ein Konto mit E-Mail gibt es für Schüler nicht.' },
		{ q: 'Für welche Klassenstufen ist Tabula gedacht?', a: 'Ab Klasse 10 bis zum Abitur. Die Lektionen bauen aufeinander auf und lassen sich in einzelnen Stunden einsetzen.' },
		{ q: 'Was kostet Tabula?', a: 'Nichts. Tabula ist kostenlos und Open Source unter AGPL-3.0.' },
		{ q: 'Muss die Schule etwas installieren?', a: 'Nein. Tabula läuft im Browser.' },
		{ q: 'Wo liegen die Daten?', a: 'Auf Servern in Deutschland (Hetzner, Nürnberg). Es gibt keine Werbung und kein Tracking. SQL-Abfragen verlassen den Browser nicht.' },
		{ q: 'Wie geht es nach SQL weiter?', a: 'Der Lernpfad führt über den Entwurf einer eigenen Datenbank zu Python und pandas. Im Abschlussprojekt analysieren Schüler eigene Fragestellungen mit echten Daten.' },
		{ q: 'Wie bekomme ich eine Demo?', a: 'Schreiben Sie uns über die Kontaktseite. Wir zeigen Ihnen Tabula und richten auf Wunsch eine erste Klasse ein.' }
	];
	const TRACK_DESC: Record<number, string> = {
		1: 'Wähle Spalten aus, filtere Zeilen, fasse Daten zusammen und verbinde Tabellen.',
		2: 'Entwirf Tabellen, setze Schlüssel und mache die Beziehungen zwischen deinen Daten sichtbar.',
		3: 'Schüler nehmen ihre Daten mit nach Python und werten sie mit pandas aus.'
	};
	const PHASES: [number, number, string, string, string][] = [
		[0, 10, 'Live-Quiz zur letzten Stunde', 'Am Beamer läuft ein kurzes Quiz zur vorherigen Lektion, die Klasse antwortet am Handy. Danach sehen Sie, welche Fragen am schwersten waren.', 'quiz'],
		[10, 15, 'Fokus setzen', 'Sie setzen die Lektion des Tages als Fokus. Die Klasse sieht sie direkt oben in ihrer Übersicht.', 'point'],
		[15, 70, 'Üben im eigenen Tempo', 'Die Schüler arbeiten die Lektion durch. Edgar gibt Hinweise, Sie sehen im Dashboard, wer festhängt, und helfen gezielt.', 'typing'],
		[70, 85, 'Gemeinsam besprechen', 'Sie greifen die häufigsten Fehler aus dem Dashboard auf und besprechen sie mit der ganzen Klasse.', 'lookaround'],
		[85, 90, 'Hausaufgabe freischalten', 'Die nächste Lektion wird freigeschaltet. Wer zu Hause weitermacht, macht dort weiter, wo er aufgehört hat.', 'wave']
	];
	const JOINED = ['Mia', 'Jonas', 'Lea', 'Tim', 'Noah', 'Emma', 'Ben', 'Sophie', 'Paul', 'Hannah', 'Elias', 'Lina'];
	const STUDENTS = [
		{ name: 'Mia K.', status: 'Braucht Hilfe', step: '4/5', ink: 'var(--err)' },
		{ name: 'Jonas S.', status: 'Braucht Hilfe', step: '3/5', ink: 'var(--err)' },
		{ name: 'Lea A.', status: 'In Arbeit', step: '3/5', ink: 'var(--blue)' },
		{ name: 'Tim B.', status: 'Fertig', step: '5/5', ink: 'var(--ok)' }
	];
	const ANSWERS = [
		{ label: 'WHERE', color: '#ef4444', radius: '0', rot: 'none', bg: 'var(--surface)', border: 'var(--line)' },
		{ label: 'HAVING', color: '#3b82f6', radius: '2px', rot: 'rotate(45deg)', bg: 'var(--blue-soft)', border: 'var(--blue)' },
		{ label: 'GROUP BY', color: '#eab308', radius: '50%', rot: 'none', bg: 'var(--surface)', border: 'var(--line)' },
		{ label: 'ORDER BY', color: '#22c55e', radius: '2px', rot: 'none', bg: 'var(--surface)', border: 'var(--line)' }
	];
	const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

	// ---- State ----
	let theme = $state('dark');
	let heroCode = $state(HERO_START);
	let heroState = $state<'new' | 'running' | 'ok' | 'wrong' | 'error' | 'fail'>('new');
	let heroRes = $state<Result | null>(null);
	let heroFb = $state<string | null>(null);
	let heroTyping = $state(false);
	let heroDocked = $state(false);
	let heroOwlVar = $state('curious');
	let tStep = $state(0);
	let phaseIdx = $state(0);
	let selIdx = $state(2);
	let clauseOn = $state<Record<string, boolean>>({});
	let clauseOwl = $state('read');
	let ctaOwl = $state('sleep');
	let awake = $state(false);
	let pinned = $state(false);
	let mqWave = $state(false);
	let boxW = $state(1100);
	let books = $state<{ id: number; title: string; year: number; genre: string }[]>([]);
	let db: unknown = $state(null);
	let dbBusy = $state(false);
	let menuOpen = $state(false);
	let reduce = $state(false);

	// DOM refs
	let heroRef: HTMLElement | undefined = $state();
	let edgarSpan: HTMLElement | undefined = $state();
	let heroHlPre: HTMLPreElement | undefined = $state();
	let heroTa: HTMLTextAreaElement | undefined = $state();
	let clauseHlPre: HTMLPreElement | undefined = $state();
	let tileBox: HTMLElement | undefined = $state();
	let marqueeSection: HTMLElement | undefined = $state();
	let mqOwlSpan: HTMLElement | undefined = $state();
	let clauseSection: HTMLElement | undefined = $state();
	let pathSection: HTMLElement | undefined = $state();
	let teachSection: HTMLElement | undefined = $state();
	let stundeSection: HTMLElement | undefined = $state();
	let roleSection: HTMLElement | undefined = $state();
	let roleViewport: HTMLElement | undefined = $state();
	let roleTrack: HTMLElement | undefined = $state();
	let owlIcon: { [k: string]: string } = { light: G.icon({}), dark: G.icon(G.DARK) };

	// ---- Derived ----
	const heroLines = $derived(heroCode.split('\n').map((_, i) => i + 1));
	const heroH = $derived((Math.max(3, heroCode.split('\n').length) * 24 + 28) + 'px');
	const heroRunLabel = $derived(heroState === 'running' ? 'Läuft ...' : heroRes || heroState === 'error' ? 'Erneut ausführen' : 'Ausführen');
	const heroBusy = $derived(heroState === 'running' || !db);

	function heroFbVals() {
		let fbBg = 'var(--surface)', fbInk = 'var(--text)', fbTitle = 'Bereit, wenn du es bist.';
		let fbSub = !db ? 'Die Datenbank wird geladen ...' : 'Die Abfrage ist fast fertig. Führe sie aus und schau, was Edgar sagt.';
		let owl = heroDocked ? 'wave' : 'curious';
		let bubble = 'Ich bin Edgar. Schreib die Abfrage, ich schaue mit drauf.';
		if (heroTyping) { owl = 'typing'; bubble = 'Ich lese mit ...'; }
		if (heroState === 'running') { owl = 'loading'; bubble = 'Einen Moment ...'; fbTitle = 'Abfrage läuft ...'; fbSub = ''; }
		else if (heroState === 'wrong') { owl = heroTyping ? 'typing' : 'thinking'; bubble = 'Fast. Schau dir die Jahreszahl an.'; fbBg = 'var(--blue-soft)'; fbInk = 'var(--blue)'; fbTitle = 'Noch nicht ganz.'; fbSub = heroFb ?? ''; }
		else if (heroState === 'error') { owl = heroTyping ? 'typing' : 'error'; bubble = 'Hoppla. Das kennt SQL nicht.'; fbBg = 'var(--err-bg)'; fbInk = 'var(--err)'; fbTitle = heroFb ?? ''; fbSub = 'Korrigiere die Stelle und führe die Abfrage erneut aus.'; }
		else if (heroState === 'ok') { owl = heroTyping ? 'typing' : 'celebrate'; bubble = 'Genau so!'; fbBg = 'var(--ok-bg)'; fbInk = 'var(--ok)'; fbTitle = 'Richtig!'; fbSub = 'WHERE lässt nur die passenden Zeilen durch. In der ersten Lektion geht es so weiter.'; }
		else if (heroState === 'fail') { owl = 'sleep'; fbTitle = 'Datenbank konnte nicht geladen werden.'; fbSub = 'Prüfe die Internetverbindung und lade die Seite neu.'; }
		return { fbBg, fbInk, fbTitle, fbSub, owl, bubble };
	}
	const heroFbData = $derived(heroFbVals());

	const heroEmpty = $derived(!heroRes || heroRes.rows.length === 0);
	const heroHasRows = $derived(!!heroRes && heroRes.rows.length > 0);
	const heroMeta = $derived(heroRes ? `${heroRes.rows.length} ${heroRes.rows.length === 1 ? 'Zeile' : 'Zeilen'}` : '–');
	const heroEmptyText = $derived(heroRes ? 'Keine Zeile erfüllt die Bedingung.' : 'Hier erscheint das Ergebnis deiner Abfrage.');
	const heroRows = $derived(heroRes ? heroRes.rows.slice(0, 60).map((r, i) => ({
		delay: Math.min(i, 12) * 35 + 'ms',
		cells: r.map((v) => v === null ? 'NULL' : String(v))
	})) : []);

	function clauseSql(): string {
		const o = clauseOn;
		let s = 'SELECT title, year\nFROM books';
		if (o.where || o.krimi) s += '\n' + (o.where ? 'WHERE year > 2015' : '') + (o.krimi ? (o.where ? ' AND ' : 'WHERE ') + "genre = 'Krimi'" : '');
		if (o.order) s += '\nORDER BY year DESC';
		if (o.limit) s += '\nLIMIT 5';
		return s + ';';
	}

	// book tiles
	const keptBooks = $derived(() => {
		const o = clauseOn;
		let kept = books.filter((b) => (!o.where || b.year > 2015) && (!o.krimi || b.genre === 'Krimi'));
		if (o.order) kept = kept.slice().sort((a, b) => b.year - a.year || a.id - b.id);
		if (o.limit) kept = kept.slice(0, 5);
		return kept;
	});

	const tileData = $derived(() => {
		const kept = keptBooks();
		const keptIds = new Set(kept.map((b) => b.id));
		const dropped = books.filter((b) => !keptIds.has(b.id));
		const W = boxW;
		const cols = W > 1300 ? 8 : W > 1050 ? 6 : W > 800 ? 5 : W > 600 ? 4 : W > 400 ? 3 : 2;
		const gap = 8;
		const cw = (W - gap * (cols - 1)) / cols;
		const pos: Record<number, number> = {};
		[...kept, ...dropped].forEach((b, i) => { pos[b.id] = i; });
		const any = Object.values(clauseOn).some(Boolean);
		return {
			tiles: books.map((b) => {
				const i = pos[b.id];
				const k = keptIds.has(b.id);
				return {
					title: b.title, meta: b.year + ' · ' + b.genre,
					w: cw + 'px',
					tf: `translate(${((i % cols) * (cw + gap)).toFixed(1)}px,${Math.floor(i / cols) * 68}px) scale(${k ? 1 : 0.92})`,
					op: k ? 1 : 0.18,
					bg: k && any ? 'var(--blue-soft)' : 'var(--surface)',
					border: k && any ? 'var(--blue)' : 'var(--line)'
				};
			}),
			tileH: (Math.ceil(books.length / cols) * 68) + 'px',
			clauseCount: kept.length,
			clauseCountLabel: 'von ' + books.length + ' Zeilen im Ergebnis'
		};
	});

	// path
	const cat = CATALOG;
	const selEntry = $derived(cat[selIdx] ?? cat[0]);
	const pathFill = $derived((selIdx / 10 * 91) + '%');
	const owlLeft = $derived(((selIdx + 0.5) / 11 * 100) + '%');
	function poseFor(i: number) {
		const c = cat[i]; if (!c) return 'idle';
		if (c.n === 'P') return 'trophy';
		if (c.track === 3) return 'laptop';
		if (c.track === 2) return 'graduate';
		return i === 2 ? 'typing' : i === 6 ? 'thinking' : 'read';
	}
	const pathOwl = $derived(poseFor(selIdx));

	// phase
	const phase = $derived(PHASES[phaseIdx] ?? PHASES[0]);
	const phLeft = $derived(((phase[0] + phase[1]) / 2 / 90 * 100) + '%');
	const phRange = $derived(phase[0] + '–' + phase[1] + ' min');

	// sticky / pinned
	const stickyPos = $derived(pinned ? 'sticky' : 'relative');
	const stickyMinH = $derived(pinned ? 'calc(100vh - 68px)' : '0');
	const teachWrapH = $derived(pinned ? '280vh' : 'auto');
	const stundeWrapH = $derived(pinned ? '300vh' : 'auto');
	const pathWrapH = $derived(pinned ? '320vh' : 'auto');
	const clauseWrapH = $derived(pinned ? '300vh' : 'auto');
	const roleWrapH = $derived(pinned ? '340vh' : 'auto');
	const roleOverflow = $derived(pinned ? 'hidden' : 'auto');
	const clauseIntro = $derived(pinned
		? 'Scrolle weiter: Klausel für Klausel wächst die Abfrage, und die 30 Bücher der Schulbibliothek ordnen sich neu. Du kannst jede Klausel auch selbst an- und ausschalten.'
		: 'Schalte die Klauseln an und aus. Die Abfrage wächst, und die 30 Bücher der Schulbibliothek ordnen sich neu.');

	// ---- Svelte highlight ----
	function highlight(sql: string): string {
		return sql.split('\n').map((line) =>
			tok(line).map((t) => `<span style="color:${t.c}">${t.t.replace(/[&<>"']/g, (c: string) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!)}</span>`).join('')
		).join('\n');
	}

	// ---- Theme ----
	function applyTheme(t: string, save = false) {
		const root = document.documentElement;
		if (t === 'light') {
			root.classList.add('light');
			root.dataset.tb = 'light';
		} else {
			root.classList.remove('light');
			delete root.dataset.tb;
		}
		// Nur speichern, wenn jemand den Schalter benutzt (Datenschutz: Eintrag erst durch eigene Handlung)
		if (save) try { localStorage.setItem('tabula-theme', t); } catch { /* ignore */ }
	}

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		applyTheme(theme, true);
		paintOwls();
	}

	// ---- Owl painting ----
	function paintOwls() {
		const dark = theme === 'dark';
		document.querySelectorAll<HTMLElement>('[data-owl]').forEach((el) => {
			const key = el.getAttribute('data-owl') || 'idle';
			const darkOpt = dark || el.getAttribute('data-owl-dark') === '1';
			const opt = darkOpt ? G.DARK : {};
			const state = (reduce || !G.ANIMS?.[key]) ? 'static' : 'loop';
			const tag = key + (darkOpt ? '-d' : '') + '-' + state;
			if (el.dataset.cur === tag) return;
			let svg = state === 'static' ? G.owl({ ...(G.STATES?.[key] || {}), ...opt }) : G.animSvg(key, opt);
			el.innerHTML = svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
			el.dataset.cur = tag;
		});
		// icon refs
		document.querySelectorAll<HTMLElement>('[data-owl-icon]').forEach((el) => {
			const k = dark ? 'dark' : 'light';
			if (el.dataset.k !== k) {
				el.innerHTML = (owlIcon[k] || '').replace('<svg ', '<svg style="width:100%;height:100%;display:block" aria-hidden="true" ');
				el.dataset.k = k;
			}
		});
		// paint hero highlight
		if (heroHlPre) heroHlPre.innerHTML = highlight(heroCode);
		if (clauseHlPre) clauseHlPre.innerHTML = highlight(clauseSql());
	}

	// ---- Flash clause owl ----
	let clauseFlashTimer: ReturnType<typeof setTimeout>;
	function flashClause(pose: string) {
		clearTimeout(clauseFlashTimer);
		clauseOwl = pose;
		clauseFlashTimer = setTimeout(() => { clauseOwl = 'read'; }, 1400);
	}

	// ---- Hero run ----
	let typingTimer: ReturnType<typeof setTimeout>;
	async function heroRun() {
		if (!db || heroState === 'running') return;
		const sql = heroCode.trim(); if (!sql) return;
		heroState = 'running';
		heroTyping = false;
		await new Promise((r) => setTimeout(r, 280));
		try {
			const { runIsolated, run, compare, explainError } = await import('$lib/tabula/sql');
			const res = runIsolated(db as Parameters<typeof runIsolated>[0], sql);
			const sol = run(db as Parameters<typeof run>[0], HERO_SOL);
			const c = compare(res, sol, false);
			heroState = c.ok ? 'ok' : 'wrong';
			heroRes = res;
			heroFb = c.ok ? null : (c as { ok: false; msg: string; sub: string }).sub;
		} catch (e) {
			const { explainError } = await import('$lib/tabula/sql');
			const x = explainError(sql, e);
			heroState = 'error';
			heroRes = null;
			heroFb = x.msg;
		}
	}

	function insertHero(txt: string) {
		const code = heroCode;
		const a = heroTa ? heroTa.selectionStart : code.length;
		const b = heroTa ? heroTa.selectionEnd : code.length;
		const before = code.slice(0, a);
		const pad = before && !/[\s(,]$/.test(before) ? ' ' : '';
		heroCode = before + pad + txt + code.slice(b);
		const pos = a + pad.length + txt.length;
		requestAnimationFrame(() => { if (heroTa) { heroTa.focus(); heroTa.setSelectionRange(pos, pos); } });
	}

	// ---- Scroll tick ----
	let raf = 0;
	function tick() {
		const fx = !reduce;
		const vh = innerHeight;
		if (!fx) return;

		// Edgar climb
		if (edgarSpan) {
			const card = edgarSpan.parentElement?.parentElement?.getBoundingClientRect();
			if (card) {
				const p = clamp((vh * 0.92 - card.top) / (vh * 0.3));
				const e = p < 1 ? 1 - Math.pow(1 - p, 3) : 1;
				if (heroRef) heroRef.style.setProperty('--hp', e.toFixed(3));
				const d = e > 0.96;
				if (d !== heroDocked) heroDocked = d;
			}
		}

		// Marquee
		if (marqueeSection) {
			const r = marqueeSection.getBoundingClientRect();
			marqueeSection.style.setProperty('--mp', clamp((vh - r.top) / (vh + r.height)).toFixed(4));
		}

		// mqOwl
		if (mqOwlSpan) {
			const r = mqOwlSpan.getBoundingClientRect();
			const w = r.left <= innerWidth * 0.85 && r.right > 0 && r.bottom > 0 && r.top < vh;
			if (w !== mqWave) mqWave = w;
		}

		if (!pinned) return;

		const prog = (el: HTMLElement) => {
			const r = el.getBoundingClientRect();
			return clamp((68 - r.top) / Math.max(1, r.height - vh + 68));
		};

		if (clauseSection) {
			const p = prog(clauseSection);
			clauseSection.style.setProperty('--cp', p.toFixed(3));
			const n = Math.min(4, Math.floor(p * 5.2));
			if (n !== lastClause) {
				lastClause = n;
				const on: Record<string, boolean> = {};
				CLAUSES.slice(0, n).forEach((x) => { on[x.id] = true; });
				clauseOn = on;
				if (n) flashClause(['curious', 'curious', 'lookaround', 'surprised'][n - 1]);
			}
		}

		if (pathSection) {
			const p = prog(pathSection);
			const s = Math.min(10, Math.round(p * 10));
			if (s !== selIdx) selIdx = s;
		}

		if (roleSection && roleTrack && roleViewport) {
			const p = prog(roleSection);
			const max = Math.max(0, roleTrack.scrollWidth - roleViewport.clientWidth);
			roleSection.style.setProperty('--rp', p.toFixed(3));
			roleTrack.style.setProperty('--rx', (p * max).toFixed(1));
		}

		if (stundeSection) {
			const p = prog(stundeSection);
			stundeSection.style.setProperty('--sp', p.toFixed(3));
			const s = Math.min(4, Math.floor(p * 5));
			if (s !== phaseIdx) phaseIdx = s;
		}

		if (teachSection) {
			const p = prog(teachSection);
			teachSection.style.setProperty('--tp', p.toFixed(3));
			const s = Math.min(3, Math.floor(p * 4));
			if (s !== tStep) tStep = s;
		}
	}
	let lastClause = -1;

	function onScroll() {
		if (!raf) raf = requestAnimationFrame(() => { raf = 0; tick(); });
	}
	function onResize() {
		const p = !reduce && innerWidth >= 900 && innerHeight >= 680;
		if (p !== pinned) pinned = p;
		if (tileBox) {
			const w = Math.round(tileBox.getBoundingClientRect().width);
			if (w && w !== boxW) boxW = w;
		}
		onScroll();
	}

	// ---- CTA ----
	let wt1: ReturnType<typeof setTimeout>, wt2: ReturnType<typeof setTimeout>;
	function wake() {
		if (awake) return;
		awake = true;
		clearTimeout(wt1); clearTimeout(wt2);
		ctaOwl = 'surprised';
		wt1 = setTimeout(() => { ctaOwl = 'wave'; }, 650);
		wt2 = setTimeout(() => { ctaOwl = 'heart'; }, 2200);
	}

	// ---- Mouse track for Edgar pupils ----
	function onMove(e: PointerEvent) {
		if (!edgarSpan) return;
		const p = edgarSpan.querySelector<SVGElement>('.pupils');
		if (!p) return;
		const r = edgarSpan.getBoundingClientRect();
		const dx = e.clientX - (r.left + r.width * 0.47);
		const dy = e.clientY - (r.top + r.height * 0.43);
		const d = Math.hypot(dx, dy) || 1;
		const k = Math.min(1, d / 240);
		p.style.transition = 'transform .12s';
		p.style.transform = `translate(${(dx / d * 4 * k).toFixed(2)}px,${(dy / d * 4 * k).toFixed(2)}px)`;
	}

	// ---- Effect: repaint owls when theme/state changes ----
	$effect(() => {
		theme; heroFbData.owl; clauseOwl; mqWave; ctaOwl; tStep; pathOwl; phaseIdx;
		paintOwls();
	});

	$effect(() => {
		if (heroHlPre) heroHlPre.innerHTML = highlight(heroCode);
	});

	$effect(() => {
		if (clauseHlPre) clauseHlPre.innerHTML = highlight(clauseSql());
	});

	// ---- Mount ----
	onMount(() => {
		// Theme init
		let stored = 'dark';
		try { stored = localStorage.getItem('tabula-theme') ?? 'dark'; } catch { /* ignore */ }
		theme = stored === 'light' ? 'light' : 'dark';
		applyTheme(theme);
		document.documentElement.lang = 'de';

		reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		pinned = !reduce && innerWidth >= 900 && innerHeight >= 680;

		// Owl icons are prepared at declaration (otherwise the first paint stores an empty icon)

		// Parse books from BOOKS_SEED
		books = [...BOOKS_SEED.matchAll(/\((\d+),'((?:[^']|'')*)','(?:[^']|'')*',(\d+|NULL),(?:\d+|NULL),(?:[\d.]+|NULL),'(\w+)',\d+\)/g)]
			.map((m) => ({ id: +m[1], title: m[2].replace("''", "'"), year: +m[3], genre: m[4] }));

		paintOwls();
		tick();

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		window.addEventListener('pointermove', onMove, { passive: true });

		// Load DB
		import('$lib/tabula/sql').then(({ openDb }) => {
			openDb(BOOKS_SEED).then((d) => {
				db = d;
			}).catch(() => { heroState = 'fail'; });
		});

		// ResizeObserver for tile box
		let ro: ResizeObserver;
		if (tileBox) {
			ro = new ResizeObserver((es) => {
				const w = Math.round(es[0].contentRect.width);
				if (w && w !== boxW) boxW = w;
			});
			ro.observe(tileBox);
		}

		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('pointermove', onMove as EventListener);
			ro?.disconnect();
			// Restore theme state from app's perspective (don't clear html.light)
		};
	});
</script>

<svelte:head>
	<title>Tabula · SQL im Informatikunterricht, kostenlos im Browser</title>
	<meta name="description" content="Tabula bringt SQL in den Informatikunterricht: Abfragen an echte Daten direkt im Browser, Hinweise von Edgar und ein Überblick für Lehrkräfte. Kostenlos und Open Source.">
</svelte:head>

<style>
	/* v12 Tokens und Resets. Hover-Zustände. */
	:root {
		color-scheme: dark;
		--bg: #0b1220;
		--surface: #111b2d;
		--raised: #162237;
		--text: #e8eef7;
		--muted: #a5b4c9;
		--line: #2a3850;
		--blue: #60a5fa;
		--primary: #2563eb;
		--blue-soft: #172a54;
		--ok: #9ae6b4;
		--ok-bg: #132d29;
		--err: #ffb4b4;
		--err-bg: #371f2a;
		--code-bg: #0d1526;
		--tok-kw: #93c5fd;
		--tok-str: #86efac;
		--tok-num: #fdba74;
		--tok-com: #94a3b8;
		--ink-3: #8796ad;
		--shadow: 0 40px 90px -40px rgb(0 0 0/.8);
	}
	:global(html.light) {
		color-scheme: light;
		--bg: #f8fafc;
		--surface: #fff;
		--raised: #f1f5f9;
		--text: #0f172a;
		--muted: #526176;
		--line: #dce3ed;
		--blue: #2563eb;
		--blue-soft: #eff6ff;
		--ok: #17643a;
		--ok-bg: #effaf3;
		--err: #b42333;
		--err-bg: #fff0f1;
		--code-bg: #fcfdfe;
		--tok-kw: #1d4ed8;
		--tok-str: #15803d;
		--tok-num: #b45309;
		--tok-com: #64748b;
		--ink-3: #64748b;
		--shadow: 0 40px 90px -40px rgb(15 23 42/.28);
	}
	.lp {
		background: var(--bg);
		overflow-x: clip;
		color: var(--text);
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		-webkit-font-smoothing: antialiased;
	}
	.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
	.lp ::selection { background: var(--primary); color: #fff; }
	.lp *::-webkit-scrollbar { width: 10px; height: 10px; }
	.lp *::-webkit-scrollbar-thumb { background: var(--line); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
	.lp a { color: var(--blue); text-underline-offset: 3px; }
	.lp a:hover { color: var(--text); }
	.lp button { font: inherit; color: inherit; }
	.lp summary { list-style: none; cursor: pointer; }
	.lp summary::-webkit-details-marker { display: none; }
	.lp details[open] .tb-chev { transform: rotate(90deg); }
	.lp :focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
	@keyframes tbIn { from { transform: translateY(8px); } to { transform: none; } }
	@keyframes tbBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
	@media (prefers-reduced-motion: reduce) {
		.lp * { animation: none !important; transition: none !important; }
	}
	.lp [data-hv="1"]:hover { color: var(--text) !important; }
	.lp [data-hv="2"]:hover { color: var(--text) !important; }
	.lp [data-hv="3"]:hover { color: var(--text) !important; }
	.lp [data-hv="4"]:hover { color: var(--text) !important; }
	.lp [data-hv="5"]:hover { color: var(--text) !important; background: var(--surface) !important; }
	.lp [data-hv="6"]:hover { background: var(--surface) !important; color: var(--text) !important; }
	.lp [data-hv="7"]:hover { padding-left: 16px !important; color: var(--blue) !important; background: var(--blue-soft) !important; }
	.lp [data-hv="8"]:hover { padding-left: 16px !important; color: var(--text) !important; background: var(--surface) !important; }
	.lp [data-hv="9"]:hover { background: var(--blue-soft) !important; }
	.lp [data-hv="10"]:hover { background: #1d4ed8 !important; }
	.lp [data-hv="11"]:hover { color: var(--text) !important; }
	.lp [data-hv="12"]:hover { color: var(--blue) !important; }
	.lp [data-hv="13"]:hover { color: var(--text) !important; }
	.lp [data-hv="14"]:hover { color: var(--text) !important; }
	.lp [data-hv="15"]:hover { opacity: 1 !important; }
	.lp [data-hv="16"]:hover { background: #1d4ed8 !important; color: #fff !important; }
	.lp [data-hv="17"]:hover { color: var(--text) !important; }
	.lp [data-hv="18"]:hover { color: #fff !important; opacity: .85 !important; }
	.lp [data-hv="19"]:hover { color: #fff !important; opacity: .85 !important; }
	.lp [data-hv="20"]:hover { color: #fff !important; opacity: .9 !important; }
	.lp [data-hv="21"]:hover { color: var(--text) !important; }
	.lp [data-hv="22"]:hover { color: var(--text) !important; }
	.lp [data-hv="23"]:hover { color: var(--text) !important; }
	.lp [data-hv="24"]:hover { color: var(--text) !important; }
	.lp [data-hv="25"]:hover { color: var(--text) !important; }
	.lp [data-hv="26"]:hover { color: var(--text) !important; }
	.lp [data-hv="27"]:hover { color: var(--text) !important; }
	.lp [data-hv="28"]:hover { color: var(--text) !important; }
	.lp [data-hv="29"]:hover { color: var(--text) !important; }
	.lp header { scroll-padding-top: 80px; }
	/* Desktop: show nav links, hide hamburger; Mobile: hide nav links, show hamburger */
	.lp-nav-mobile { display: none !important; }
	@media (max-width: 767px) {
		.lp-nav-desktop { display: none !important; }
		.lp-nav-mobile { display: grid !important; }
	}
</style>

<div class="lp">
  <!-- Header -->
  <header style="position:sticky;top:0;z-index:40;background:var(--bg);border-bottom:1px solid var(--line)">
    <div style="max-width:1760px;margin:0 auto;padding:0 clamp(16px,4vw,64px);min-height:60px;display:flex;align-items:center;gap:16px">
      <a href="#start" aria-label="Tabula Startseite" style="display:flex;align-items:center;gap:9px;color:var(--text);text-decoration:none;font-weight:600;font-size:20px;letter-spacing:-.03em;flex:none">
        <span data-owl-icon="1" style="width:32px;height:28px;display:block"></span>Tabula
      </a>
      <!-- Desktop nav -->
      <nav aria-label="Hauptnavigation" class="lp-nav-desktop" style="display:flex;gap:26px;flex:1;font-size:14px">
        <a href="https://app.tabulasql.de/learn" style="color:var(--muted);text-decoration:none" data-hv="1">Lernen</a>
        <a href="/datasets" style="color:var(--muted);text-decoration:none" data-hv="2">Datensätze</a>
        <a href="#lernpfad" style="color:var(--muted);text-decoration:none" data-hv="3">Lernpfad</a>
        <a href="#lehrkraefte" style="color:var(--muted);text-decoration:none" data-hv="4">Für Lehrkräfte</a>
      </nav>
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <button type="button" onclick={toggleTheme} aria-label="Hell/Dunkel umschalten" class="lp-nav-desktop" style="width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--muted);cursor:pointer" data-hv="5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5.5"></circle><path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5Z" fill="currentColor"></path></svg>
        </button>
        <a href="https://app.tabulasql.de/login" style="display:inline-flex;align-items:center;height:36px;padding:0 14px;border:1px solid var(--line);border-radius:8px;color:var(--text);text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap" data-hv="6">Anmelden</a>
        <!-- Mobile hamburger -->
        <button type="button" onclick={() => menuOpen = !menuOpen} aria-label="Menü" aria-expanded={menuOpen} class="lp-nav-mobile" style="width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--muted);cursor:pointer">
          {#if menuOpen}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="2" y1="4.5" x2="14" y2="4.5"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="11.5" x2="14" y2="11.5"/></svg>
          {/if}
        </button>
      </div>
    </div>
    <!-- Mobile dropdown -->
    {#if menuOpen}
      <nav aria-label="Hauptnavigation mobil" style="border-top:1px solid var(--line);background:var(--bg);padding:12px clamp(16px,4vw,64px);display:flex;flex-direction:column;gap:0">
        <a href="https://app.tabulasql.de/learn" onclick={() => menuOpen=false} style="padding:12px 0;color:var(--muted);text-decoration:none;font-size:15px;border-bottom:1px solid var(--line)">Lernen</a>
        <a href="/datasets" onclick={() => menuOpen=false} style="padding:12px 0;color:var(--muted);text-decoration:none;font-size:15px;border-bottom:1px solid var(--line)">Datensätze</a>
        <a href="#lernpfad" onclick={() => menuOpen=false} style="padding:12px 0;color:var(--muted);text-decoration:none;font-size:15px;border-bottom:1px solid var(--line)">Lernpfad</a>
        <a href="#lehrkraefte" onclick={() => menuOpen=false} style="padding:12px 0;color:var(--muted);text-decoration:none;font-size:15px">Für Lehrkräfte</a>
        <div style="padding-top:12px;margin-top:4px">
          <button type="button" onclick={() => { toggleTheme(); menuOpen=false; }} aria-label="Hell/Dunkel umschalten" style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px;background:none;border:0;cursor:pointer;padding:0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5.5"></circle><path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5Z" fill="currentColor"></path></svg>
            Hell/Dunkel
          </button>
        </div>
      </nav>
    {/if}
  </header>

  <main id="start">
    <!-- Hero -->
    <section bind:this={heroRef} aria-label="Einstieg" style="position:relative;max-width:1760px;margin:0 auto;padding:clamp(32px,7vh,96px) clamp(20px,4vw,64px) 0">
      <div>
        <h1 style="margin:0;font-size:clamp(46px,11vw,232px);line-height:.86;font-weight:700;letter-spacing:-.055em">
          <span style="display:block;white-space:nowrap">SQL lernen.</span>
          <span style="display:block;color:var(--blue)">Einfach</span>
          <span style="display:block;color:var(--blue);white-space:nowrap">ausprobieren.<span aria-hidden="true" style="display:inline-block;width:.07em;height:.74em;margin-left:.05em;background:var(--blue);vertical-align:-.02em;animation:tbBlink 1.1s steps(1) infinite"></span></span>
        </h1>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:24px 64px;align-items:flex-end;justify-content:space-between;margin-top:clamp(28px,4vh,56px)">
        <p style="margin:0;max-width:600px;font-size:clamp(16px,1.25vw,21px);line-height:1.6;color:var(--muted);text-wrap:pretty;flex:1 1 340px">Tabula bringt SQL in den Informatikunterricht. Schüler schreiben Abfragen an echte Daten direkt im Browser und bekommen Hinweise, die weiterhelfen. Lehrkräfte sehen, wo ihre Klasse steht. Kostenlos und Open Source.</p>
        <div style="flex:1 1 100%;display:flex;flex-wrap:wrap;gap:0 clamp(24px,4vw,72px);margin-top:clamp(8px,2vh,24px)">
          <a href="https://app.tabulasql.de/learn" style="flex:1 1 380px;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:clamp(18px,2.2vw,28px) 4px clamp(18px,2.2vw,28px) 0;border-top:2px solid var(--text);color:var(--blue);text-decoration:none;transition:padding .35s cubic-bezier(.16,1,.3,1),background .25s" data-hv="7">
            <span style="display:flex;flex-direction:column;gap:6px;min-width:0">
              <span style="font-size:14px;font-weight:500;color:var(--muted)">Für Schüler</span>
              <span style="font-size:clamp(28px,3.4vw,64px);line-height:1;font-weight:700;letter-spacing:-.045em">Erste Lektion starten</span>
            </span>
            <span style="flex:none;width:clamp(48px,4vw,68px);height:clamp(48px,4vw,68px);border-radius:50%;display:grid;place-items:center;border:2px solid var(--blue);color:var(--blue);transition:transform .4s cubic-bezier(.16,1,.3,1),background .25s,color .25s"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg></span>
          </a>
          <a href="https://app.tabulasql.de/login?rolle=lehrkraft" style="flex:1 1 380px;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:clamp(18px,2.2vw,28px) 4px clamp(18px,2.2vw,28px) 0;border-top:2px solid var(--text);color:var(--text);text-decoration:none;transition:padding .35s cubic-bezier(.16,1,.3,1),background .25s" data-hv="8">
            <span style="display:flex;flex-direction:column;gap:6px;min-width:0">
              <span style="font-size:14px;font-weight:500;color:var(--muted)">Für Lehrkräfte</span>
              <span style="font-size:clamp(28px,3.4vw,64px);line-height:1;font-weight:700;letter-spacing:-.045em">Lehrer-Konto erstellen</span>
            </span>
            <span style="flex:none;width:clamp(48px,4vw,68px);height:clamp(48px,4vw,68px);border-radius:50%;display:grid;place-items:center;border:2px solid var(--text);color:var(--text);transition:transform .4s cubic-bezier(.16,1,.3,1),background .25s,color .25s"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg></span>
          </a>
        </div>
        <p style="flex:1 1 100%;margin:-8px 0 0;font-size:14px;color:var(--muted)">Lieber erst sehen, wie es im Unterricht läuft? <a href="/kontakt">Demo anfragen</a></p>
      </div>

      <!-- Studio -->
      <div id="studio" style="position:relative;margin-top:clamp(150px,18vh,220px)">
        <div aria-hidden="true" style="position:absolute;right:clamp(16px,6%,120px);bottom:100%;width:180px;height:166px;overflow:hidden;z-index:3;pointer-events:none">
          <span bind:this={edgarSpan} data-owl={heroFbData.owl} class="hero-owl" style="position:absolute;left:0;bottom:-4px;width:180px;height:162px;transform:translateY(calc((1 - var(--hp,1)) * 105%)) rotate(calc((1 - var(--hp,1)) * 8deg));transform-origin:50% 100%;will-change:transform"></span>
        </div>
        <p aria-live="polite" style="position:absolute;right:calc(clamp(16px,6%,120px) + 192px);bottom:calc(100% + 56px);margin:0;padding:10px 14px;max-width:260px;border:1px solid var(--line);border-radius:12px 12px 2px 12px;background:var(--surface);font-size:15px;line-height:1.4;color:var(--text);text-wrap:balance;opacity:{heroDocked ? 1 : 0};transform:translateY({heroDocked ? '0' : '10px'});transition:opacity .35s ease, transform .5s cubic-bezier(.34,1.56,.64,1)">{heroFbData.bubble}</p>
        <div style="position:relative;z-index:2;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 22px;border-bottom:1px solid var(--line)">
            <span style="font-size:15px;font-weight:600">Probier es aus</span>
            <span style="font:12px 'IBM Plex Mono',monospace;color:var(--muted)">schulbibliothek.db · läuft in deinem Browser</span>
            <span style="flex:1"></span>
            <span style="font-size:13px;color:var(--muted)">Aus Lektion 3 · Mit WHERE filtern</span>
          </div>
          <div style="display:flex;flex-wrap:wrap">
            <aside aria-label="Schema books" style="flex:0 1 230px;min-width:200px;border-right:1px solid var(--line);padding:16px 10px;background:var(--bg)">
              <p style="margin:0 0 8px 8px;font:600 13px 'IBM Plex Mono',monospace">books <span style="font-weight:400;color:var(--muted)">· 30 Zeilen</span></p>
              {#each BOOK_COLS as [name, type]}
                <button type="button" onclick={() => insertHero(name)} style="width:100%;display:flex;justify-content:space-between;gap:8px;min-height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;cursor:pointer;font:13px 'IBM Plex Mono',monospace;color:var(--text);text-align:left" data-hv="9">
                  <span>{name}</span><span style="color:var(--muted);font-size:11px">{type}</span>
                </button>
              {/each}
              <p style="margin:10px 8px 0;font-size:12px;line-height:1.5;color:var(--muted)">Klick fügt den Namen in die Abfrage ein.</p>
            </aside>
            <div style="flex:1 1 440px;min-width:0;border-right:1px solid var(--line);display:flex;flex-direction:column">
              <div style="padding:22px 24px 18px">
                <h2 style="margin:0 0 6px;font-size:clamp(20px,1.6vw,26px);font-weight:600;letter-spacing:-.015em">Welche Bücher sind nach 2020 erschienen?</h2>
                <p style="margin:0;font-size:15px;color:var(--muted)">Zeige title und year.</p>
              </div>
              <div style="margin:0 24px;border:1px solid var(--line);border-radius:10px;background:var(--code-bg);overflow:hidden">
                <div style="display:flex">
                  <div aria-hidden="true" style="flex:none;width:40px;padding:14px 10px 14px 0;text-align:right;font:15px/24px 'IBM Plex Mono',monospace;color:var(--ink-3);border-right:1px solid var(--line);user-select:none">
                    {#each heroLines as ln}<div>{ln}</div>{/each}
                  </div>
                  <div style="position:relative;flex:1;min-width:0;overflow-x:auto">
                    <pre bind:this={heroHlPre} aria-hidden="true" style="position:absolute;inset:0;margin:0;padding:14px 16px;font:15px/24px 'IBM Plex Mono',monospace;white-space:pre;color:var(--text);pointer-events:none"></pre>
                    <textarea bind:this={heroTa} id="query" aria-label="SQL-Abfrage" value={heroCode}
                      oninput={(e) => { heroCode = (e.target as HTMLTextAreaElement).value; clearTimeout(typingTimer); heroTyping = true; typingTimer = setTimeout(() => { heroTyping = false; }, 1200); }}
                      onkeydown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); heroRun(); } }}
                      spellcheck="false" autocomplete="off" autocapitalize="off"
                      style="position:relative;display:block;width:100%;height:{heroH};margin:0;padding:14px 16px;border:0;resize:none;overflow:hidden;background:transparent;color:transparent;caret-color:var(--blue);font:15px/24px 'IBM Plex Mono',monospace;white-space:pre;outline:none"></textarea>
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 24px 22px">
                <button id="run" type="button" onclick={heroRun} disabled={heroBusy} style="display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px;border:0;border-radius:8px;background:var(--primary);color:#fff;font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap" data-hv="10">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"></path></svg>{heroRunLabel}
                </button>
                <span style="font-size:13px;color:var(--muted)">Strg / ⌘ + Enter</span>
                <span style="flex:1"></span>
                <button type="button" onclick={() => { heroCode = HERO_START; heroState = 'new'; heroRes = null; heroFb = null; }} style="border:0;background:none;color:var(--muted);font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:3px" data-hv="11">Zurücksetzen</button>
              </div>
            </div>
            <div style="flex:1 1 380px;min-width:0;display:flex;flex-direction:column">
              <div id="feedback" aria-live="polite" style="padding:16px 22px;min-height:88px;border-bottom:1px solid var(--line);background:{heroFbData.fbBg};transition:background .25s">
                <p style="margin:0;font-size:16px;font-weight:600;color:{heroFbData.fbInk}">{heroFbData.fbTitle}</p>
                <p style="margin:3px 0 0;font-size:14px;line-height:1.5;color:var(--text);text-wrap:pretty">{heroFbData.fbSub}</p>
              </div>
              <div style="display:flex;justify-content:space-between;padding:10px 22px;font-size:13px;color:var(--muted);border-bottom:1px solid var(--line)">
                <span id="result-count" style="font-weight:600;color:var(--text)">Ergebnis</span><span style="font-variant-numeric:tabular-nums">{heroMeta}</span>
              </div>
              <div id="result-content" style="flex:1;max-height:340px;min-height:220px;overflow:auto">
                {#if heroEmpty}
                  <p style="margin:0;padding:56px 24px;text-align:center;font-size:14px;color:var(--muted);text-wrap:balance">{heroEmptyText}</p>
                {/if}
                {#if heroHasRows && heroRes}
                  <table style="width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums">
                    <thead><tr>
                      {#each heroRes.columns as h}<th style="position:sticky;top:0;text-align:left;padding:8px 22px;font:500 12px 'IBM Plex Mono',monospace;color:var(--muted);background:var(--raised)">{h}</th>{/each}
                    </tr></thead>
                    <tbody>
                      {#each heroRows as row}
                        <tr style="animation:tbIn .35s cubic-bezier(.16,1,.3,1) both;animation-delay:{row.delay}">
                          {#each row.cells as c}<td style="padding:8px 22px;border-bottom:1px solid var(--line);white-space:nowrap">{c}</td>{/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/if}
              </div>
            </div>
          </div>
        </div>
        <p style="margin:14px 4px 0;font-size:14px;color:var(--muted)">Die Abfrage läuft auf einer echten SQLite-Datenbank in deinem Browser und verlässt ihn nicht.</p>
      </div>
    </section>

    <!-- Lehrer kurz -->
    <section id="lehrer-kurz" aria-label="Für Lehrkräfte kurz" style="max-width:1760px;margin:0 auto;padding:clamp(80px,11vh,140px) clamp(20px,4vw,64px) 0">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:32px clamp(32px,4vw,80px);padding:clamp(28px,3.5vw,56px);border-radius:22px;background:var(--surface);border:1px solid var(--line)">
        <span data-owl="raisehand" style="flex:none;width:clamp(110px,9vw,160px);aspect-ratio:200/180"></span>
        <div style="flex:1 1 300px;min-width:0">
          <h2 style="margin:0;font-size:clamp(30px,3vw,52px);line-height:1.02;font-weight:700;letter-spacing:-.04em">Sie unterrichten SQL?</h2>
          <p style="margin:12px 0 0;max-width:46ch;font-size:clamp(16px,1.15vw,19px);line-height:1.6;color:var(--muted);text-wrap:pretty">Tabula begleitet Ihre Klasse von der ersten Abfrage bis zur Datenanalyse. Kostenlos, ohne Installation.</p>
        </div>
        <dl style="flex:2 1 520px;min-width:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0">
          <div style="padding:4px 24px 4px 0;border-left:1px solid var(--line);padding-left:20px"><dt style="font-size:17px;font-weight:600">Klassen &amp; Fortschritt</dt><dd style="margin:6px 0 0;font-size:15px;line-height:1.55;color:var(--muted)">Wer fertig ist, wer arbeitet und wer festhängt. Wer Hilfe braucht, steht oben.</dd></div>
          <div style="padding:4px 24px 4px 20px;border-left:1px solid var(--line)"><dt style="font-size:17px;font-weight:600">Live-Quiz</dt><dd style="margin:6px 0 0;font-size:15px;line-height:1.55;color:var(--muted)">Am Beamer wiederholen, Antworten am Handy. Punkte nur im Quiz, keine Noten.</dd></div>
          <div style="padding:4px 24px 4px 20px;border-left:1px solid var(--line)"><dt style="font-size:17px;font-weight:600">Datenschutz</dt><dd style="margin:6px 0 0;font-size:15px;line-height:1.55;color:var(--muted)">Server in Deutschland (Hetzner, Nürnberg). Kein Tracking.</dd></div>
        </dl>
        <div style="flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;padding-top:24px;border-top:1px solid var(--line)">
          <a href="https://app.tabulasql.de/login?rolle=lehrkraft" style="display:inline-flex;align-items:center;gap:14px;color:var(--text);text-decoration:none;font-size:clamp(22px,2vw,32px);font-weight:700;letter-spacing:-.035em;margin-right:auto" data-hv="12">Lehrer-Konto erstellen<span style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:2px solid currentColor"><svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg></span></a>
          <a href="#stunde" style="font-size:15px;font-weight:500;color:var(--blue);text-decoration:none" data-hv="13">So sieht eine Doppelstunde aus</a>
          <a href="#lernpfad" style="font-size:15px;font-weight:500;color:var(--blue);text-decoration:none" data-hv="14">Was der Lernpfad abdeckt</a>
        </div>
      </div>
    </section>

    <!-- Lehrkräfte (sticky) -->
    <section bind:this={teachSection} id="lehrkraefte" aria-label="Für Lehrkräfte" style="position:relative;height:{teachWrapH};margin-top:clamp(64px,10vh,140px);background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div style="position:{stickyPos};top:68px;min-height:{stickyMinH};display:flex;flex-direction:column;justify-content:center;max-width:1760px;margin:0 auto;padding:40px clamp(20px,4vw,64px)">
        <div style="display:flex;flex-wrap:wrap;gap:20px 64px;align-items:flex-end;justify-content:space-between">
          <h2 style="margin:0;font-size:clamp(36px,4.4vw,84px);line-height:.98;font-weight:700;letter-spacing:-.045em;max-width:14ch">Den Lernstand sehen. Gezielt unterstützen.</h2>
          <p style="margin:0;max-width:440px;font-size:clamp(16px,1.15vw,19px);line-height:1.6;color:var(--muted)">Von der ersten Stunde bis zur Wiederholung: So begleitet Tabula Ihren Unterricht.</p>
        </div>
        <div style="margin-top:clamp(28px,4vh,48px);display:flex;flex-wrap:wrap;gap:32px clamp(32px,4vw,72px)">
          <div role="tablist" aria-label="Unterrichtsablauf" style="flex:1 1 300px;max-width:460px;display:flex;flex-direction:column;border-top:1px solid var(--line)">
            {#each T_STEPS as ts, i}
              <button type="button" role="tab" aria-selected={i === tStep ? 'true' : 'false'} onclick={() => tStep = i} style="display:flex;flex-direction:column;gap:4px;text-align:left;padding:16px 0 16px 18px;border:0;border-bottom:1px solid var(--line);background:transparent;cursor:pointer;opacity:{i === tStep ? 1 : 0.5};box-shadow:inset 3px 0 0 {i === tStep ? 'var(--blue)' : 'transparent'};transition:opacity .3s,box-shadow .3s" data-hv="15">
                <span style="font-size:clamp(17px,1.2vw,20px);font-weight:600">{ts[0]}</span>
                <span style="font-size:14px;line-height:1.55;color:var(--muted)">{ts[1]}</span>
              </button>
            {/each}
            <a href="/kontakt" style="margin-top:24px;align-self:flex-start;display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:10px;background:var(--primary);color:#fff;text-decoration:none;font-size:15px;font-weight:600;white-space:nowrap" data-hv="16">Demo anfragen</a>
          </div>
          <div style="flex:999 1 520px;min-width:0;position:relative;padding-top:56px">
            <span data-owl={T_STEPS[tStep][2]} style="position:absolute;right:28px;top:-36px;width:110px;height:99px;z-index:2"></span>
            <div style="position:relative;background:var(--bg);border:1px solid var(--line);border-radius:16px;overflow:hidden;min-height:clamp(340px,40vh,460px)">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--line);font-size:13px">
                <span style="font-weight:600">Informatik 10b</span><span style="color:var(--muted)">Fokus: Mit WHERE filtern</span><span style="flex:1"></span><span style="font:11px 'IBM Plex Mono',monospace;color:var(--muted)">Beispieldaten</span>
              </div>
              {#if tStep === 0}
                <div style="display:flex;flex-wrap:wrap;gap:24px;padding:28px;animation:tbIn .35s ease-out">
                  <div style="flex:0 1 260px;min-width:220px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--surface)">
                    <span style="font-size:13px;color:var(--muted)">Klassencode</span>
                    <strong style="font:600 clamp(15px,1.25vw,19px) 'IBM Plex Mono',monospace;text-align:center;overflow-wrap:anywhere">sonne-apfel-kugel-33</strong>
                    <span style="font-size:13px;color:var(--muted)">app.tabulasql.de/beitreten</span>
                  </div>
                  <div style="flex:1 1 240px">
                    <p style="margin:0 0 14px;display:flex;align-items:baseline;gap:8px"><strong style="font-size:48px;font-weight:700;color:var(--blue);line-height:1;font-variant-numeric:tabular-nums">17</strong><span style="font-size:15px;color:var(--muted)">von 24 beigetreten</span></p>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
                      {#each JOINED as j}<span style="font-size:13px;padding:4px 10px;border-radius:20px;border:1px solid var(--line);background:var(--surface)">{j}</span>{/each}
                      <span style="font-size:13px;padding:4px 10px;border-radius:20px;border:1px solid var(--blue);color:var(--blue);background:var(--blue-soft)">Finn</span>
                    </div>
                  </div>
                </div>
              {/if}
              {#if tStep === 1}
                <div style="animation:tbIn .35s ease-out">
                  <div style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line)">
                    <div style="padding:18px;border-right:1px solid var(--line)"><strong style="font-size:32px;font-weight:600;font-variant-numeric:tabular-nums">14</strong><p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Fertig</p></div>
                    <div style="padding:18px;border-right:1px solid var(--line)"><strong style="font-size:32px;font-weight:600;font-variant-numeric:tabular-nums">6</strong><p style="margin:2px 0 0;font-size:13px;color:var(--muted)">In Arbeit</p></div>
                    <div style="padding:18px;background:var(--err-bg)"><strong style="font-size:32px;font-weight:600;color:var(--err);font-variant-numeric:tabular-nums">2</strong><p style="margin:2px 0 0;font-size:13px;color:var(--err)">Brauchen Hilfe</p></div>
                  </div>
                  <table style="width:100%;border-collapse:collapse;font-size:14px">
                    <thead><tr><th style="text-align:left;padding:10px 18px;font:500 12px 'IBM Plex Mono',monospace;color:var(--muted)">Name</th><th style="text-align:left;padding:10px 18px;font:500 12px 'IBM Plex Mono',monospace;color:var(--muted)">Status</th><th style="text-align:right;padding:10px 18px;font:500 12px 'IBM Plex Mono',monospace;color:var(--muted)">Schritt</th></tr></thead>
                    <tbody>
                      {#each STUDENTS as st}
                        <tr><td style="padding:12px 18px;border-top:1px solid var(--line)">{st.name}</td><td style="padding:12px 18px;border-top:1px solid var(--line)"><span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:{st.ink}"><span style="width:7px;height:7px;border-radius:50%;background:{st.ink}"></span>{st.status}</span></td><td style="padding:12px 18px;border-top:1px solid var(--line);text-align:right;font-family:'IBM Plex Mono',monospace;font-size:13px">{st.step}</td></tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
              {#if tStep === 2}
                <div style="padding:24px 28px;display:flex;flex-direction:column;gap:12px;animation:tbIn .35s ease-out">
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><strong style="font-size:19px;font-weight:600">Mia K.</strong><span style="font-size:13px;color:var(--err)">Braucht Hilfe</span></div>
                  <div style="border:1px solid var(--line);border-radius:10px;background:var(--code-bg);padding:14px 16px;font:14px/1.6 'IBM Plex Mono',monospace;color:var(--text)">SELECT title year FROM books WHERE year > 2015</div>
                  <div style="padding:12px 16px;border-radius:8px;background:var(--err-bg);font-size:14px;color:var(--err)">Syntaxfehler: Komma zwischen title und year fehlt.</div>
                </div>
              {/if}
              {#if tStep === 3}
                <div style="padding:24px 28px;animation:tbIn .35s ease-out">
                  <p style="margin:0 0 16px;font-size:14px;color:var(--muted)">Frage: Welche SQL-Klausel filtert Zeilen?</p>
                  <div style="display:flex;flex-direction:column;gap:8px">
                    {#each ANSWERS as an}
                      <div style="display:flex;align-items:center;gap:10px;padding:16px;border-radius:10px;border:1px solid {an.border};background:{an.bg};font:500 15px 'IBM Plex Mono',monospace">
                        <span style="width:14px;height:14px;flex:none;background:{an.color};border-radius:{an.radius};transform:{an.rot}"></span>{an.label}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
        {#if pinned}
          <div aria-hidden="true" style="margin-top:28px;height:2px;background:var(--line);border-radius:1px;overflow:hidden"><div style="height:100%;width:calc(var(--tp,0) * 100%);background:var(--blue)"></div></div>
        {/if}
      </div>
    </section>

    <!-- Doppelstunde -->
    <section bind:this={stundeSection} id="stunde" aria-label="Ablauf einer Doppelstunde" style="position:relative;height:{stundeWrapH};margin-top:clamp(64px,10vh,140px)">
      <div style="position:{stickyPos};top:68px;min-height:{stickyMinH};display:flex;flex-direction:column;justify-content:center;max-width:1760px;margin:0 auto;padding:32px clamp(20px,4vw,64px)">
        <div style="display:flex;flex-wrap:wrap;gap:20px 64px;align-items:flex-end;justify-content:space-between">
          <h2 style="margin:0;font-size:clamp(36px,4.4vw,84px);line-height:.98;font-weight:700;letter-spacing:-.045em;max-width:14ch">Eine Doppelstunde mit Tabula.</h2>
          <p style="margin:0;max-width:440px;font-size:clamp(16px,1.15vw,19px);line-height:1.6;color:var(--muted)">Ein Beispiel für 90 Minuten: wiederholen, selbst üben, gemeinsam besprechen.</p>
        </div>
        <div style="margin-top:clamp(32px,5vh,56px);position:relative;padding-top:clamp(100px,10vw,150px)">
          <span data-owl={phase[4]} style="position:absolute;top:0;left:{phLeft};width:clamp(100px,8vw,150px);aspect-ratio:200/180;transform:translateX(-50%);transition:left .7s cubic-bezier(.16,1,.3,1);pointer-events:none"></span>
          <div role="tablist" aria-label="Phasen der Doppelstunde" style="display:flex;gap:4px;height:64px">
            {#each PHASES as ph, i}
              <button type="button" role="tab" aria-selected={i === phaseIdx ? 'true' : 'false'}
                onmouseenter={() => { if (!pinned && i !== phaseIdx) phaseIdx = i; }}
                onfocus={() => phaseIdx = i}
                onclick={() => phaseIdx = i}
                style="flex:{ph[1] - ph[0]} 1 0;min-width:0;display:flex;align-items:center;justify-content:center;padding:0 8px;border:1px solid {i === phaseIdx ? 'var(--primary)' : 'var(--line)'};border-radius:10px;background:{i === phaseIdx ? 'var(--primary)' : 'var(--surface)'};color:{i === phaseIdx ? '#fff' : 'var(--muted)'};font:600 14px 'IBM Plex Mono',monospace;cursor:pointer;transition:background .25s,border-color .25s,color .25s;overflow:hidden;white-space:nowrap">
                {ph[1] - ph[0] >= 10 ? (ph[1] - ph[0]) + ' min' : (ph[1] - ph[0]) + '′'}
              </button>
            {/each}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font:12px 'IBM Plex Mono',monospace;color:var(--muted)"><span>0 min</span><span>45 min</span><span>90 min</span></div>
        </div>
        <div style="margin-top:28px;display:flex;flex-wrap:wrap;gap:16px clamp(24px,4vw,80px);align-items:baseline;padding-top:24px;border-top:1px solid var(--line);animation:tbIn .3s ease-out">
          <p style="margin:0;flex:0 0 auto;font:600 clamp(18px,1.4vw,24px) 'IBM Plex Mono',monospace;color:var(--blue)">{phRange}</p>
          <div style="flex:1 1 420px;min-width:0">
            <h3 style="margin:0;font-size:clamp(24px,2.2vw,40px);font-weight:600;letter-spacing:-.025em;line-height:1.1">{phase[2]}</h3>
            <p style="margin:10px 0 0;max-width:62ch;font-size:16px;line-height:1.6;color:var(--muted);text-wrap:pretty">{phase[3]}</p>
          </div>
        </div>
        {#if pinned}
          <div aria-hidden="true" style="margin-top:28px;height:2px;background:var(--line);border-radius:1px;overflow:hidden"><div style="height:100%;width:calc(var(--sp,0) * 100%);background:var(--blue)"></div></div>
        {/if}
      </div>
    </section>

    <!-- Lernpfad -->
    <section bind:this={pathSection} id="lernpfad" aria-label="Der Lernpfad" style="position:relative;height:{pathWrapH};margin-top:clamp(64px,10vh,140px)">
      <div style="position:{stickyPos};top:68px;min-height:{stickyMinH};display:flex;flex-direction:column;justify-content:center;max-width:1760px;margin:0 auto;padding:32px clamp(20px,4vw,64px)">
        <div style="display:flex;flex-wrap:wrap;gap:20px 64px;align-items:flex-end;justify-content:space-between">
          <h2 style="margin:0;font-size:clamp(36px,4.4vw,84px);line-height:.98;font-weight:700;letter-spacing:-.045em;max-width:15ch">Von SELECT bis zur Datenanalyse mit Python.</h2>
          <p style="margin:0;max-width:440px;font-size:clamp(16px,1.15vw,19px);line-height:1.6;color:var(--muted)">Zehn Lektionen und ein Abschlussprojekt. Passend für Klasse 10 bis zum Abitur. Rund 340 Minuten Lernzeit, also knapp vier Doppelstunden. Jede Lektion lässt sich einzeln freischalten.</p>
        </div>
        <div style="margin-top:clamp(24px,4vh,48px);overflow-x:auto;padding-bottom:6px">
          <div style="position:relative;min-width:720px;padding-top:clamp(110px,13vh,150px)">
            <span data-owl={pathOwl} style="position:absolute;top:0;left:{owlLeft};width:clamp(110px,8vw,160px);aspect-ratio:200/180;transform:translateX(-50%);transition:left .8s cubic-bezier(.16,1,.3,1);pointer-events:none"></span>
            <div style="position:relative">
              <div style="position:absolute;left:4.5%;right:4.5%;top:21px;height:2px;background:var(--line)"></div>
              <div style="position:absolute;left:4.5%;top:21px;height:2px;width:{pathFill};background:var(--blue);transition:width .8s cubic-bezier(.16,1,.3,1)"></div>
              <div role="tablist" aria-label="Lektionen" style="position:relative;display:grid;grid-template-columns:repeat(11,1fr)">
                {#each cat as s, i}
                  <button type="button" role="tab" aria-selected={i === selIdx ? 'true' : 'false'} aria-label={'Lektion ' + s.n + ': ' + s.title}
                    onclick={() => selIdx = i}
                    onmouseenter={() => { if (!pinned) selIdx = i; }}
                    style="display:grid;place-items:center;height:44px;border:0;background:transparent;cursor:pointer;padding:0">
                    <span style="width:{i === selIdx ? '44px' : '30px'};height:{i === selIdx ? '44px' : '30px'};border-radius:50%;display:grid;place-items:center;background:{i === selIdx ? 'var(--primary)' : i < selIdx ? 'var(--blue-soft)' : 'var(--bg)'};border:2px solid {i <= selIdx ? 'var(--primary)' : 'var(--line)'};color:{i === selIdx ? '#fff' : i < selIdx ? 'var(--blue)' : 'var(--muted)'};font:600 13px 'IBM Plex Mono',monospace;transition:all .3s">{s.n}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:8fr 1fr 2fr;margin-top:14px;gap:6px">
              <div style="border-top:1px solid var(--line);padding-top:10px;font-size:13px;color:var(--muted)"><strong style="color:var(--text);font-weight:600">SQL-Grundlagen</strong> · Lektion 1–8 · 160 min</div>
              <div style="border-top:1px solid var(--line);padding-top:10px;font-size:13px;color:var(--muted)"><strong style="color:var(--text);font-weight:600">Eigene DB</strong> · 9 · 45 min</div>
              <div style="border-top:1px solid var(--line);padding-top:10px;font-size:13px;color:var(--muted)"><strong style="color:var(--text);font-weight:600">Python &amp; Daten</strong> · 10 + Projekt · 135 min</div>
            </div>
          </div>
        </div>
        <div style="margin-top:clamp(20px,3vh,40px);display:flex;flex-wrap:wrap;gap:16px clamp(24px,3vw,64px);align-items:center;padding-top:clamp(16px,2.5vh,32px);border-top:1px solid var(--line)">
          <span aria-hidden="true" style="flex:none;font-size:clamp(96px,11vw,220px);line-height:.8;font-weight:700;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:2px var(--blue);font-variant-numeric:tabular-nums;min-width:1.3em">{selEntry.n}</span>
          <div style="flex:1 1 380px;min-width:0">
            <p style="margin:0 0 6px;font-size:14px;color:var(--muted)">{selEntry.n === 'P' ? 'Abschlussprojekt' : 'Lektion ' + selEntry.n} · {selEntry.dur} · {TRACK_INFO[(selEntry.track ?? 1) - 1]?.name ?? ''}</p>
            <h3 style="margin:0;font-size:clamp(26px,2.4vw,44px);font-weight:600;letter-spacing:-.025em;line-height:1.1">{selEntry.title}</h3>
            <p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:var(--muted);max-width:56ch">{TRACK_DESC[selEntry.track ?? 1] ?? ''}</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start">
            <a href={selEntry.id === 'where-filters' ? 'https://app.tabulasql.de/learn/beginner/where-filters' : 'https://app.tabulasql.de/learn'} style="display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:500;color:var(--blue);text-decoration:none" data-hv="17">
              {selEntry.id === 'where-filters' ? 'Diese Lektion öffnen' : 'Zum Lernpfad'}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Datenschutz + Kosten -->
    <section id="datenschutz-kosten" aria-label="Datenschutz und Kosten" style="max-width:1760px;margin:0 auto;padding:clamp(96px,14vh,180px) clamp(20px,4vw,64px) 0">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:28px clamp(40px,5vw,96px)">
        <div style="min-width:0;display:grid;grid-row:span 2;grid-template-rows:subgrid;row-gap:28px">
          <div>
            <h2 style="margin:0;font-size:clamp(32px,3.2vw,56px);line-height:1.02;font-weight:700;letter-spacing:-.04em;max-width:22ch;text-wrap:balance">Server in Deutschland. Nur die nötigsten Daten.</h2>
            <p style="margin:18px 0 0;max-width:520px;font-size:16px;line-height:1.6;color:var(--muted)">Keine Werbung, kein Tracking, keine Analyse-Tools. Tabula läuft auf Servern von Hetzner im Rechenzentrum Nürnberg.</p>
          </div>
          <div>
            <dl style="margin:0;border-top:1px solid var(--line)">
              <div style="display:flex;flex-wrap:wrap;gap:6px 24px;padding:18px 0;border-bottom:1px solid var(--line)"><dt style="flex:0 0 140px;font-weight:600">Schüler</dt><dd style="margin:0;flex:1 1 280px;font-size:15px;line-height:1.6;color:var(--muted)">Kein Konto. Name und Passwort bleiben auf dem Gerät. Der Server kennt nur eine Nummer und den Lernfortschritt. Den Namen kann nur die eigene Lehrkraft lesen.</dd></div>
              <div style="display:flex;flex-wrap:wrap;gap:6px 24px;padding:18px 0;border-bottom:1px solid var(--line)"><dt style="flex:0 0 140px;font-weight:600">Lehrkräfte</dt><dd style="margin:0;flex:1 1 280px;font-size:15px;line-height:1.6;color:var(--muted)">Name und E-Mail-Adresse. Das Passwort wird nur als Hash gespeichert.</dd></div>
              <div style="display:flex;flex-wrap:wrap;gap:6px 24px;padding:18px 0;border-bottom:1px solid var(--line)"><dt style="flex:0 0 140px;font-weight:600">SQL-Abfragen</dt><dd style="margin:0;flex:1 1 280px;font-size:15px;line-height:1.6;color:var(--muted)">Abfragen laufen im Browser und verlassen ihn nicht.</dd></div>
            </dl>
            <p style="margin:18px 0 0;font-size:15px;line-height:1.6">Lehrkräfte können ihr Konto jederzeit löschen, Schüler können ihre Klasse jederzeit verlassen. Zum Ausprobieren braucht es gar keine Anmeldung.</p>
          </div>
        </div>
        <div style="min-width:0;display:grid;grid-row:span 2;grid-template-rows:subgrid;row-gap:28px">
          <h2 style="margin:0;font-size:clamp(32px,3.2vw,56px);line-height:1.02;font-weight:700;letter-spacing:-.04em;text-wrap:balance">Kostenlos. Open Source. Ein Browser genügt.</h2>
          <div style="align-self:start;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));border-top:1px solid var(--line)">
            <div style="padding:18px 24px 18px 0;border-bottom:1px solid var(--line)"><h3 style="margin:0 0 6px;font-size:17px;font-weight:600">Kostenlos</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted)">Für Schulen, Lehrkräfte und Schüler. Keine Lizenzgebühren, keine Bezahlstufen.</p></div>
            <div style="padding:18px 24px 18px 0;border-bottom:1px solid var(--line)"><h3 style="margin:0 0 6px;font-size:17px;font-weight:600">Open Source</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted)">Lizenziert unter AGPL-3.0. Der Quellcode liegt offen auf <a href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT">GitHub</a>.</p></div>
            <div style="padding:18px 24px 18px 0;border-bottom:1px solid var(--line)"><h3 style="margin:0 0 6px;font-size:17px;font-weight:600">Keine Installation</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted)">Ein aktueller Browser reicht. Die IT-Abteilung muss nichts einrichten.</p></div>
            <div style="padding:18px 24px 18px 0;border-bottom:1px solid var(--line)"><h3 style="margin:0 0 6px;font-size:17px;font-weight:600">Offen und prüfbar</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted)">Der gesamte Quellcode liegt auf GitHub, jede Datenschutzaussage lässt sich nachprüfen.</p></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Edgar Rollen (sticky scroll) -->
    <section bind:this={roleSection} id="eule" aria-label="Edgar im Unterricht" style="position:relative;height:{roleWrapH};margin-top:clamp(64px,10vh,140px)">
      <div style="position:{stickyPos};top:68px;min-height:{stickyMinH};display:flex;flex-direction:column;justify-content:center;gap:clamp(28px,5vh,56px);overflow:hidden;padding:32px 0">
        <div style="width:100%;max-width:1760px;margin:0 auto;padding:0 clamp(20px,4vw,64px);display:flex;flex-wrap:wrap;gap:20px 64px;align-items:flex-end;justify-content:space-between">
          <h2 style="margin:0;font-size:clamp(36px,4.4vw,84px);line-height:.98;font-weight:700;letter-spacing:-.045em;max-width:15ch">Hilft beim Denken. Verrät keine Lösungen.</h2>
          <p style="margin:0;max-width:440px;font-size:clamp(16px,1.15vw,19px);line-height:1.6;color:var(--muted);text-wrap:pretty">Edgar, die Eule, hat feste Aufgaben. Er meldet sich an wenigen, klaren Stellen und lässt den nächsten Schritt bei den Schülern.</p>
        </div>
        <div bind:this={roleViewport} style="overflow-x:{roleOverflow};scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch">
          <div bind:this={roleTrack} style="display:flex;gap:clamp(16px,2vw,32px);width:max-content;padding:0 clamp(20px,4vw,64px);transform:translateX(calc(var(--rx,0) * -1px));will-change:transform">
            {#each ROLES as r}
              <article style="scroll-snap-align:start;flex:none;width:min(84vw,1080px);min-height:clamp(300px,46vh,520px);display:flex;flex-wrap:wrap;align-items:center;gap:24px clamp(24px,4vw,72px);padding:clamp(24px,3.5vw,56px);border-radius:24px;background:var(--surface);border:1px solid var(--line)">
                <span data-owl={r.pose} style="flex:0 0 auto;width:clamp(150px,18vw,320px);aspect-ratio:200/180"></span>
                <div style="flex:1 1 280px;min-width:0">
                  <h3 style="margin:0;font-size:clamp(40px,5.6vw,112px);line-height:.92;font-weight:700;letter-spacing:-.045em;text-wrap:balance">{r.title}</h3>
                  <p style="margin:20px 0 0;max-width:40ch;font-size:clamp(17px,1.4vw,24px);line-height:1.5;color:var(--text);text-wrap:pretty">{r.copy}</p>
                </div>
              </article>
            {/each}
          </div>
        </div>
        {#if pinned}
          <div aria-hidden="true" style="width:100%;max-width:1760px;margin:0 auto;padding:0 clamp(20px,4vw,64px)"><div style="height:2px;background:var(--line);border-radius:1px;overflow:hidden"><div style="height:100%;width:calc(var(--rp,0) * 100%);background:var(--blue)"></div></div></div>
        {/if}
      </div>
    </section>

    <!-- Vorteile -->
    <section aria-label="Vorteile" style="max-width:1760px;margin:0 auto;padding:clamp(72px,10vh,120px) clamp(20px,4vw,64px) 0">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));border-top:1px solid var(--text)">
        <div style="padding:22px 32px 0 0"><h3 style="margin:0 0 6px;font-size:clamp(18px,1.3vw,22px);font-weight:600">Direkt loslegen</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted);max-width:44ch">Browser öffnen, Abfrage schreiben. Auch auf dem Schulrechner.</p></div>
        <div style="padding:22px 32px 0 0"><h3 style="margin:0 0 6px;font-size:clamp(18px,1.3vw,22px);font-weight:600">Verstehen, was fehlt</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted);max-width:44ch">Konkrete Hinweise helfen beim nächsten Versuch.</p></div>
        <div style="padding:22px 32px 0 0"><h3 style="margin:0 0 6px;font-size:clamp(18px,1.3vw,22px);font-weight:600">Mit den Daten weiterarbeiten</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted);max-width:44ch">Der Lernpfad führt über die eigene Datenbank bis zur Datenanalyse mit Python.</p></div>
      </div>
    </section>

    <!-- Marquee -->
    <section bind:this={marqueeSection} aria-hidden="true" style="margin-top:clamp(96px,14vh,180px);overflow:hidden;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:.35em;white-space:nowrap;font-size:clamp(64px,12vw,250px);line-height:1;font-weight:700;letter-spacing:-.05em;transform:translateX(calc(var(--mp,0) * -38% + 2%));will-change:transform">
        <span>SELECT</span><span style="color:var(--blue)">*</span><span>FROM</span><span bind:this={mqOwlSpan} data-owl={mqWave ? 'wave' : 'lookaround'} style="display:inline-block;width:1.05em;height:.95em;flex:none"></span><span>WHERE</span><span style="color:var(--blue)">JOIN</span><span>GROUP BY</span>
      </div>
      <div style="display:flex;gap:.35em;white-space:nowrap;font-size:clamp(64px,12vw,250px);line-height:1;font-weight:700;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:2px var(--blue);transform:translateX(calc(var(--mp,0) * 38% - 46%));will-change:transform">
        <span>ORDER BY</span><span>HAVING</span><span>LIMIT</span><span>CREATE TABLE</span><span>PRIMARY KEY</span>
      </div>
    </section>

    <!-- Klauseln -->
    <section bind:this={clauseSection} id="klauseln" aria-label="Klauseln ausprobieren" style="position:relative;height:{clauseWrapH};margin-top:clamp(64px,10vh,140px)">
      <div style="position:{stickyPos};top:68px;min-height:{stickyMinH};display:flex;flex-direction:column;justify-content:center;max-width:1760px;margin:0 auto;padding:32px clamp(20px,4vw,64px)">
        <div style="display:flex;flex-wrap:wrap;gap:32px clamp(32px,4vw,80px);align-items:flex-start">
          <div style="flex:1 1 360px;max-width:560px;min-width:0">
            <h2 style="margin:0;font-size:clamp(36px,4.4vw,84px);line-height:.98;font-weight:700;letter-spacing:-.045em">Jede Klausel ändert das Ergebnis.</h2>
            <p style="margin:18px 0 0;font-size:clamp(16px,1.15vw,19px);line-height:1.6;color:var(--muted);text-wrap:pretty">{clauseIntro}</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:24px" role="group" aria-label="Klauseln">
              {#each CLAUSES as cl}
                {@const on = !!clauseOn[cl.id]}
                <button type="button" onclick={() => { clauseOn = { ...clauseOn, [cl.id]: !clauseOn[cl.id] }; flashClause(cl.id === 'order' ? 'lookaround' : cl.id === 'limit' ? 'surprised' : 'curious'); }} aria-pressed={on} style="display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 16px 0 12px;border:1px solid {on ? 'var(--blue)' : 'var(--line)'};border-radius:10px;background:{on ? 'var(--blue-soft)' : 'var(--surface)'};color:var(--text);font:500 14px 'IBM Plex Mono',monospace;cursor:pointer;white-space:nowrap;transition:background .25s,border-color .25s">
                  <span style="width:30px;height:18px;border-radius:9px;background:{on ? 'var(--primary)' : 'var(--line)'};position:relative;transition:background .25s;flex:none"><span style="position:absolute;top:2px;left:{on ? '14px' : '2px'};width:14px;height:14px;border-radius:50%;background:#fff;transition:left .25s cubic-bezier(.2,.8,.2,1)"></span></span>{cl.label}
                </button>
              {/each}
            </div>
            <pre bind:this={clauseHlPre} style="margin:18px 0 0;padding:16px 18px;min-height:132px;border:1px solid var(--line);border-radius:12px;background:var(--code-bg);font:clamp(14px,1vw,17px)/1.65 'IBM Plex Mono',monospace;white-space:pre-wrap;color:var(--text)"></pre>
            <div style="display:flex;align-items:center;gap:16px;margin-top:20px">
              <span data-owl={clauseOwl} style="width:110px;height:99px;flex:none"></span>
              <div>
                <p style="margin:0;font-size:clamp(44px,4vw,72px);font-weight:700;letter-spacing:-.04em;font-variant-numeric:tabular-nums;line-height:1">{tileData().clauseCount}</p>
                <p style="margin:4px 0 0;font-size:14px;color:var(--muted)">{tileData().clauseCountLabel}</p>
              </div>
            </div>
          </div>
          <div bind:this={tileBox} style="flex:2 1 520px;min-width:0;position:relative;height:{tileData().tileH}">
            {#each tileData().tiles as t}
              <div style="position:absolute;left:0;top:0;width:{t.w};height:60px;padding:8px 12px;border:1px solid {t.border};border-radius:10px;background:{t.bg};transform:{t.tf};opacity:{t.op};transition:transform .8s cubic-bezier(.16,1,.3,1),opacity .45s,background .3s,border-color .3s;display:flex;flex-direction:column;justify-content:center;overflow:hidden">
                <span style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t.title}</span>
                <span style="font:12px 'IBM Plex Mono',monospace;color:var(--muted)">{t.meta}</span>
              </div>
            {/each}
          </div>
        </div>
        {#if pinned}
          <div aria-hidden="true" style="margin-top:28px;height:2px;background:var(--line);border-radius:1px;overflow:hidden"><div style="height:100%;width:calc(var(--cp,0) * 100%);background:var(--blue)"></div></div>
        {/if}
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" aria-label="Häufige Fragen" style="max-width:1760px;margin:0 auto;padding:clamp(96px,14vh,180px) clamp(20px,4vw,64px) 0">
      <div style="display:flex;flex-wrap:wrap;gap:24px clamp(40px,5vw,96px);align-items:flex-start">
        <h2 style="margin:0;flex:1 1 300px;font-size:clamp(32px,3.2vw,56px);line-height:1.02;font-weight:700;letter-spacing:-.04em;position:sticky;top:100px">Häufige Fragen</h2>
        <div style="flex:2 1 560px;border-top:1px solid var(--line)">
          {#each FAQ as f}
            <details style="border-bottom:1px solid var(--line)">
              <summary style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;font-size:clamp(17px,1.2vw,20px);font-weight:500">{f.q}
                <svg class="tb-chev" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none;color:var(--muted);transition:transform .2s"><path d="M6 3.5 10.5 8 6 12.5"></path></svg>
              </summary>
              <p style="margin:0 0 20px;max-width:64ch;font-size:15px;line-height:1.65;color:var(--muted)">{f.a}</p>
            </details>
          {/each}
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section aria-label="Kontakt" style="max-width:1760px;margin:0 auto;padding:clamp(96px,14vh,180px) clamp(20px,4vw,64px) 0">
      <div onmouseenter={wake} style="position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:24px 48px;padding:clamp(28px,4vw,64px);border-radius:22px;background:var(--primary);color:#fff">
        <span data-owl={ctaOwl} data-owl-dark="1" style="width:clamp(120px,10vw,180px);aspect-ratio:200/180;flex:none;padding:10px;border-radius:20px;background:#fff;box-sizing:content-box"></span>
        <div style="flex:1 1 320px">
          <h2 style="margin:0;font-size:clamp(30px,3.4vw,60px);font-weight:700;letter-spacing:-.04em;line-height:1.02">SQL in Ihren Unterricht bringen?</h2>
          <p style="margin:12px 0 0;font-size:clamp(16px,1.15vw,19px);line-height:1.55;color:#fff">Direkt im Browser ausprobieren oder eine Demo für Ihre Schule anfragen.</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a href="/kontakt" style="display:inline-flex;align-items:center;font-size:16px;font-weight:500;color:#fff;text-underline-offset:4px;white-space:nowrap" data-hv="18">Demo anfragen</a>
          <a href="https://app.tabulasql.de/beitreten" style="display:inline-flex;align-items:center;font-size:16px;font-weight:500;color:#fff;text-underline-offset:4px;white-space:nowrap" data-hv="19">Klasse beitreten</a>
          <a href="https://app.tabulasql.de/login?rolle=lehrkraft" style="display:inline-flex;align-items:center;gap:14px;color:#fff;text-decoration:none;font-size:clamp(22px,2vw,32px);font-weight:700;letter-spacing:-.035em;white-space:nowrap" data-hv="20">Lehrer-Konto erstellen<span style="width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#2563eb"><svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg></span></a>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer style="max-width:1760px;margin:0 auto;padding:clamp(220px,28vh,340px) clamp(20px,4vw,64px) 40px">
    <div style="position:relative;border-top:2px solid var(--text);padding-top:32px;display:flex;flex-wrap:wrap;gap:32px clamp(40px,6vw,120px)">
      <span data-owl="sleep" style="position:absolute;left:clamp(0px,2vw,24px);bottom:100%;margin-bottom:-6px;width:clamp(96px,8vw,132px);aspect-ratio:200/180"></span>
      <div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:12px">
        <a href="#start" style="display:flex;align-items:center;gap:9px;color:var(--text);text-decoration:none;font-weight:600;font-size:22px;letter-spacing:-.03em"><span data-owl-icon="1" style="width:32px;height:28px;display:block"></span>Tabula</a>
        <p style="margin:0;max-width:40ch;font-size:14px;line-height:1.6;color:var(--muted)">Kostenlos und Open Source unter AGPL-3.0. Server in Deutschland. Keine Werbung, kein Tracking.</p>
      </div>
      <nav aria-label="Produkt" style="flex:0 0 160px;display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span style="font-weight:600">Tabula</span>
        <a href="https://app.tabulasql.de/learn" style="color:var(--muted);text-decoration:none" data-hv="21">Lernen</a>
        <a href="#lernpfad" style="color:var(--muted);text-decoration:none" data-hv="22">Lernpfad</a>
        <a href="/datasets" style="color:var(--muted);text-decoration:none" data-hv="23">Datensätze</a>
        <a href="#lehrkraefte" style="color:var(--muted);text-decoration:none" data-hv="24">Für Lehrkräfte</a>
        <a href="#faq" style="color:var(--muted);text-decoration:none" data-hv="25">FAQ</a>
      </nav>
      <nav aria-label="Projekt und Rechtliches" style="flex:0 0 180px;display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span style="font-weight:600">Projekt</span>
        <a href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT" style="color:var(--muted);text-decoration:none" data-hv="26">GitHub</a>
        <a href="/kontakt" style="color:var(--muted);text-decoration:none" data-hv="27">Kontakt</a>
        <a href="/impressum" style="color:var(--muted);text-decoration:none" data-hv="28">Impressum</a>
        <a href="/datenschutz" style="color:var(--muted);text-decoration:none" data-hv="29">Datenschutzerklärung</a>
      </nav>
    </div>
  </footer>
</div>
