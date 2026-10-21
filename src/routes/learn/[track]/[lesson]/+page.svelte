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
	import { openDb, run, runChecked, readSchema, explainError, compare, sqlHint, exportDb, type Result, type Schema } from '$lib/tabula/sql';

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
		<a class="back-link" href="/learn"><span class="arr back"></span><span class="hide-sm hide-md">Lektionen</span></a>
		<span class="sep hide-sm hide-md"></span>
		<span class="ltitle hide-sm"><span class="hide-md">Lektion {lesson.no}&nbsp;·{' '}</span>{lesson.title}</span>
		<div class="progress">
			<div class="dots">
				{#each dots as d}<span class="pdot {d}"></span>{/each}
			</div>
			<span class="steplbl">{stepLabel}</span>
		</div>
		<div class="md-only step-dd">
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
		<button class="chip mono hide-sm" title="Datenbank herunterladen (.db), z. B. für Python" onclick={download} disabled={!db}>⬇ .db</button>
		<span class="avatar hide-sm">G</span>
		<button class="icon44 sm-only" aria-label="Menü" onclick={() => (menu = !menu)}>⋯</button>
		{#if menu}
			<div class="dd right sm-only" role="menu">
				<button class="dd-item" onclick={() => { download(); menu = false; }}>⬇ Datenbank herunterladen (.db)</button>
				{#each lesson.steps as x, i}
					<button class="dd-item" class:on={i === cur} disabled={i > reached} onclick={() => goto(i)}>
						<span class="mk">{i === cur ? '●' : i < reached || finished ? '✓' : '○'}</span>{x.name}
					</button>
				{/each}
			</div>
		{/if}
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
	{:else}
		<div class="body" class:norail={!railOpen}>
			<!-- ================= Schritte ================= -->
			<nav class="rail" aria-label="Schritte">
				<span class="lbl rail-lbl">SCHRITTE</span>
				{#each lesson.steps as x, i}
					<button class="rstep" class:cur={i === cur} disabled={i > reached} title={i > reached ? 'Erst die Schritte davor abschließen' : undefined} onclick={() => goto(i)}>
						<span class="rmk" class:muted={i > reached}>{i === cur ? '●' : i <= reached ? '✓' : '○'}</span>
						<span class="rtxt"><span class="rname" class:open={i > reached}>{x.name}</span><span class="rtype">{x.type}</span></span>
					</button>
				{/each}
				<span class="grow"></span>
				<button class="rcollapse" onclick={() => (railOpen = false)}>« Einklappen</button>
			</nav>
			{#if !railOpen}
				<button class="rail-open" onclick={() => (railOpen = true)} aria-label="Schritte ausklappen">»</button>
			{/if}

			<div class="main" data-main>
				{#if step.kind === 'explain'}
					<div class="read" style="padding-top:56px">
						<div class="col">
							<span class="lbl">SCHRITT {cur + 1} · ERKLÄRUNG</span>
							<h1 class="h1">{step.title}</h1>
							{#each step.paras as p}<p class="para">{p}</p>{/each}
							<div class="code-card">
								<div class="cc-head"><span>BEISPIEL</span><span class="hide-sm">{lesson.db.name}</span></div>
								<div class="cc-body">
									{#each step.example.split('\n') as l, i}
										<div class="cl"><span class="cn">{i + 1}</span><span class="ct">{#each tok(l) as t}<span style="color:{t.c}">{t.t}</span>{/each}</span></div>
									{/each}
								</div>
								<div class="cc-foot"><button class="try" onclick={() => tryExample(step.example)}>Ausprobieren<span class="arr"></span></button></div>
							</div>
						</div>
					</div>
				{:else if step.kind === 'summary'}
					<div class="read" style="padding-top:48px">
						<div class="col" style="gap:22px">
							<div class="sum-head">
								<div class="sum-title">
									<span class="lbl">SCHRITT {cur + 1} · ZUSAMMENFASSUNG</span>
									<h1 class="h1">{step.title}</h1>
								</div>
								<Edgar pose="read" {dark} class="sum-owl" />
							</div>
							<div class="sum-list">
								{#each step.points as p, i}
									<div class="sum-row"><span class="sum-n">{String(i + 1).padStart(2, '0')}</span><span>{p}</span></div>
								{/each}
							</div>
							<div class="real">
								<span class="real-t">Wozu braucht man das in echt?</span>
								<span class="real-b">{step.real}</span>
							</div>
						</div>
					</div>
				{:else}
					<!-- ================= Aufgabe ================= -->
					<div class="task">
						<div class="task-txt">
							<span class="lbl task-lbl">{taskLabel}</span>
							<span class="task-t">{step.task}</span>
							<span class="task-s">{step.taskSub}</span>
						</div>
						{#if attemptLabel}<span class="attempt mono">{attemptLabel}</span>{/if}
					</div>
					<!-- mobil: Aufgabe zugeklappt nach erstem Ausfuehren -->
					<div class="m-work">
						{#if !s.ran}
							<div class="m-task">
								<span class="lbl" style="font-size:11px">{taskLabel}</span>
								<span class="m-task-t">{step.task}</span>
								<span class="task-s">{step.taskSub}</span>
							</div>
						{:else}
							<button class="m-task-c" onclick={() => (s.ran = false)}>
								<span class="lbl" style="font-size:11px">AUFGABE</span><span class="m-task-ct">{step.task}</span><span class="muted">▾</span>
							</button>
						{/if}
						<button class="m-schema" onclick={() => (sheet = true)}>
							<span class="m-schema-t">Schema</span><span class="m-schema-s mono">{schema.map((t) => t.table).join(' · ')}</span><span class="muted">↑</span>
						</button>
					</div>

					{#if dbState === 'fail'}
						<div class="dbfail">
							<div class="dbfail-in">
								<Edgar pose="sleep" {dark} style="width:150px;height:135px" />
								<span class="h2">Datenbank konnte nicht geladen werden</span>
								<span class="dbfail-s">Prüfe die Internetverbindung und versuch es noch einmal. Deine Abfrage bleibt erhalten.</span>
								<button class="btn primary" onclick={loadDb}>↻ Erneut versuchen</button>
							</div>
						</div>
					{:else}
						<div class="work">
							<!-- Schema -->
							<aside class="schema">
								<span class="lbl" style="padding-bottom:6px">SCHEMA</span>
								{#each schema as t}
									<button class="tbl mono" onclick={() => (openTables[t.table] = !openTables[t.table])} ondblclick={() => insertName(t.table)}>
										<span class="muted">{openTables[t.table] ? '▾' : '▸'}</span>{t.table}
									</button>
									{#if openTables[t.table]}
										{#each t.cols as c}
											<button class="col-row mono" onclick={() => editor?.insert(c.name)}>
												<span class="grow">{c.name}</span>
												{#if c.key}<span class="key">{c.key}</span>{/if}
												<span class="ctype">{c.type}</span>
											</button>
										{/each}
									{/if}
								{/each}
								<span class="grow"></span>
								<span class="schema-hint">Klick auf einen Namen fügt ihn in den Editor ein.</span>
							</aside>

							<div class="ide">
								<div class="editor" class:compact={resTab === 'viz' && viz}>
									<div class="ed-head mono">
										<span>query.sql</span>
										{#if badge}<span class="ed-badge">{badge}</span>{/if}
										<span class="grow"></span>
										<span class="ed-sql">SQL</span>
										<button class="m-reset" onclick={() => (dialog = 'reset')}>Zurücksetzen</button>
									</div>
									<div class="ed-body d-ed">
										<CodeEditor bind:this={editor} bind:value={s.code} errLine={s.state === 'error' ? s.errLine : null} onrun={exec} />
									</div>
									<div class="ed-body m-ed">
										<CodeEditor bind:this={mEditor} bind:value={s.code} errLine={s.state === 'error' ? s.errLine : null} onrun={exec} size="sm" minLines={6} />
									</div>
									<div class="ed-foot">
										{#if s.state === 'running'}
											<span class="run disabled">Läuft …</span>
										{:else if runLabel === 'primary'}
											<button class="run primary" onclick={exec} disabled={dbState !== 'ok'}>▶ Ausführen</button>
										{:else}
											<button class="run secondary" onclick={exec}>▶ Erneut ausführen</button>
										{/if}
										<button class="reset" onclick={() => (dialog = 'reset')}>Zurücksetzen</button>
										<span class="grow"></span>
										<span class="kbd mono">Strg / ⌘ + Enter</span>
									</div>
								</div>

								<div class="result">
									<div class="res-head">
										<div class="res-tabs" role="tablist">
											<button role="tab" class="res-tab lbl" class:on={resTab === 'result'} aria-selected={resTab === 'result'} onclick={() => (resTab = 'result')}>ERGEBNIS</button>
											<button role="tab" class="res-tab lbl" class:on={resTab === 'viz'} aria-selected={resTab === 'viz'} disabled={!viz} onclick={() => (resTab = 'viz')}>WAS PASSIERT?</button>
										</div>
										<span class="mono res-n">{s.state === 'running' ? '' : resultCount}</span>
									</div>
									{#if s.state === 'running'}
										<div class="res-empty"><span class="spin"></span>Abfrage läuft …</div>
									{:else if dbState === 'loading'}
										<div class="res-empty"><span class="spin"></span>Datenbank wird geladen …</div>
									{:else if resTab === 'viz' && viz}
										<QueryViz {viz} />
									{:else if s.result && s.state !== 'error'}
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
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<!-- ================= Feedback-Leiste ================= -->
		<footer class="fb" class:nomsg={step.kind === 'explain' || step.kind === 'summary'} data-tone={fb.tone} aria-live="polite">
			{#if fb.footOwl}
				{#key fb.owl + cur + s?.attempts}
					<Edgar pose={fb.owl} mode={fb.owlMode} {dark} class="fb-owl" />
				{/key}
			{/if}
			<span class="fb-ico" aria-hidden="true">{fb.icon}</span>
			<div class="fb-txt">
				<span class="fb-msg"><span class="m-ico" aria-hidden="true">{fb.icon}&nbsp;</span>{fb.msg}</span>
				{#if fb.sub}<span class="fb-sub">{fb.sub}</span>{/if}
				{#if fb.orig}<span class="fb-orig mono">▾ Originalfehler: {fb.orig}</span>{/if}
			</div>
			{#if step.kind === 'exercise' && s.tipOpen && s.state === 'wrong'}
				<div class="tip">
					<span class="lbl tip-lbl">EIN TIPP VON EDGAR</span>
					<span class="tip-t">{step.tip}</span>
					<button class="tip-sol" onclick={() => (dialog = 'solution')}>Lösung zeigen</button>
				</div>
			{/if}
			{#if guestHint && step.kind === 'exercise' && s.state === 'solved'}
				<span class="guest hide-sm">Melde dich an, um deinen Fortschritt zu sichern. <a href="/login" class="guest-a">Anmelden</a><button class="guest-x" aria-label="Hinweis schließen" onclick={closeGuest}>✕</button></span>
			{/if}
			<div class="fb-btns">
				{#if tipBtn}<button class="btn tipbtn" onclick={() => (s.tipOpen = true)}>Tipp anzeigen</button>{/if}
				<button class="btn secondary hide-sm" onclick={back} disabled={cur === 0}><span class="arr back"></span><span class="hide-md">Zurück</span></button>
				{#if canNext}
					<button class="btn primary hide-sm" onclick={next}>{nextLabel}<span class="arr"></span></button>
				{:else}
					<span class="btn disabled hide-sm" title="Erst nach richtiger Lösung">{nextLabel}<span class="arr"></span></span>
				{/if}
			</div>
			<!-- mobil: grosser Hauptbutton -->
			<div class="m-main">
				{#if canNext}
					<button class="m-btn primary" onclick={next}>{nextLabel}{#if step.kind !== 'summary'}<span class="arr"></span>{/if}</button>
				{:else}
					<button class="m-btn primary" onclick={exec} disabled={dbState !== 'ok' || s.state === 'running'}>{s.state === 'running' ? 'Läuft …' : '▶ Ausführen'}</button>
				{/if}
				{#if tipBtn}<button class="m-btn secondary" onclick={() => (s.tipOpen = true)}>Tipp anzeigen</button>{/if}
			</div>
		</footer>
	{/if}

	{#if finished}
		<div class="m-done-btns">
			{#if lesson.next}<a class="m-btn primary" href="/learn/{lesson.track}/{lesson.next.id}">Nächste Lektion<span class="arr"></span></a>{/if}
			<a class="m-btn secondary" href="/learn">Zur Übersicht</a>
		</div>
	{/if}

	<!-- ================= Dialoge ================= -->
	{#if dialog}
		<div class="scrim" role="presentation" onclick={() => (dialog = null)}>
			<div class="dlg" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
				{#if dialog === 'reset'}
					<span class="dlg-t">Abfrage zurücksetzen?</span>
					<span class="dlg-b">Deine Abfrage wird durch den Startcode ersetzt.</span>
					<div class="dlg-btns"><button class="btn secondary" onclick={() => (dialog = null)}>Abbrechen</button><button class="btn primary" onclick={doReset}>Zurücksetzen</button></div>
				{:else}
					<span class="dlg-t">Lösung wirklich anzeigen?</span>
					<span class="dlg-b">Die Lösung ersetzt deine Abfrage im Editor. Mit dem Tipp schaffst du es vielleicht auch selbst.</span>
					<div class="dlg-btns"><button class="btn secondary" onclick={() => (dialog = null)}>Selbst weiterprobieren</button><button class="btn primary" onclick={doSolution}>Lösung zeigen</button></div>
				{/if}
			</div>
		</div>
	{/if}

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
	/* ---------- Grundgeruest (Werte 1:1 aus Lektion B2) ---------- */
	.page { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; position: relative; }
	.grow { flex: 1; }
	.muted { color: var(--ink-3); }
	.h1 { margin: 0; font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; }
	.h2 { font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -0.01em; }

	/* Kopfleiste */
	.top { height: 56px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 20px; border-bottom: 1px solid var(--line); background: var(--surface); position: relative; z-index: 5; }
	.back-link { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 6px; font-size: 14px; font-weight: 500; color: var(--ink-2); }
	.back-link:hover { background: var(--subtle); }
	.sep { width: 1px; height: 20px; background: var(--line); }
	.ltitle { font-size: 15px; font-weight: 500; white-space: nowrap; }
	.progress { flex: 1; display: flex; justify-content: center; align-items: center; gap: 12px; }
	.dots { display: flex; align-items: center; gap: 6px; }
	.pdot { width: 8px; height: 8px; border-radius: 999px; background: var(--line-strong); }
	.pdot.done { background: var(--accent); }
	.pdot.cur { width: 22px; background: var(--accent); }
	.steplbl { font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; color: var(--ink-3); }
	.chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--line-strong) !important; font-size: 12px; color: var(--ink-2) !important; }
	.chip:hover:not(:disabled) { background: var(--subtle) !important; }
	.avatar { width: 32px; height: 32px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink); display: grid; place-items: center; font-size: 12px; font-weight: 600; }
	.icon44 { width: 44px; height: 44px; display: grid; place-items: center; font-size: 18px; color: var(--ink-2) !important; }
	.dd { position: absolute; top: 48px; z-index: 20; min-width: 240px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow-pop); padding: 6px; display: flex; flex-direction: column; }
	.dd.right { right: 8px; }
	.dd-item { display: flex; gap: 10px; align-items: center; min-height: 40px; padding: 0 10px; border-radius: 6px; font-size: 14px; }
	.dd-item:hover, .dd-item.on { background: var(--accent-soft) !important; color: var(--accent-ink) !important; }
	.dd-item .mk { width: 16px; color: var(--accent); }
	.step-dd { position: relative; }

	/* Koerper */
	.body { flex: 1; min-height: 0; display: grid; grid-template-columns: 220px minmax(0, 1fr); position: relative; }
	.body.norail { grid-template-columns: 0 minmax(0, 1fr); }
	.body.norail .rail { display: none; }
	.rail { border-right: 1px solid var(--line); background: var(--surface); padding: 20px 12px; display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow: auto; }
	.rail-lbl { padding: 0 10px 8px; }
	.rstep { display: flex; gap: 10px; padding: 8px 10px; border-radius: 6px; }
	.rstep:hover:not(.cur):not(:disabled) { background: var(--subtle) !important; }
	.rstep:disabled { cursor: not-allowed; }
	.dd-item:disabled { color: var(--ink-3); cursor: not-allowed; }
	.rstep.cur { background: var(--accent-soft) !important; }
	.rmk { width: 18px; flex: none; color: var(--accent); font-size: 13px; line-height: 22px; }
	.rmk.muted { color: var(--ink-3); }
	.rtxt { display: flex; flex-direction: column; }
	.rname { font-size: 14px; line-height: 22px; }
	.rname.open { color: var(--ink-2); }
	.rtype { font-size: 12px; line-height: 16px; color: var(--ink-3); }
	.rstep.cur .rname { font-weight: 500; color: var(--accent-ink); }
	.rstep.cur .rtype { color: var(--accent-ink); }
	.rcollapse { font-size: 13px; color: var(--ink-3) !important; padding: 0 10px !important; text-align: left; }
	.rail-open { position: absolute; left: 0; top: 20px; z-index: 3; width: 24px; height: 40px; border: 1px solid var(--line) !important; border-left: 0 !important; border-radius: 0 6px 6px 0 !important; background: var(--surface) !important; color: var(--ink-3) !important; }

	.main { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: auto; }

	/* Lesespalte */
	.read { flex: 1; display: flex; justify-content: center; padding: 56px 40px 40px; }
	.col { width: 680px; max-width: 100%; display: flex; flex-direction: column; gap: 20px; }
	.para { margin: 0; font-size: 16px; line-height: 26px; text-wrap: pretty; }
	.code-card { border-radius: 10px; background: #0f172a; overflow: hidden; }
	.cc-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid #1e293b; font-family: var(--mono); font-size: 12px; color: #64748b; }
	.cc-body { padding: 12px 0; }
	.cl { display: flex; font-family: var(--mono); font-size: 14px; line-height: 24px; }
	.cn { width: 44px; flex: none; text-align: right; padding-right: 14px; color: #64748b; }
	.ct { white-space: pre; }
	.cc-foot { display: flex; justify-content: flex-end; padding: 0 12px 12px; }
	.try { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px !important; border-radius: 6px; background: #1e293b !important; color: #e2e8f0 !important; font-size: 14px; font-weight: 500; }
	.try:hover { background: #334155 !important; }
	.sum-head { display: flex; align-items: flex-end; gap: 16px; }
	.sum-title { flex: 1; display: flex; flex-direction: column; gap: 10px; }
	:global(.tb .sum-owl) { width: 110px; height: 99px; flex: none; }
	.sum-list { display: flex; flex-direction: column; border-top: 1px solid var(--line); }
	.sum-row { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--line); font-size: 16px; line-height: 26px; text-wrap: pretty; }
	.sum-n { font-family: var(--mono); font-size: 13px; color: var(--accent-strong); width: 22px; flex: none; }
	.real { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--accent-soft); }
	.real-t { font-size: 15px; font-weight: 600; color: var(--accent-ink); }
	.real-b { font-size: 15px; line-height: 24px; text-wrap: pretty; }

	/* Aufgabe */
	.task { flex: none; padding: 16px 24px; border-bottom: 1px solid var(--line); background: var(--surface); display: flex; align-items: flex-start; gap: 24px; }
	.task-txt { flex: 1; display: flex; flex-direction: column; gap: 4px; }
	.task-t { font-size: 18px; line-height: 26px; font-weight: 600; }
	.task-s { font-size: 14px; line-height: 20px; color: var(--ink-2); }
	.attempt { font-size: 12px; color: var(--ink-3); padding-top: 2px; }

	.work { flex: 1; min-height: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); }
	.schema { border-right: 1px solid var(--line); padding: 16px; display: flex; flex-direction: column; gap: 6px; background: var(--surface); overflow: auto; }
	.tbl { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; padding: 4px 6px !important; border-radius: 6px; }
	.tbl + .tbl, .col-row + .tbl { margin-top: 6px; }
	.col-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 24px !important; border-radius: 6px; font-size: 13px; line-height: 20px; }
	.col-row:hover, .tbl:hover { background: var(--subtle) !important; }
	.key { font-size: 10px; line-height: 16px; padding: 0 5px; border-radius: 4px; background: var(--accent-soft); color: var(--accent-ink); }
	.ctype { color: var(--ink-3); font-size: 12px; }
	.schema-hint { font-size: 12px; line-height: 18px; color: var(--ink-3); }

	.ide { min-width: 0; min-height: 0; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
	.editor { flex: none; border-radius: 10px; background: #0f172a; overflow: hidden; display: flex; flex-direction: column; }
	.ed-head { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #1e293b; font-size: 12px; color: #94a3b8; }
	.ed-badge { padding: 1px 8px; border-radius: 999px; background: #1e3a8a; color: #bfdbfe; font-size: 11px; line-height: 18px; }
	.ed-sql { color: #64748b; }
	.m-reset { display: none; color: #94a3b8 !important; font-size: 11px; }
	.ed-body { height: 236px; transition: height 0.25s ease; }
	.editor.compact .d-ed { height: 128px; }
	.m-ed { display: none; }
	.ed-foot { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid #1e293b; }
	.run { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px !important; border-radius: 6px; font-size: 14px; font-weight: 500; }
	.run.primary { background: var(--accent) !important; color: #fff !important; }
	.run.primary:hover:not(:disabled) { background: var(--accent-strong) !important; }
	.run.primary:disabled { opacity: 0.6; }
	.run.secondary { border: 1px solid #334155 !important; color: #e2e8f0 !important; }
	.run.secondary:hover { background: #1e293b !important; }
	.run.disabled { background: #334155; color: #94a3b8; }
	.reset { display: inline-flex; align-items: center; height: 36px; padding: 0 10px !important; color: #94a3b8 !important; font-size: 14px; }
	.reset:hover { color: #e2e8f0 !important; }
	.kbd { font-size: 12px; color: #64748b; }

	.result { flex: 1; min-height: 140px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; display: flex; flex-direction: column; }
	.res-head { flex: none; display: flex; justify-content: space-between; align-items: center; padding: 0 16px; border-bottom: 1px solid var(--line); }
	.res-tabs { display: flex; gap: 18px; }
	.res-tab { padding: 10px 0 !important; border-bottom: 2px solid transparent !important; margin-bottom: -1px; }
	.res-tab.on { color: var(--ink) !important; border-bottom-color: var(--accent) !important; }
	.res-tab:disabled { opacity: 0.45; }
	.res-tab:not(:disabled):not(.on):hover { color: var(--ink-2) !important; }
	.res-n { font-size: 12px; color: var(--ink-3); }
	.res-empty { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; text-align: center; font-size: 14px; color: var(--ink-3); }
	.spin { width: 16px; height: 16px; border-radius: 999px; border: 2px solid var(--line-strong); border-top-color: var(--accent); animation: tb-spin 0.9s linear infinite; }
	.res-table { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
	.res-row { display: grid; border-bottom: 1px solid var(--line); min-width: max-content; }
	.res-row > span { padding: 8px 16px; font-size: 14px; line-height: 20px; }
	.res-row > span:first-child { position: sticky; left: 0; background: var(--surface); }
	.res-hd { background: var(--subtle); position: sticky; top: 0; z-index: 1; }
	.res-hd > span { font-size: 12px; letter-spacing: 0.06em; color: var(--ink-3); }
	.res-hd > span:first-child { background: var(--subtle); }
	.res-more { padding: 8px 16px; font-size: 13px; color: var(--ink-3); }

	.dbfail { flex: 1; display: grid; place-items: center; padding: 32px; }
	.dbfail-in { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; max-width: 420px; }
	.dbfail-s { font-size: 15px; line-height: 24px; color: var(--ink-2); }

	/* Feedback-Leiste */
	.fb { flex: none; border-top: 1px solid var(--fb-line); background: var(--fb-bg); padding: 12px 24px; display: flex; align-items: center; gap: 14px; min-height: 76px; }
	:global(.tb .fb-owl) { width: 52px; height: 47px; flex: none; }
	.fb-ico { width: 24px; height: 24px; flex: none; border-radius: 999px; display: grid; place-items: center; background: var(--fb-ico-bg); color: var(--fb-ico); font-size: 13px; font-weight: 600; line-height: 1; }
	.fb-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
	.fb-msg { font-size: 15px; line-height: 22px; font-weight: 600; color: var(--fb-ink); }
	.m-ico { display: none; }
	.fb-sub { font-size: 14px; line-height: 20px; color: var(--ink-2); }
	.fb-orig { font-size: 12px; color: var(--ink-3); }
	.tip { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--surface); width: 460px; flex: none; }
	.tip-lbl { color: var(--accent-ink); }
	.tip-t { font-size: 14px; line-height: 20px; }
	.tip-sol { align-self: flex-start; font-size: 14px; font-weight: 500; color: var(--accent-strong) !important; text-decoration: underline; text-underline-offset: 3px; }
	.guest { display: inline-flex; align-items: center; gap: 10px; height: 36px; padding: 0 6px 0 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); font-size: 13px; color: var(--ink-2); white-space: nowrap; }
	.guest-a { color: var(--accent-strong) !important; font-weight: 500; }
	.guest-x { width: 24px; text-align: center !important; color: var(--ink-3) !important; }
	.fb-btns { display: flex; align-items: center; gap: 14px; }
	.skip { font-size: 14px; color: var(--ink-3) !important; padding: 0 4px !important; }
	.skip:hover { color: var(--ink-2) !important; }
	.btn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px !important; border-radius: 6px; font-size: 15px; font-weight: 500; white-space: nowrap; }
	.btn.primary { padding: 0 18px !important; background: var(--accent) !important; color: #fff !important; }
	.btn.primary:hover { background: var(--accent-strong) !important; }
	.btn.secondary { border: 1px solid var(--line-strong) !important; background: var(--surface) !important; }
	.btn.secondary:hover:not(:disabled) { background: var(--subtle) !important; }
	.btn.secondary:disabled { color: var(--ink-3) !important; }
	.btn.disabled { padding: 0 18px !important; background: var(--subtle); color: var(--ink-3); }
	.btn.tipbtn { border: 1px solid var(--accent-line) !important; background: var(--surface) !important; color: var(--accent-ink) !important; }
	.m-main, .m-done-btns { display: none; }

	/* Lektion geschafft */
	.donescr { flex: 1; display: grid; place-items: center; padding: 40px; overflow: auto; }
	.done-in { width: 600px; max-width: 100%; display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center; }
	:global(.tb .done-owl) { width: 200px; height: 180px; }
	.done-head { display: flex; flex-direction: column; gap: 8px; align-items: center; }
	.done-sub { font-size: 16px; color: var(--ink-2); }
	.done-list { width: 100%; display: flex; flex-direction: column; text-align: left; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.done-row { display: flex; gap: 12px; align-items: flex-start; padding: 14px 18px; border-bottom: 1px solid var(--line); font-size: 15px; line-height: 24px; }
	.done-row:last-child { border-bottom: 0; }
	.ok-dot { width: 22px; height: 22px; flex: none; border-radius: 999px; background: var(--ok-soft); color: var(--ok-ink); display: grid; place-items: center; font-size: 12px; font-weight: 600; margin-top: 1px; line-height: 1; }
	.done-btns { display: flex; gap: 10px; }
	.btn-lg { display: inline-flex; align-items: center; gap: 8px; height: 48px; padding: 0 22px; border-radius: 6px; font-size: 16px; font-weight: 500; white-space: nowrap; }
	.btn-lg.primary { background: var(--accent); color: #fff !important; }
	.btn-lg.primary:hover { background: var(--accent-strong); }
	.btn-lg.secondary { border: 1px solid var(--line-strong); background: var(--surface); }

	/* Dialoge */
	.scrim { position: absolute; inset: 0; background: rgb(15 23 42 / 0.5); display: grid; place-items: center; z-index: 30; }
	.dlg { width: 440px; max-width: calc(100% - 80px); display: flex; flex-direction: column; gap: 12px; padding: 24px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-pop); }
	.dlg-t { font-size: 18px; line-height: 26px; font-weight: 600; }
	.dlg-b { font-size: 15px; line-height: 24px; color: var(--ink-2); }
	.dlg-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
	.sheet-scrim { background: rgb(15 23 42 / 0.45); }
	.sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 520px; max-height: 80%; z-index: 31; display: flex; flex-direction: column; background: var(--surface); border-radius: 16px 16px 0 0; box-shadow: var(--shadow-pop); }
	.grab { display: flex; justify-content: center; padding: 10px 0 4px; }
	.grab span { width: 40px; height: 4px; border-radius: 999px; background: var(--line-strong); }
	.sheet-head { display: flex; align-items: center; padding: 4px 8px 8px 20px; }
	.sheet-t { flex: 1; font-size: 18px; font-weight: 600; }
	.sheet-body { flex: 1; overflow: auto; padding: 0 12px; display: flex; flex-direction: column; }
	.s-tbl { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px !important; font-size: 15px; font-weight: 500; }
	.s-tbl.bt { border-top: 1px solid var(--line) !important; }
	.s-col { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px 0 30px !important; border-top: 1px solid var(--line) !important; font-size: 14px; }
	.s-ins { color: var(--accent-strong); font-family: var(--sans); font-size: 13px; font-weight: 500; width: 52px; text-align: right; }
	.sheet-hint { padding: 10px 20px 24px; font-size: 13px; color: var(--ink-3); }

	.m-work, .md-only, .sm-only { display: none; }

	/* ---------- Tablet 768–1279 (Frame T-04) ---------- */
	@media (max-width: 1279px) {
		.top { gap: 12px; padding: 0 16px; }
		.hide-md { display: none; }
		.progress { display: none; }
		.md-only { display: block; }
		.ltitle { flex: 1; }
		.rail, .rail-open { display: none; }
		.body, .body.norail { grid-template-columns: minmax(0, 1fr); }
		.task { padding: 12px 20px; }
		.task-lbl { font-size: 11px; }
		.task-t { font-size: 17px; line-height: 24px; }
		.work { grid-template-columns: 190px minmax(0, 1fr); }
		.schema { padding: 12px; gap: 4px; }
		.tbl { font-size: 13px; padding: 4px !important; }
		.col-row { font-size: 12px; padding: 3px 4px 3px 18px !important; }
		.col-row .key { display: none; }
		.ctype { font-size: 11px; }
		.ide { padding: 12px 16px; gap: 12px; }
		.ed-head { padding: 8px 14px; font-size: 11px; }
		.ed-body { height: 132px; }
		.ed-foot { padding: 8px 10px; }
		.run { height: 40px; }
		.kbd, .ed-sql { display: none; }
		.fb { padding: 10px 16px; gap: 12px; min-height: 68px; }
		:global(.tb .fb-owl) { width: 44px; height: 40px; }
		.fb-ico { width: 22px; height: 22px; font-size: 12px; }
		.fb-sub { font-size: 13px; }
		.btn { height: 44px; }
		.tip { width: 360px; }
		.guest { display: none; }
		.skip, .schema-hint { display: none; }
	}

	/* ---------- Mobil < 768 (Frames M-*) ---------- */
	@media (max-width: 767px) {
		.page { font-size: 15px; line-height: 24px; }
		.top { gap: 4px; padding: 0 6px; }
		.hide-sm { display: none !important; }
		.md-only { display: none; }
		.sm-only { display: grid; }
		.dd.sm-only { display: flex; }
		.progress { display: flex; gap: 10px; }
		.dots { gap: 5px; }
		.pdot { width: 7px; height: 7px; }
		.pdot.cur { width: 18px; }
		.steplbl { letter-spacing: 0; }
		.back-link { width: 44px; height: 44px; justify-content: center; padding: 0; font-size: 18px; }
		.main { padding: 14px 16px; gap: 12px; }
		.read { padding: 0 !important; }
		.col { gap: 12px; }
		.col .lbl { font-size: 11px; margin-top: 8px; }
		.h1 { font-size: 26px; line-height: 32px; letter-spacing: -0.01em; }
		.para { font-size: 15px; line-height: 24px; }
		.cc-head { display: none; }
		.cc-body { padding: 10px 0; }
		.cl { font-size: 13px; line-height: 22px; }
		.cn { width: 32px; padding-right: 10px; color: #475569; }
		.cc-foot { padding: 0 10px 10px; }
		.try { height: 44px; padding: 0 14px !important; }
		.sum-head { gap: 10px; }
		:global(.tb .sum-owl) { width: 76px; height: 68px; }
		.sum-row { gap: 10px; padding: 10px 0; font-size: 14px; line-height: 21px; }
		.sum-n { font-size: 12px; width: 18px; }
		.real { padding: 12px 14px; gap: 4px; }
		.real-t, .real-b { font-size: 14px; line-height: 21px; }

		.task { display: none; }
		.m-work { display: flex; flex-direction: column; gap: 12px; flex: none; }
		.m-task { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
		.m-task-t { font-size: 16px; line-height: 23px; font-weight: 600; }
		.m-task-c, .m-schema { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 14px !important; border: 1px solid var(--line) !important; border-radius: 10px; background: var(--surface) !important; }
		.m-task-ct { flex: 1; min-width: 0; font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
		.m-schema { border-color: var(--line-strong) !important; border-radius: 6px; }
		.m-schema-t { font-size: 14px; font-weight: 500; }
		.m-schema-s { flex: 1; font-size: 12px; color: var(--ink-3); }
		.work { display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; }
		.schema { display: none; }
		.ide { padding: 0; gap: 12px; flex: 1; min-height: 0; }
		.ed-head { padding: 8px 12px; font-size: 11px; gap: 8px; }
		.ed-badge, .ed-sql { display: none; }
		.m-reset { display: inline; }
		.d-ed { display: none; }
		.m-ed { display: block; height: 164px; }
		.ed-foot { display: none; }
		.result { min-height: 120px; }
		.res-head { padding: 0 12px; }
		.res-tab { padding: 8px 0 !important; }
		.res-head .lbl, .res-n { font-size: 11px; }
		.res-row > span { padding: 7px 12px; font-size: 13px; line-height: 18px; }
		.res-hd > span { padding: 6px 12px; font-size: 11px; letter-spacing: 0; }

		.fb { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 16px 20px; min-height: 0; flex-wrap: nowrap; position: relative; }
		.fb { display: grid; grid-template-columns: 42px minmax(0, 1fr); column-gap: 10px; row-gap: 10px; align-items: center; }
		:global(.tb .fb-owl) { width: 42px; height: 38px; grid-column: 1; }
		.fb-ico { display: none; }
		.fb-txt { grid-column: 2; gap: 0; }
		.m-ico { display: inline; }
		.fb-msg { font-size: 15px; line-height: 21px; }
		.fb-sub { font-size: 13px; line-height: 19px; }
		.tip { grid-column: 1 / -1; width: auto; padding: 10px 12px; }
		.tip-lbl { font-size: 11px; }
		.tip-sol { min-height: 28px; }
		.fb-btns { display: none; }
		.m-main { display: flex; flex-direction: column; gap: 10px; grid-column: 1 / -1; }
		.m-btn { display: flex; align-items: center; justify-content: center; gap: 8px; height: 48px; border-radius: 6px; font-size: 16px; font-weight: 500; }
		.m-btn.primary { background: var(--accent) !important; color: #fff !important; }
		.m-btn.primary:disabled { opacity: 0.6; }
		.m-btn.secondary { border: 1px solid var(--line-strong) !important; background: var(--surface) !important; }
		.fb[data-tone] > :global(.fb-owl:only-child) { display: none; }

		.fb.nomsg > :global(.fb-owl), .fb.nomsg .fb-txt { display: none; }
		.fb-orig { display: none; }
		.donescr { padding: 14px 16px; }
		.done-in { gap: 14px; }
		:global(.tb .done-owl) { width: 170px; height: 153px; }
		.done-head .lbl { font-size: 11px; }
		.donescr .h1 { font-size: 28px; line-height: 34px; }
		.done-sub { display: none; }
		.done-row { gap: 10px; padding: 10px 12px; font-size: 14px; line-height: 21px; }
		.ok-dot { background: none; width: auto; height: auto; }
		.done-btns { display: none; }
		.m-done-btns { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px 20px; border-top: 1px solid var(--line); background: var(--surface); }
	}
</style>
