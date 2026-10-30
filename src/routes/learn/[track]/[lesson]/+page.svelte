<script lang="ts">
	import '$lib/tabula/theme.css';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import type { Database } from 'sql.js';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import CodeEditor from '$lib/tabula/CodeEditor.svelte';
	import QueryViz from '$lib/tabula/QueryViz.svelte';
	import { explainQuery } from '$lib/tabula/explain';
	import { tok } from '$lib/tabula/highlight';
	import { LESSONS, saveProgress, loadProgress, syncExerciseStep, type Step } from '$lib/tabula/lessons';
	import { session } from '$lib/tabula/session.svelte.js';
	import { openDb, run, runChecked, readSchema, explainError, compare, sqlHint, exportDb, type Result, type Schema } from '$lib/tabula/sql';

	// Initialen wie in der TopNav, ohne Anmeldung „G“ für Gast
	function avatarInitials(): string {
		const n = session.displayName.trim();
		if (!n) return 'G';
		const p = n.split(/\s+/);
		return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase();
	}

	const lesson = $derived(LESSONS[page.params.lesson ?? ''] ?? LESSONS['where-filters']);

	// ---------- Zustand -------------------------------------------------------
	type Tone = 'neutral' | 'accent' | 'danger' | 'ok';
	type ExState = 'new' | 'running' | 'error' | 'wrong' | 'solved' | 'shown';
	type StepState = {
		code: string;
		attempts: number;
		state: ExState;
		result: Result | null;
		errLine: number | null;
		errMsg: string;
		errOrig: string;
		sub: string;
		tipOpen: boolean;
		ran: boolean;
		lastSql: string;
	};

	let cur = $state(0);
	/** Weitester erreichter Schritt. Spaetere Schritte sind gesperrt, bis die Uebungen davor geloest sind. */
	let reached = $state(0);
	let finished = $state(false);
	function goto(i: number) {
		if (i > reached) return;
		cur = i;
		finished = false;
		stepMenu = false;
		menu = false;
	}
	let db = $state<Database | null>(null);
	let dbState = $state<'loading' | 'ok' | 'fail'>('loading');
	let schema = $state<Schema>([]);
	let openTables = $state<Record<string, boolean>>({});
	let total = $state(0);
	let st = $state<StepState[]>([]);
	let railOpen = $state(true);
	let dialog = $state<null | 'reset' | 'solution'>(null);
	let sheet = $state(false);
	let menu = $state(false);
	let stepMenu = $state(false);
	let guestHint = $state(false);
	let dark = $state(false);
	let editor = $state<ReturnType<typeof CodeEditor>>();
	let mEditor = $state<ReturnType<typeof CodeEditor>>();

	const step = $derived(lesson.steps[cur]);
	const s = $derived(st[cur]);
	const isWork = $derived(step.kind === 'example' || step.kind === 'exercise');

	function initSteps() {
		st = lesson.steps.map((x) => ({
			code: x.kind === 'exercise' ? x.starter : x.kind === 'example' ? x.code : '',
			attempts: 0,
			state: 'new',
			result: null,
			errLine: null,
			errMsg: '',
			errOrig: '',
			sub: '',
			tipOpen: false,
			ran: false,
			lastSql: ''
		}));
	}
	initSteps();

	async function loadDb() {
		dbState = 'loading';
		try {
			db = await openDb(lesson.db.seed);
			schema = readSchema(db);
			openTables = Object.fromEntries(schema.map((t, i) => [t.table, i === 0]));
			total = Number(run(db, `SELECT COUNT(*) FROM ${lesson.db.mainTable}`).rows[0][0]);
			dbState = 'ok';
		} catch (e) {
			console.error(e);
			dbState = 'fail';
		}
	}

	onMount(() => {
		loadDb();
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		try {
			guestHint = !localStorage.getItem('tabula-guest-hint');
		} catch {
			guestHint = false;
		}
		const p = loadProgress()[lesson.id];
		if (p?.done) reached = lesson.steps.length - 1;
		else if (p?.step) cur = reached = Math.min(p.step - 1, lesson.steps.length - 1);
		return () => mo.disconnect();
	});

	// ---------- Ausfuehren ----------------------------------------------------
	async function exec() {
		if (!db || !isWork || s.state === 'running') return;
		const x = s;
		const sql = x.code.trim();
		if (!sql) return;
		const wasShown = x.state === 'shown';
		x.state = 'running';
		x.attempts += step.kind === 'exercise' ? 1 : 0;
		const t0 = performance.now();
		let out: Result | null = null;
		let checked: Result | null = null;
		let err: unknown = null;
		try {
			// Schreibende Abfragen nicht dauerhaft wirken lassen; bei DDL-Übungen die Prüfabfrage im selben Zustand
			const r = runChecked(db, sql, step.kind === 'exercise' ? step.check : undefined);
			out = r.shown;
			checked = r.checked;
		} catch (e) {
			err = e;
		}
		const wait = 300 - (performance.now() - t0);
		if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 180)));
		x.ran = true;
		x.tipOpen = x.tipOpen && step.kind === 'exercise';
		if (err) {
			const ex = explainError(sql, err);
			x.state = 'error';
			x.errMsg = ex.msg;
			x.errOrig = ex.orig;
			x.errLine = ex.line;
			x.result = null;
			if (step.kind === 'exercise') {
				syncExerciseStep({
					lesson_id: lesson.id,
					step: cur,
					done: false,
					attempts: x.attempts,
					lastQuery: sql,
					errorMsg: ex.msg
				});
			}
			return;
		}
		x.errLine = null;
		// DDL ohne eigenes Ergebnis: Prüfabfrage zeigen, damit sichtbar ist, was entstanden ist
		x.result = step.kind === 'exercise' && step.check && !out!.columns.length ? checked : out;
		x.lastSql = step.kind === 'exercise' && step.check && !out!.columns.length ? step.check : sql;
		if (step.kind === 'example') {
			x.state = 'solved';
			return;
		}
		if (step.kind === 'exercise') {
			const want = runChecked(db, step.solution, step.check).checked;
			const c = compare(checked!, want, step.ordered);
			if (c.ok) {
				x.state = wasShown ? 'shown' : 'solved';
				x.sub = '';
			} else {
				x.state = 'wrong';
				x.sub = sqlHint(sql) ?? c.sub;
			}
			// Entprellter Sync: je Uebungsschritt eine Zeile (neuer Vertrag)
			syncExerciseStep({
				lesson_id: lesson.id,
				step: cur,
				done: x.state === 'solved' || x.state === 'shown',
				attempts: x.attempts,
				lastQuery: sql,
				errorMsg: x.state === 'wrong' ? 'Ergebnis stimmt nicht' : '',
			});
		}
	}

	function next() {
		if (!canNext) return;
		if (cur < lesson.steps.length - 1) {
			cur += 1;
			reached = Math.max(reached, cur);
			stepMenu = false;
			if (!loadProgress()[lesson.id]?.done) saveProgress(lesson.id, { step: cur + 1, of: lesson.steps.length });
		} else {
			finished = true;
			saveProgress(lesson.id, { done: true });
			// Alle Uebungsschritte als done markieren (Lektion abgeschlossen)
			const exerciseSteps = lesson.steps
				.map((s, i) => ({ s, i }))
				.filter(({ s }) => s.kind === 'exercise');
			for (const { i } of exerciseSteps) {
				const state = st[i];
				syncExerciseStep({
					lesson_id: lesson.id,
					step: i,
					done: true,
					attempts: state?.attempts ?? 0,
					lastQuery: state?.lastSql ?? '',
					errorMsg: '',
				});
			}
		}
	}
	function back() {
		if (finished) finished = false;
		else if (cur > 0) cur -= 1;
	}
	function tryExample(code: string) {
		const i = lesson.steps.findIndex((x) => x.kind === 'example');
		if (i >= 0 && i <= reached) {
			st[i].code = code;
			cur = i;
		}
	}
	function doReset() {
		const x = lesson.steps[cur];
		s.code = x.kind === 'exercise' ? x.starter : x.kind === 'example' ? x.code : '';
		s.errLine = null;
		dialog = null;
	}
	function doSolution() {
		if (step.kind !== 'exercise') return;
		s.code = step.solution;
		s.errLine = null;
		dialog = null;
		s.state = 'shown';
		s.lastSql = step.check ?? step.solution;
		if (db) s.result = runChecked(db, step.solution, step.check).checked;
	}
	function closeGuest() {
		guestHint = false;
		try {
			localStorage.setItem('tabula-guest-hint', '1');
		} catch {
			/* ignore */
		}
	}
	function download() {
		if (db) exportDb(db, lesson.db.name);
	}
	function insertName(n: string) {
		(window.innerWidth < 768 ? mEditor : editor)?.insert(n);
		sheet = false;
	}

	// ---------- Darstellung (Feedback-Leiste nach Design) -----------------------
	type Fb = { tone: Tone; icon: string; owl: string; owlMode: 'static' | 'once'; msg: string; sub?: string; orig?: string; footOwl: boolean };
	const fb = $derived.by((): Fb => {
		const base = { footOwl: true, owlMode: 'static' as const };
		if (step.kind === 'explain') return { ...base, tone: 'neutral', icon: 'i', owl: 'idle', msg: 'Lies dir die Erklärung in Ruhe durch.', sub: '„Ausprobieren“ übernimmt das Beispiel in den Editor.' };
		if (step.kind === 'summary') return { ...base, footOwl: false, tone: 'neutral', icon: 'i', owl: 'idle', msg: 'Alles klar? Dann schließ die Lektion ab.' };
		if (dbState === 'fail') return { ...base, footOwl: false, tone: 'neutral', icon: 'i', owl: 'idle', msg: 'Ohne Datenbank kann keine Abfrage laufen.' };
		if (s.state === 'running') return { ...base, tone: 'neutral', icon: '…', owl: 'loading', msg: 'Deine Abfrage läuft.' };
		if (s.state === 'error') return { ...base, tone: 'danger', icon: '!', owl: 'error', msg: s.errMsg, orig: s.errOrig };
		if (step.kind === 'example') {
			if (s.ran && s.result) return { ...base, tone: 'neutral', icon: 'i', owl: 'idle', msg: step.msg(s.result, total), sub: step.sub };
			return { ...base, tone: 'neutral', icon: 'i', owl: 'idle', msg: 'Führe die Abfrage aus und sieh dir das Ergebnis an.', sub: step.sub };
		}
		if (step.kind === 'exercise') {
			if (s.state === 'shown') return { ...base, tone: 'neutral', icon: 'i', owl: 'point', msg: 'Lösung angezeigt.', sub: 'Lies sie in Ruhe durch. Du kannst sie auch selbst ausführen.' };
			if (s.state === 'solved') return { ...base, owlMode: 'once', tone: 'ok', icon: '✓', owl: 'success', msg: step.okMsg, sub: step.okSub };
			if (s.state === 'wrong') {
				const tipAvail = s.attempts >= 3;
				return { ...base, tone: 'accent', icon: '?', owl: s.tipOpen ? 'hint' : tipAvail ? 'raisehand' : 'thinking', msg: 'Noch nicht ganz.', sub: tipAvail && !s.tipOpen ? `${s.sub} Ab jetzt gibt es einen Tipp.` : s.sub };
			}
		}
		return { ...base, tone: 'neutral', icon: 'i', owl: 'idle', msg: 'Schreib deine Abfrage und führe sie aus.' };
	});

	const canNext = $derived(!isWork || step.kind === 'example' || s.state === 'solved' || s.state === 'shown');
	const tipBtn = $derived(step.kind === 'exercise' && s.state === 'wrong' && s.attempts >= 3 && !s.tipOpen);
	const runLabel = $derived(s && (s.state === 'solved' || s.state === 'shown') ? 'secondary' : 'primary');
	const nextLabel = $derived(step.kind === 'summary' ? 'Lektion abschließen' : 'Weiter');
	const stepLabel = $derived(finished ? 'FERTIG' : `SCHRITT ${cur + 1} / ${lesson.steps.length}`);
	const taskLabel = $derived(step.kind === 'example' ? 'BEISPIEL' : 'AUFGABE · ÜBUNG');
	const badge = $derived(step.kind === 'example' ? 'Beispiel' : s?.state === 'shown' ? 'Lösung angezeigt' : '');
	const attemptLabel = $derived(step.kind === 'exercise' && s.attempts ? `Versuch ${s.attempts}` : '');
	const dots = $derived(lesson.steps.map((_, i) => (finished || i < cur ? 'done' : i === cur ? 'cur' : 'open')));
	const resultCount = $derived(s?.result ? `${s.result.rows.length} ${s.result.rows.length === 1 ? 'Zeile' : 'Zeilen'}` : '');
	const grid = $derived(s?.result ? (s.result.columns.length > 1 ? `minmax(0,1fr) ${Array(s.result.columns.length - 1).fill('140px').join(' ')}` : 'minmax(0,1fr)') : '');
	const emptyText = $derived(
		s?.state === 'error' ? (s.errLine ? `Kein Ergebnis. Behebe zuerst den Fehler in Zeile ${s.errLine}.` : 'Kein Ergebnis. Behebe zuerst den Fehler.') : 'Führe deine Abfrage aus, um das Ergebnis zu sehen.'
	);
	const shownRows = $derived(s?.result ? s.result.rows.slice(0, 100) : []);
	let resTab = $state<'result' | 'viz'>('result');
	// Visualisierung zur zuletzt ausgeführten Abfrage dieses Schritts (nur bei erfolgreichem SELECT)
	const viz = $derived.by(() => {
		if (!db || !s?.result || s.state === 'error' || s.state === 'running' || !s.lastSql) return null;
		try {
			return explainQuery(db, s.lastSql, schema, s.result);
		} catch {
			return null;
		}
	});
	$effect(() => {
		if (!viz && resTab === 'viz') resTab = 'result';
	});

	$effect(() => {
		void cur;
		tick().then(() => document.querySelector<HTMLElement>('[data-main]')?.scrollTo?.(0, 0));
	});
	function onkey(e: KeyboardEvent) {
		if (e.altKey && e.key === 'ArrowRight' && canNext && !finished) next();
		if (e.key === 'Escape') {
			dialog = null;
			sheet = false;
			menu = false;
			stepMenu = false;
		}
	}
</script>

<svelte:head><title>{lesson.title} · Tabula</title></svelte:head>
<svelte:window onkeydown={onkey} />

<div class="tb page">
	<!-- ================= Kopfleiste ================= -->
	<header class="top">
		<a class="back-link" href="/learn" aria-label="Zurück zu den Lektionen">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5"></path></svg>
			<span class="hide-sm">Lektionen</span>
		</a>
		<span class="sep hide-sm"></span>
		<div class="ltitle-block hide-sm">
			<span class="ltitle-kicker">{lesson.trackLabel} · Lektion {lesson.no}</span>
			<span class="ltitle">{lesson.title}</span>
		</div>
		<!-- Segment-Fortschrittsanzeige -->
		<nav class="segs-nav" aria-label="Schritte der Lektion">
			<div class="segs">
				{#each lesson.steps as x, i}
					{@const segDone = finished || i < cur}
					{@const segCur = !finished && i === cur}
					{@const segLocked = i > reached}
					<button
						type="button"
						title={x.name}
						aria-label={x.name}
						aria-current={segCur ? 'step' : undefined}
						disabled={segLocked}
						onclick={() => goto(i)}
						class="seg-btn"
					>
						<span class="seg-bar" class:seg-done={segDone} class:seg-cur={segCur} class:seg-locked={segLocked}></span>
					</button>
				{/each}
			</div>
			<span class="steplbl mono">{stepLabel}</span>
		</nav>
		<div class="top-actions">
			<button class="icon-btn" title="Datenbank herunterladen (.db)" aria-label="Datenbank herunterladen" onclick={download} disabled={!db}>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"></path></svg>
			</button>
			<span class="avatar" title={session.displayName || 'Gast'}>{avatarInitials()}</span>
		</div>
		<!-- Mobil: Schritte-Dropdown -->
		<div class="sm-steps">
			<button class="chip mono" onclick={() => (stepMenu = !stepMenu)} aria-expanded={stepMenu}>{stepLabel} ▾</button>
			{#if stepMenu}
				<div class="dd" role="menu">
					{#each lesson.steps as x, i}
						<button role="menuitem" class="dd-item" class:on={i === cur} disabled={i > reached} onclick={() => goto(i)}>
							<span class="mk">{i === cur ? '●' : i < reached || finished ? '✓' : '○'}</span><span>{x.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</header>

	{#if finished}
		<!-- ================= Lektion geschafft ================= -->
		<main class="donescr">
			<div class="done-in">
				<Edgar pose="celebrate" {dark} class="done-owl" />
				<div class="done-head">
					<span class="lbl">{lesson.trackLabel} · LEKTION {lesson.no} VON {lesson.of}</span>
					<h1 class="h1">Lektion geschafft</h1>
					<span class="done-sub">{lesson.done.sub}</span>
				</div>
				<div class="done-list">
					{#each lesson.done.points as p}
						<div class="done-row"><span class="ok-dot">✓</span><span>{p}</span></div>
					{/each}
				</div>
				<div class="done-btns">
					{#if lesson.next}
						<a class="btn-lg primary" href="/learn/{lesson.track}/{lesson.next.id}">Nächste Lektion: {lesson.next.title}<span class="arr"></span></a>
					{/if}
					<a class="btn-lg secondary" href="/learn">Zur Übersicht</a>
				</div>
			</div>
		</main>
		<div class="m-done-btns">
			{#if lesson.next}<a class="m-btn primary" href="/learn/{lesson.track}/{lesson.next.id}">Nächste Lektion<span class="arr"></span></a>{/if}
			<a class="m-btn secondary" href="/learn">Zur Übersicht</a>
		</div>
	{:else if step.kind === 'explain'}
		<!-- ================= Erklärung ================= -->
		<main class="read-main" data-main>
			<div class="col">
				<div class="step-badge-row">
					<span class="step-badge">Erklärung</span>
					<span class="step-name-sm">{step.name}</span>
				</div>
				<h1 class="h1">{step.title}</h1>
				{#each step.paras as p}<p class="para">{p}</p>{/each}
				<div class="code-card">
					<div class="cc-head"><span>Beispiel</span><span class="hide-sm">{lesson.db.name}</span></div>
					<div class="cc-body">
						{#each step.example.split('\n') as l, i}
							<div class="cl"><span class="cn">{i + 1}</span><span class="ct">{#each tok(l) as t}<span style="color:{t.c}">{t.t}</span>{/each}</span></div>
						{/each}
					</div>
					<div class="cc-foot">
						<button class="try-btn" onclick={() => tryExample(step.example)}>Im Editor ausprobieren
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
						</button>
					</div>
				</div>
			</div>
		</main>
		<footer class="nav-foot">
			<button class="nav-btn secondary" onclick={back} disabled={cur === 0}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8H3M7.5 3.5 3 8l4.5 4.5"></path></svg>
				Zurück
			</button>
			<span class="nav-hint">Lies die Erklärung, dann weiter.</span>
			<button class="nav-btn primary" onclick={next}>Weiter
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
			</button>
		</footer>
	{:else if step.kind === 'summary'}
		<!-- ================= Zusammenfassung ================= -->
		<main class="read-main" data-main>
			<div class="col">
				<div class="sum-head">
					<Edgar pose="read" {dark} class="sum-owl" />
					<div>
						<div class="step-badge-row">
							<span class="step-badge">Zusammenfassung</span>
						</div>
						<h1 class="h1">{step.title}</h1>
					</div>
				</div>
				<ul class="sum-list">
					{#each step.points as p}
						<li class="sum-row">
							<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--ok)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:3px"><path d="M3 8.5 6.5 12 13 4.5"></path></svg>
							{p}
						</li>
					{/each}
				</ul>
				<div class="real-card">
					<h2 class="real-t">Wozu braucht man das in echt?</h2>
					<p class="real-b">{step.real}</p>
				</div>
			</div>
		</main>
		<footer class="nav-foot">
			<button class="nav-btn secondary" onclick={back} disabled={cur === 0}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8H3M7.5 3.5 3 8l4.5 4.5"></path></svg>
				Zurück zur letzten Übung
			</button>
			<span class="nav-hint"></span>
			<button class="nav-btn primary" onclick={next}>Lektion abschließen
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
			</button>
		</footer>
	{:else}
		<!-- ================= Aufgabe / Beispiel ================= -->
		<main class="work-main" data-main>
			<h1 class="sr-only">{lesson.title}: {step.task}</h1>

			<!-- Linke Spalte: Aufgabe + Schema + Gast-Hinweis -->
			<section class="left-col" aria-label="Aufgabe">
				<div class="task-card">
					<div class="step-badge-row">
						<span class="step-badge">{taskLabel}</span>
						<span class="step-name-sm">{step.name}</span>
					</div>
					<h2 class="task-title">{step.task}</h2>
					{#if step.taskSub}<p class="task-sub">{step.taskSub}</p>{/if}

				</div>

				<!-- Schema-Akkordeon -->
				<div class="schema-card">
					<div class="schema-head">
						<h2 class="schema-title">Schema</h2>
						<span class="schema-hint">Klick fügt den Namen ein</span>
					</div>
					{#if dbState === 'loading'}
						<div class="schema-loading">
							<div class="skel"></div><div class="skel w70"></div><div class="skel w55"></div>
						</div>
					{/if}
					{#each schema as t}
						<div class="schema-tbl-block">
							<div class="schema-tbl-row">
								<button class="schema-toggle" onclick={() => (openTables[t.table] = !openTables[t.table])} aria-expanded={openTables[t.table]} aria-label="Tabelle {t.table} auf- oder zuklappen">
									<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:{openTables[t.table] ? 'rotate(90deg)' : 'none'};transition:transform .15s"><path d="M6 3.5 10.5 8 6 12.5"></path></svg>
								</button>
								<button class="schema-tbl-btn mono" onclick={() => insertName(t.table)}>
									<span class="schema-tbl-name">{t.table}</span>
									<span class="schema-count">{total} Zeilen</span>
								</button>
							</div>
							{#if openTables[t.table]}
								<div class="schema-cols">
									{#each t.cols as c}
										<button class="schema-col-btn mono" onclick={() => insertName(c.name)}>
											<span class="schema-col-name">{c.name}</span>
											<span class="schema-col-type">{c.type}</span>
											{#if c.key}<span class="schema-col-key">{c.key}</span>{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
					{#if dbState === 'fail'}
						<div class="schema-fail">
							<Edgar pose="sleep" {dark} style="width:64px;height:58px" />
							<div>
								<p class="schema-fail-t">Datenbank konnte nicht geladen werden.</p>
								<button class="schema-retry" onclick={loadDb}>Erneut versuchen</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Gast-Hinweis -->
				{#if guestHint}
					<div class="guest-card">
						<p class="guest-txt">Fortschritt wird nur in diesem Browser gespeichert. Mit dem Klassencode deiner Lehrkraft kannst du einer <a href="/beitreten">Klasse beitreten</a>.</p>
						<button class="guest-close" onclick={closeGuest} aria-label="Hinweis schließen">
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"></path></svg>
						</button>
					</div>
				{/if}
			</section>

			<!-- Rechte Spalte: Editor + Feedback + Ergebnis -->
			<section class="right-col" aria-label="Editor und Ergebnis">
				<!-- Editor-Karte -->
				<div class="editor-card">
					<div class="ed-head">
						<label for="tb-query" class="mono ed-label">query.sql</label>
						<div class="ed-actions">
							{#if step.kind === 'exercise'}
								<button
									class="ed-action-btn"
									class:tip-active={s.tipOpen}
									onclick={() => (s.tipOpen = !s.tipOpen)}
									disabled={s.attempts < 3}
									title={s.attempts < 3 ? 'Tipp freigeschaltet nach 3 Versuchen' : 'Tipp von Edgar'}
								>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5h4M6.5 14.5h3M8 1.5a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.7.6 1.1V11h4v-.2c0-.4.2-.8.6-1.1A4.5 4.5 0 0 0 8 1.5Z"></path></svg>
									Tipp
								</button>
								{#if s.attempts >= 3}
									<button class="ed-action-btn" onclick={() => (dialog = 'solution')}>Lösung zeigen</button>
								{/if}
							{/if}
							<button class="ed-action-btn" onclick={() => (dialog = 'reset')} title="Startcode wiederherstellen">
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3v3.5H6"></path><path d="M3 9.5A5 5 0 1 0 4 4.4L2.5 6.5"></path></svg>
								Zurücksetzen
							</button>
							<!-- Bestätigungs-Popover -->
							{#if dialog}
								<div class="confirm-pop" role="alertdialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
									{#if dialog === 'reset'}
										<p class="confirm-title">Abfrage zurücksetzen?</p>
										<p class="confirm-text">Deine Abfrage wird durch den Startcode ersetzt.</p>
										<div class="confirm-btns">
											<button class="btn-sm secondary" onclick={() => (dialog = null)}>Abbrechen</button>
											<button class="btn-sm primary" onclick={doReset}>Zurücksetzen</button>
										</div>
									{:else}
										<p class="confirm-title">Lösung wirklich anzeigen?</p>
										<p class="confirm-text">Die Lösung ersetzt deine Abfrage. Mit dem Tipp schaffst du es vielleicht auch selbst.</p>
										<div class="confirm-btns">
											<button class="btn-sm secondary" onclick={() => (dialog = null)}>Weiterprobieren</button>
											<button class="btn-sm primary" onclick={doSolution}>Lösung zeigen</button>
										</div>
									{/if}
								</div>
								<div class="confirm-scrim" role="presentation" onclick={() => (dialog = null)}></div>
							{/if}
						</div>
					</div>
					<!-- Desktop-Editor -->
					<div class="ed-body">
						<CodeEditor bind:this={editor} bind:value={s.code} errLine={s.state === 'error' ? s.errLine : null} onrun={exec} />
					</div>
					<!-- Mobil-Editor -->
					<div class="ed-body-sm">
						<CodeEditor bind:this={mEditor} bind:value={s.code} errLine={s.state === 'error' ? s.errLine : null} onrun={exec} size="sm" minLines={6} />
					</div>
					<div class="ed-foot">
						{#if s.state === 'running'}
							<button class="run-btn" disabled>
								<span class="spin-sm"></span>Läuft …
							</button>
						{:else}
							<button class="run-btn" class:run-primary={runLabel === 'primary'} onclick={exec} disabled={dbState !== 'ok'}>
								<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"></path></svg>
								Ausführen
							</button>
						{/if}
						<span class="ed-hint"><kbd class="mono">Strg / ⌘</kbd> + <kbd class="mono">Enter</kbd></span>
						{#if attemptLabel}<span class="attempt-lbl mono">{attemptLabel}</span>{/if}
					</div>
				</div>

				<!-- Feedback-Box mit Edgar -->
				<div
					class="fb-card"
					class:fb-ok={fb.tone === 'ok'}
					class:fb-danger={fb.tone === 'danger'}
					class:fb-accent={fb.tone === 'accent'}
					id="tb-feedback"
					aria-live="polite"
				>
					{#key fb.owl + cur + s?.attempts}
						<Edgar pose={fb.owl} mode={fb.owlMode} {dark} class="fb-owl" />
					{/key}
					<div class="fb-body">
						<p class="fb-msg">{fb.msg}</p>
						{#if fb.sub}<p class="fb-sub">{fb.sub}</p>{/if}
						{#if fb.orig}<p class="fb-orig mono">{fb.orig}</p>{/if}
					</div>
					{#if canNext}
						<button class="fb-next" onclick={next}>Weiter
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
						</button>
					{/if}
				</div>

				<!-- Tipp-Box -->
				{#if step.kind === 'exercise' && s.tipOpen && s.state === 'wrong'}
					<div class="tip-card">
						<strong class="tip-lbl">Tipp von Edgar</strong>
						<span class="tip-txt">{step.tip}</span>
					</div>
				{/if}

				<!-- Ergebnis -->
				<div class="result-card">
					<div class="result-head">
						<h2 class="result-title">Ergebnis</h2>
						<div class="res-tabs" role="tablist">
							<button role="tab" class="res-tab" class:on={resTab === 'result'} aria-selected={resTab === 'result'} onclick={() => (resTab = 'result')}>Tabelle</button>
							<button role="tab" class="res-tab" class:on={resTab === 'viz'} aria-selected={resTab === 'viz'} disabled={!viz} onclick={() => (resTab = 'viz')}>Was passiert?</button>
						</div>
						<span class="mono result-n">{s?.state === 'running' ? '' : resultCount}</span>
					</div>
					{#if s?.state === 'running'}
						<div class="res-empty"><span class="spin"></span>Abfrage läuft …</div>
					{:else if dbState === 'loading'}
						<div class="res-empty"><span class="spin"></span>Datenbank wird geladen …</div>
					{:else if resTab === 'viz' && viz}
						<QueryViz {viz} />
					{:else if s?.result && s.state !== 'error'}
						<div class="res-table">
							<div class="res-row res-hd" style="grid-template-columns:{grid}">
								{#each s.result.columns as c}<span class="mono">{c}</span>{/each}
							</div>
							{#each shownRows as r}
								<div class="res-row" style="grid-template-columns:{grid}">
									{#each r as c}<span>{c === null ? 'NULL' : c}</span>{/each}
								</div>
							{/each}
							{#if s.result.rows.length > 100}
								<div class="res-more">Erste 100 von {s.result.rows.length.toLocaleString('de-DE')} Zeilen</div>
							{/if}
							{#if s.result.rows.length === 0}
								<div class="res-more">Keine Zeile erfüllt die Bedingung.</div>
							{/if}
						</div>
					{:else}
						<div class="res-empty">{emptyText}</div>
					{/if}
				</div>
			</section>

			<!-- Mobil: Schema-Button -->
			<button class="m-schema-btn sm-only" onclick={() => (sheet = true)}>
				Schema: {schema.map((t) => t.table).join(', ')}
				<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13.5V2.5M3.5 8 8 3.5 12.5 8"></path></svg>
			</button>
		</main>

		<!-- ================= Fussleiste ================= -->
		<footer class="nav-foot">
			<button class="nav-btn secondary" onclick={back} disabled={cur === 0}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8H3M7.5 3.5 3 8l4.5 4.5"></path></svg>
				Zurück
			</button>
			<span class="nav-hint">{canNext ? '' : 'Lösung erst ausführen'}</span>
			{#if tipBtn}
				<button class="nav-btn tip-nav" onclick={() => (s.tipOpen = true)}>Tipp anzeigen</button>
			{/if}
			{#if canNext}
				<button class="nav-btn primary" onclick={next}>{nextLabel}
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
				</button>
			{:else}
				<button class="nav-btn primary" disabled>{nextLabel}
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
				</button>
			{/if}
		</footer>
	{/if}

	<!-- ================= Schema-Sheet (Mobil) ================= -->
	{#if sheet}
		<div class="scrim sheet-scrim" role="presentation" onclick={() => (sheet = false)}></div>
		<div class="sheet" role="dialog" aria-label="Schema">
			<div class="grab"><span></span></div>
			<div class="sheet-head"><span class="sheet-t">Schema</span><button class="icon44 muted" aria-label="Schließen" onclick={() => (sheet = false)}>✕</button></div>
			<div class="sheet-body">
				{#each schema as t, ti}
					<button class="s-tbl mono" class:bt={ti > 0} onclick={() => (openTables[t.table] = !openTables[t.table])}><span class="muted">{openTables[t.table] ? '▾' : '▸'}</span>{t.table}</button>
					{#if openTables[t.table]}
						{#each t.cols as c}
							<button class="s-col mono" onclick={() => { mEditor?.insert(c.name); sheet = false; }}>
								<span class="grow">{c.name}</span>
								{#if c.key}<span class="key">{c.key}</span>{/if}
								<span class="ctype">{c.type}</span>
								<span class="s-ins">+ Einf.</span>
							</button>
						{/each}
					{/if}
				{/each}
			</div>
			<span class="sheet-hint">Tippen fügt den Namen an der Cursor-Position ein.</span>
		</div>
	{/if}
</div>

<style>
	/* Global box-sizing: theme.css uses content-box, override for our components */
	*, *::before, *::after { box-sizing: border-box; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
	.mono { font-family: var(--mono); }
	.muted { color: var(--ink-3); }
	.grow { flex: 1; }
	.page { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; position: relative; }
	/* Kopfleiste */
	.top { height: 56px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 20px; border-bottom: 1px solid var(--line); background: var(--surface); position: relative; z-index: 10; }
	.back-link { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; border-radius: 6px; font-size: 14px; font-weight: 500; color: var(--ink-2); text-decoration: none; }
	.back-link:hover { background: var(--subtle); color: var(--ink); }
	.sep { width: 1px; height: 22px; background: var(--line); }
	.ltitle-block { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
	.ltitle-kicker { font-size: 12px; color: var(--ink-3); }
	.ltitle { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	/* Segment-Fortschritt */
	.segs-nav { flex: 1 1 280px; display: flex; align-items: center; gap: 12px; min-width: 180px; justify-content: center; }
	.segs { display: flex; gap: 4px; flex: 1; max-width: 420px; }
	.seg-btn { flex: 1; height: 24px; padding: 0; border: 0; background: transparent; display: flex; align-items: center; cursor: pointer; }
	.seg-btn:disabled { cursor: default; }
	/* Base: upcoming (not done, not cur, not locked) */
	.seg-bar { display: block; width: 100%; height: 4px; border-radius: 3px; background: var(--line-strong); transition: background 0.2s, height 0.15s; }
	/* Locked: explicitly lighter */
	.seg-bar.seg-locked { background: var(--line); }
	/* Done: accent color — must come after locked to win */
	.seg-bar.seg-done { background: var(--accent) !important; height: 4px; }
	/* Current: taller accent — must be last */
	.seg-bar.seg-cur { background: var(--accent) !important; height: 8px; }
	.steplbl { font-size: 12px; letter-spacing: 0.06em; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }

	.top-actions { display: flex; align-items: center; gap: 6px; }
	.icon-btn { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--line); background: var(--surface); border-radius: 7px; cursor: pointer; color: var(--ink-2); }
	.icon-btn:hover:not(:disabled) { background: var(--subtle); }
	.icon-btn:disabled { opacity: 0.45; cursor: default; }
	.avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--subtle); color: var(--ink-2); font-size: 13px; font-weight: 600; margin-left: 4px; }

	.sm-steps { display: none; position: relative; }
	.chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--line-strong); font-size: 12px; color: var(--ink-2); }
	.chip:hover { background: var(--subtle); }
	.dd { position: absolute; top: 40px; right: 0; z-index: 20; min-width: 220px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow-pop); padding: 6px; display: flex; flex-direction: column; }
	.dd-item { display: flex; gap: 10px; align-items: center; min-height: 40px; padding: 0 10px; border-radius: 6px; font-size: 14px; border: 0; background: transparent; text-align: left; cursor: pointer; }
	.dd-item:hover, .dd-item.on { background: var(--accent-soft); color: var(--accent-ink); }
	.dd-item:disabled { color: var(--ink-3); cursor: not-allowed; }
	.dd-item .mk { width: 16px; color: var(--accent); }
	.hide-sm { /* shown by default */ }

	/* Leseansicht */
	.read-main { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; justify-content: center; align-items: flex-start; padding: 48px clamp(16px, 3vw, 48px) 40px; }
	.col { width: 680px; max-width: 100%; display: flex; flex-direction: column; gap: 20px; }
	.h1 { margin: 0; font-size: 30px; line-height: 38px; font-weight: 600; letter-spacing: -0.015em; }
	.lbl { font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; color: var(--ink-3); }

	.step-badge-row { display: flex; align-items: center; gap: 8px; }
	.step-badge { font-size: 12px; font-weight: 600; color: var(--accent-ink); background: var(--accent-soft); padding: 2px 8px; border-radius: 5px; }
	.step-name-sm { font-size: 13px; color: var(--ink-3); }

	.para { margin: 0; font-size: 15px; line-height: 1.65; color: var(--ink-2); text-wrap: pretty; }
	.code-card { border-radius: 10px; background: #0f172a; overflow: hidden; }
	.cc-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid #1e293b; font-family: var(--mono); font-size: 12px; color: #64748b; }
	.cc-body { padding: 12px 0; }
	.cl { display: flex; font-family: var(--mono); font-size: 14px; line-height: 22px; }
	.cn { width: 44px; flex: none; text-align: right; padding-right: 14px; color: #64748b; }
	.ct { white-space: pre; color: #e2e8f0; }
	.cc-foot { display: flex; justify-content: flex-end; padding: 8px; border-top: 1px solid #1e293b; }
	.try-btn { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font-size: 13px; font-weight: 500; cursor: pointer; }
	.try-btn:hover { background: var(--subtle); }

	/* Zusammenfassung */
	.sum-head { display: flex; align-items: center; gap: 18px; }
	:global(.tb .sum-owl) { width: 96px; height: 86px; flex: none; }
	.sum-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
	.sum-row { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); font-size: 16px; line-height: 1.55; }
	.real-card { padding: 18px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
	.real-t { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
	.real-b { margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink-2); text-wrap: pretty; }

	/* Aufgabe/Beispiel: zwei-Spalten-Layout */
	.work-main { flex: 1; min-height: 0; display: flex; flex-wrap: wrap; gap: 16px; padding: 16px clamp(16px, 2vw, 32px); align-items: flex-start; max-width: 100%; width: 100%; margin: 0 auto; overflow-y: auto; overflow-x: hidden; }
	.left-col { flex: 1 1 300px; max-width: 480px; min-width: 0; width: 0; display: flex; flex-direction: column; gap: 16px; }
	.right-col { flex: 999 1 460px; min-width: 0; width: 0; display: flex; flex-direction: column; gap: 16px; }

	/* Aufgaben-Karte */
	.task-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 22px 22px 20px; }
	.task-title { margin: 8px 0 6px; font-size: 22px; line-height: 1.3; font-weight: 600; letter-spacing: -0.015em; }
	.task-sub { margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink-2); text-wrap: pretty; }
	.expected-cols { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
	.expected-lbl { font-size: 13px; color: var(--ink-3); margin-right: 2px; }
	.col-chip { font-size: 12px; font-weight: 500; padding: 3px 7px; border-radius: 5px; background: var(--subtle); border: 1px solid var(--line); }

	/* Schema-Karte */
	.schema-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
	.schema-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); }
	.schema-title { margin: 0; font-size: 14px; font-weight: 600; }
	.schema-hint { font-size: 12px; color: var(--ink-3); }
	.schema-loading { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
	.skel { height: 14px; width: 40%; border-radius: 4px; background: var(--subtle); }
	.skel.w70 { width: 70%; }
	.skel.w55 { width: 55%; }
	.schema-tbl-block { border-bottom: 1px solid var(--line); }
	.schema-tbl-block:last-child { border-bottom: 0; }
	.schema-tbl-row { display: flex; align-items: center; }
	.schema-toggle { width: 36px; height: 40px; display: grid; place-items: center; border: 0; background: transparent; cursor: pointer; color: var(--ink-3); flex: none; }
	.schema-tbl-btn { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 40px; padding: 0 16px 0 0; border: 0; background: transparent; cursor: pointer; text-align: left; }
	.schema-tbl-btn:hover { color: var(--accent-ink); }
	.schema-tbl-name { font-size: 13px; font-weight: 600; }
	.schema-count { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
	.schema-cols { padding: 0 8px 8px 28px; display: flex; flex-direction: column; }
	.schema-col-btn { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 8px; border: 0; border-radius: 5px; background: transparent; cursor: pointer; text-align: left; font-size: 13px; }
	.schema-col-btn:hover { background: var(--accent-soft); }
	.schema-col-name { flex: 1; }
	.schema-col-type { font-size: 11px; color: var(--ink-3); }
	.schema-col-key { font-size: 10px; font-weight: 600; color: var(--accent-ink); min-width: 18px; text-align: right; }
	.schema-fail { padding: 20px 16px; display: flex; gap: 14px; align-items: center; }
	.schema-fail-t { margin: 0 0 8px; font-size: 14px; font-weight: 500; }
	.schema-retry { height: 32px; padding: 0 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font-size: 13px; cursor: pointer; }

	/* Gast-Hinweis */
	.guest-card { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); font-size: 14px; line-height: 1.5; color: var(--ink-2); }
	.guest-txt { margin: 0; flex: 1; }
	.guest-txt a { color: var(--accent-ink); }
	.guest-close { width: 28px; height: 28px; display: grid; place-items: center; border: 0; background: transparent; border-radius: 5px; cursor: pointer; color: var(--ink-3); }
	.guest-close:hover { background: var(--subtle); }

	/* Editor-Karte */
	.editor-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
	.ed-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--line); }
	.ed-label { font-size: 13px; color: var(--ink-2); flex: 1; }
	.ed-actions { position: relative; display: flex; gap: 6px; flex-wrap: wrap; }
	.ed-action-btn { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font-size: 13px; font-weight: 500; cursor: pointer; color: var(--ink-2); }
	.ed-action-btn:hover:not(:disabled) { background: var(--subtle); color: var(--ink); }
	.ed-action-btn:disabled { opacity: 0.45; cursor: default; }
	.ed-action-btn.tip-active { border-color: var(--accent-line); background: var(--accent-soft); color: var(--accent-ink); }
	.ed-body { /* desktop */ }
	.ed-body-sm { display: none; /* mobile */ }

	/* Bestätigungs-Popover */
	.confirm-scrim { position: fixed; inset: 0; z-index: 9; }
	.confirm-pop { position: absolute; right: 0; top: 40px; z-index: 10; width: 280px; padding: 16px; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 10px; box-shadow: var(--shadow-pop); animation: tbIn 0.16s ease-out; }
	.confirm-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
	.confirm-text { margin: 0 0 14px; font-size: 13px; line-height: 1.5; color: var(--ink-2); }
	.confirm-btns { display: flex; gap: 8px; justify-content: flex-end; }
	.btn-sm { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 6px; font-size: 13px; cursor: pointer; }
	.btn-sm.secondary { border: 1px solid var(--line); background: var(--surface); }
	.btn-sm.primary { border: 1px solid var(--accent); background: var(--accent); color: #fff; font-weight: 500; }
	.btn-sm.primary:hover { background: var(--accent-strong); border-color: var(--accent-strong); }

	.ed-foot { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 12px; border-top: 1px solid var(--line); }
	.run-btn { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); color: var(--ink-2); font-size: 14px; font-weight: 600; cursor: pointer; }
	.run-btn.run-primary { border-color: var(--accent); background: var(--accent); color: #fff; }
	.run-btn.run-primary:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
	.run-btn:disabled { opacity: 0.5; cursor: default; }
	.ed-hint { font-size: 13px; color: var(--ink-3); }
	.ed-hint kbd { font-size: 12px; padding: 2px 6px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; background: var(--surface); }
	.attempt-lbl { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; margin-left: auto; }
	.spin-sm { width: 14px; height: 14px; border-radius: 999px; border: 2px solid var(--line); border-top-color: var(--accent); animation: tbSpin 0.7s linear infinite; }

	/* Feedback-Box */
	.fb-card { display: flex; gap: 14px; align-items: center; padding: 12px 16px; min-height: 76px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: background 0.2s; }
	.fb-card.fb-ok { background: var(--ok-soft); border-color: var(--ok-line); }
	.fb-card.fb-danger { background: var(--danger-soft); border-color: var(--danger-line); }
	.fb-card.fb-accent { background: var(--accent-soft); border-color: var(--accent-line); }
	:global(.tb .fb-owl) { width: 62px; height: 56px; flex: none; }
	.fb-body { flex: 1; min-width: 0; }
	.fb-msg { margin: 0; font-size: 15px; font-weight: 600; }
	.fb-card.fb-ok .fb-msg { color: var(--ok-ink); }
	.fb-card.fb-danger .fb-msg { color: var(--danger-ink); }
	.fb-card.fb-accent .fb-msg { color: var(--accent-ink); }
	.fb-sub { margin: 2px 0 0; font-size: 14px; line-height: 1.5; color: var(--ink-2); text-wrap: pretty; }
	.fb-orig { margin: 4px 0 0; font-size: 12px; color: var(--ink-3); }
	.fb-next { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border: 1px solid var(--accent); border-radius: 7px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; animation: tbIn 0.2s ease-out; flex: none; }
	.fb-next:hover { background: var(--accent-strong); border-color: var(--accent-strong); }

	/* Tipp-Box */
	.tip-card { display: flex; gap: 10px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); font-size: 14px; line-height: 1.55; }
	.tip-lbl { font-weight: 600; flex: none; }
	.tip-txt { color: var(--ink); }

	/* Prevent inner elements from blowing past flex container */
	.editor-card, .task-card, .schema-card, .fb-card, .tip-card, .guest-card, .result-card { min-width: 0; max-width: 100%; }

	/* Ergebnis-Karte */
	.result-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; min-height: 160px; }
	.result-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--line); }
	.result-title { margin: 0; font-size: 14px; font-weight: 600; }
	.res-tabs { display: flex; gap: 12px; }
	.res-tab { padding: 0 !important; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; font-size: 13px; color: var(--ink-3); cursor: pointer; }
	.res-tab.on { color: var(--ink); border-bottom-color: var(--accent); }
	.res-tab:disabled { opacity: 0.4; cursor: default; }
	.result-n { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
	.res-empty { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 28px 16px; text-align: center; font-size: 14px; color: var(--ink-3); }
	.spin { width: 16px; height: 16px; border-radius: 999px; border: 2px solid var(--line-strong); border-top-color: var(--accent); animation: tbSpin 0.9s linear infinite; }
	.res-table { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
	.res-row { display: grid; border-bottom: 1px solid var(--line); min-width: max-content; }
	.res-row > span { padding: 8px 16px; font-size: 14px; line-height: 20px; }
	.res-row > span:first-child { position: sticky; left: 0; background: var(--surface); }
	.res-hd { background: var(--subtle); position: sticky; top: 0; z-index: 1; }
	.res-hd > span { font-size: 12px; color: var(--ink-2); letter-spacing: 0.04em; }
	.res-hd > span:first-child { background: var(--subtle); }
	.res-more { padding: 8px 16px; font-size: 13px; color: var(--ink-3); }

	.m-schema-btn { display: none; }
	.sm-only { display: none; }

	/* Fussleiste */
	.nav-foot { position: sticky; bottom: 0; z-index: 15; display: flex; align-items: center; gap: 12px; padding: 10px 20px; background: var(--surface); border-top: 1px solid var(--line); }
	.nav-btn { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); font-size: 14px; cursor: pointer; }
	.nav-btn.secondary { color: var(--ink-2); }
	.nav-btn.secondary:hover:not(:disabled) { background: var(--subtle); color: var(--ink); }
	.nav-btn.secondary:disabled { opacity: 0.4; cursor: default; }
	.nav-btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 500; }
	.nav-btn.primary:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
	.nav-btn.primary:disabled { opacity: 0.5; cursor: default; }
	.nav-btn.tip-nav { border-color: var(--accent-line); color: var(--accent-ink); }
	.nav-hint { flex: 1; text-align: center; font-size: 13px; color: var(--ink-3); }

	/* Lektion geschafft */
	.donescr { flex: 1; display: grid; place-items: center; padding: 48px 20px; overflow: auto; }
	.done-in { width: 560px; max-width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; animation: tbIn 0.3s ease-out; }
	:global(.tb .done-owl) { width: 180px; height: 162px; }
	.done-head { display: flex; flex-direction: column; gap: 8px; align-items: center; }
	.done-sub { font-size: 16px; color: var(--ink-2); }
	.done-list { width: 100%; display: flex; flex-direction: column; text-align: left; border-top: 1px solid var(--line); }
	.done-row { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); font-size: 16px; line-height: 1.55; }
	.ok-dot { flex: none; margin-top: 3px; }
	.done-btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
	.btn-lg { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 8px; font-size: 15px; font-weight: 600; white-space: nowrap; text-decoration: none; }
	.btn-lg.primary { background: var(--accent); color: #fff; border: 1px solid var(--accent); }
	.btn-lg.primary:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
	.btn-lg.secondary { border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
	.arr { display: inline-block; width: 0.9em; height: 0.9em; flex: none; vertical-align: -0.1em; background: currentColor;
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
	}
	.m-done-btns { display: none; flex-direction: column; gap: 10px; padding: 12px 16px 20px; border-top: 1px solid var(--line); background: var(--surface); }
	.m-btn { display: flex; align-items: center; justify-content: center; gap: 8px; height: 48px; border-radius: 6px; font-size: 16px; font-weight: 500; text-decoration: none; }
	.m-btn.primary { background: var(--accent); color: #fff; }
	.m-btn.secondary { border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); }

	/* Schema-Sheet (Mobil) */
	.sheet-scrim { position: fixed; inset: 0; background: rgb(15 23 42 / 0.45); z-index: 30; }
	.scrim { position: fixed; inset: 0; background: rgb(15 23 42 / 0.5); display: grid; place-items: center; z-index: 30; }
	.sheet { position: fixed; left: 0; right: 0; bottom: 0; height: 520px; max-height: 80%; z-index: 31; display: flex; flex-direction: column; background: var(--surface); border-radius: 16px 16px 0 0; box-shadow: var(--shadow-pop); }
	.grab { display: flex; justify-content: center; padding: 10px 0 4px; }
	.grab span { width: 40px; height: 4px; border-radius: 999px; background: var(--line-strong); }
	.sheet-head { display: flex; align-items: center; padding: 4px 8px 8px 20px; }
	.sheet-t { flex: 1; font-size: 18px; font-weight: 600; }
	.sheet-body { flex: 1; overflow: auto; padding: 0 12px; display: flex; flex-direction: column; }
	.icon44 { width: 44px; height: 44px; display: grid; place-items: center; font-size: 18px; color: var(--ink-2); border: 0; background: transparent; cursor: pointer; }
	.s-tbl { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px; font-size: 15px; font-weight: 500; border: 0; background: transparent; cursor: pointer; text-align: left; }
	.s-tbl.bt { border-top: 1px solid var(--line); }
	.s-col { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px 0 30px; border-top: 1px solid var(--line); font-size: 14px; border-left: 0; border-right: 0; border-bottom: 0; background: transparent; cursor: pointer; text-align: left; }
	.key { font-size: 10px; padding: 0 5px; border-radius: 4px; background: var(--accent-soft); color: var(--accent-ink); }
	.ctype { color: var(--ink-3); font-size: 12px; }
	.s-ins { color: var(--accent-strong); font-family: var(--sans); font-size: 13px; font-weight: 500; width: 52px; text-align: right; }
	.sheet-hint { padding: 10px 20px 24px; font-size: 13px; color: var(--ink-3); }

	@keyframes tbIn { from { transform: translateY(4px); } to { transform: none; } }
	@keyframes tbSpin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
	:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

	/* Tablet */
	@media (max-width: 1279px) {
		.ltitle-block { max-width: 200px; }
		.segs-nav { min-width: 160px; }
	}

	/* Mobil */
	@media (max-width: 767px) {
		.top { padding: 0 12px; gap: 8px; }
		.hide-sm { display: none !important; }
		.sm-steps { display: block; }
		.segs-nav { flex: 1; min-width: 120px; }
		.segs { max-width: 100%; }
		.top-actions { gap: 4px; }
		.icon-btn { width: 32px; height: 32px; }
		.avatar { width: 28px; height: 28px; font-size: 11px; }

		.read-main { padding: 20px 16px 32px; }
		.col { gap: 14px; }
		.h1 { font-size: 22px; line-height: 28px; }
		.step-badge-row { flex-wrap: wrap; }
		.sum-head { flex-direction: column; align-items: flex-start; gap: 10px; }
		:global(.tb .sum-owl) { width: 72px; height: 64px; }
		.sum-row { font-size: 15px; }

		.work-main { flex-direction: column; padding: 12px 14px; gap: 12px; overflow-y: auto; }
		.left-col { max-width: 100%; order: 2; display: none; /* hide left col on mobile */ }
		.right-col { order: 1; }
		.ed-body { display: none; }
		.ed-body-sm { display: block; }
		.m-schema-btn { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; order: 3; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--surface); font-size: 14px; cursor: pointer; color: var(--ink-2); width: 100%; }
		.sm-only { display: flex; }

		.nav-foot { padding: 8px 14px; gap: 8px; }
		.nav-btn { height: 44px; font-size: 15px; }
		.nav-hint { display: none; }

		.donescr { padding: 24px 16px; }
		:global(.tb .done-owl) { width: 140px; height: 126px; }
		.done-btns { display: none; }
		.m-done-btns { display: flex; }
		.done-sub { display: none; }
	}

</style>
