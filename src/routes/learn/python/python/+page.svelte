<script module lang="ts">
	// Minimale Python-Syntaxfaerbung (Stil 1:1 aus dem Design)
	type Tok = { t: string; c: string };

	const PY_KW =
		/^(import|from|as|def|class|return|if|else|elif|for|while|in|not|and|or|True|False|None|with|pass|break|continue|try|except|finally|raise|print|open|range|len|str|int|float|list|dict|set|type)$/;

	export function tokenizePy(line: string): Tok[] {
		const tokens: Tok[] = [];
		let i = 0;
		const src = line;

		while (i < src.length) {
			// Kommentar
			if (src[i] === '#') {
				tokens.push({ t: src.slice(i), c: '#64748b' });
				break;
			}
			// String mit " oder '
			if (src[i] === '"' || src[i] === "'") {
				const q = src[i];
				let j = i + 1;
				while (j < src.length && src[j] !== q) j++;
				tokens.push({ t: src.slice(i, j + 1), c: '#86efac' });
				i = j + 1;
				continue;
			}
			// Zahl
			if (/\d/.test(src[i])) {
				let j = i;
				while (j < src.length && /[\d.]/.test(src[j])) j++;
				tokens.push({ t: src.slice(i, j), c: '#fdba74' });
				i = j;
				continue;
			}
			// Bezeichner / Schlueeselwort
			if (/[A-Za-z_]/.test(src[i])) {
				let j = i;
				while (j < src.length && /[\w]/.test(src[j])) j++;
				const word = src.slice(i, j);
				tokens.push({ t: word, c: PY_KW.test(word) ? '#60a5fa' : '#e2e8f0' });
				i = j;
				continue;
			}
			// Alles andere
			tokens.push({ t: src[i], c: '#94a3b8' });
			i++;
		}
		return tokens;
	}
</script>

<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { PYTHON_STEPS, PYTHON_LESSON } from '$lib/tabula/course/l10-python';
	import { BOOKS_SEED } from '$lib/tabula/course/data';
	import { openDb, exportDb } from '$lib/tabula/sql';
	import { saveProgress } from '$lib/tabula/lessons';

	// ---------- Zustand ----------------------------------------------------------
	let cur = $state(0);
	let finished = $state(false);
	let dark = $state(false);
	let dbSizeKb = $state(0);

	// checked[stepIdx][itemIdx] = boolean
	let checked = $state<boolean[][]>(PYTHON_STEPS.map((s) => s.checklist.map(() => false)));

	// Kopieren-Toast
	let copied = $state(false);
	let copyTimer = 0;

	// Python-Installieren-Akkordeon
	let installOpen = $state(false);

	const step = $derived(PYTHON_STEPS[cur]);
	const dots = $derived(
		PYTHON_STEPS.map((_, i) => (finished || i < cur ? 'done' : i === cur ? 'cur' : 'open'))
	);
	const stepLabel = $derived(finished ? 'FERTIG' : `SCHRITT ${cur + 1} / ${PYTHON_STEPS.length}`);
	const allChecked = $derived(checked[cur].every(Boolean));
	const canNext = $derived(allChecked);

	// ---------- Hilfsfunktionen --------------------------------------------------
	function toggleCheck(stepIdx: number, itemIdx: number) {
		checked[stepIdx][itemIdx] = !checked[stepIdx][itemIdx];
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(step.code);
		} catch {
			// Fallback: kein Fehler nach oben
		}
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = window.setTimeout(() => (copied = false), 2000);
	}

	function next() {
		if (!canNext) return;
		if (cur < PYTHON_STEPS.length - 1) {
			cur += 1;
		} else {
			finished = true;
			saveProgress(PYTHON_LESSON.id, { done: true, of: PYTHON_STEPS.length });
		}
	}

	function back() {
		if (finished) {
			finished = false;
		} else if (cur > 0) {
			cur -= 1;
		}
	}

	async function download() {
		try {
			const db = await openDb(BOOKS_SEED);
			exportDb(db, 'bibliothek.db');
		} catch (e) {
			console.error('Download fehlgeschlagen', e);
		}
	}

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		// DB-Groesse berechnen
		openDb(BOOKS_SEED).then((db) => {
			const data = db.export();
			dbSizeKb = Math.round(data.byteLength / 1024);
		});

		return () => mo.disconnect();
	});
</script>

<svelte:head><title>{PYTHON_LESSON.title} · Tabula</title></svelte:head>

<div class="tb page">
	<!-- ================= Kopfleiste ================= -->
	<header class="top">
		<a class="back-link" href="/learn"><span class="arr back"></span><span class="hide-sm">Lektionen</span></a>
		<span class="sep hide-sm"></span>
		<span class="ltitle hide-sm">Lektion {PYTHON_LESSON.no}&nbsp;· {PYTHON_LESSON.title}</span>
		<div class="progress">
			<div class="dots">
				{#each dots as d}<span class="pdot {d}"></span>{/each}
			</div>
			<span class="steplbl">{stepLabel}</span>
		</div>
		<button class="chip mono hide-sm" onclick={download}>⬇ .db</button>
		<span class="avatar hide-sm">G</span>
		<span class="sm-title sm-only">L10</span>
	</header>

	{#if finished}
		<!-- ================= Lektion geschafft ================= -->
		<main class="donescr">
			<div class="done-in">
				<Edgar pose="celebrate" {dark} class="done-owl" />
				<div class="done-head">
					<span class="lbl">PYTHON & DATEN · LEKTION {PYTHON_LESSON.no} VON {PYTHON_LESSON.of}</span>
					<h1 class="h1">Lektion geschafft</h1>
					<span class="done-sub">{PYTHON_LESSON.done.sub}</span>
				</div>
				<div class="done-list">
					{#each PYTHON_LESSON.done.points as p}
						<div class="done-row"><span class="ok-dot">✓</span><span>{p}</span></div>
					{/each}
				</div>
				<div class="done-btns">
					<a class="btn-lg secondary" href="/learn">Zur Ubersicht</a>
				</div>
			</div>
		</main>
		<div class="m-done-btns">
			<a class="m-btn secondary" href="/learn">Zur Ubersicht</a>
		</div>
	{:else}
		<!-- ================= Schritt-Inhalt ================= -->
		<main class="main" data-main>
			<div class="col">
				<!-- Kopf mit Eule -->
				<div class="step-head">
					<div class="step-head-txt">
						<span class="lbl">{step.stepLabel}</span>
						<h1 class="h1">{step.title}</h1>
					</div>
					<Edgar pose="typing" {dark} class="step-owl" />
				</div>

				<!-- Intro-Text -->
				<p class="intro">{step.intro}</p>

				<!-- Download-Karte (ab Schritt 2 oder wenn downloadCard gesetzt) -->
				{#if step.downloadCard || cur >= 1}
					<div class="dl-card">
						<span class="mono dl-name">bibliothek.db <span class="dl-meta">· SQLite{dbSizeKb ? ` · ${dbSizeKb} KB` : ''}</span></span>
						<button class="btn secondary dl-btn" onclick={download}>⬇ Herunterladen</button>
					</div>
				{/if}

				<!-- Code + Ausgabe -->
				<div class="code-row">
					<!-- Codeblock (dunkel) -->
					<div class="code-block">
						<div class="cb-head">
							<span class="mono">{step.filename}</span>
							<button class="copy-btn" onclick={copyCode}>Kopieren</button>
						</div>
						<div class="cb-body">
							{#each step.code.split('\n') as line, i}
								<div class="cl">
									<span class="cn">{i + 1}</span>
									<span class="ct">{#each tokenizePy(line) as tok}<span style="color:{tok.c}">{tok.t}</span>{/each}</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Erwartete Ausgabe -->
					<div class="output-card">
						<span class="lbl output-lbl">ERWARTETE AUSGABE</span>
						<pre class="output-pre">{step.expectedOutput}</pre>
						<span class="output-note">{step.expectedNote}</span>
					</div>
				</div>

				<!-- Checkliste -->
				<div class="checklist">
					<span class="lbl checklist-lbl">CHECKLISTE</span>
					{#each step.checklist as item, idx}
						<button
							class="check-row"
							role="checkbox"
							aria-checked={checked[cur][idx]}
							onclick={() => toggleCheck(cur, idx)}
						>
							<span class="check-box" class:checked={checked[cur][idx]}>
								{#if checked[cur][idx]}<span class="check-mark">✓</span>{/if}
							</span>
							<span class="check-label">{item}</span>
						</button>
					{/each}
				</div>

				<!-- Python installieren (Akkordeon, auf allen Schritten) -->
				<div class="install-accordion">
					<button
						class="install-toggle"
						onclick={() => (installOpen = !installOpen)}
						aria-expanded={installOpen}
					>
						<span class="install-label">Python installieren</span>
						<span class="install-sub">Windows · macOS</span>
						<span class="install-arrow" class:open={installOpen}>▸</span>
					</button>
					{#if installOpen}
						<div class="install-body">
							<div class="install-section">
								<span class="install-os lbl">WINDOWS</span>
								<ol class="install-steps">
									<li>Gehe zu <span class="mono">python.org/downloads</span> und lade den Installer herunter.</li>
									<li>Starte den Installer und aktiviere <strong>Add Python to PATH</strong>.</li>
									<li>Öffne die Eingabeaufforderung (cmd) und führe aus: <span class="mono">pip install pandas matplotlib</span></li>
								</ol>
							</div>
							<div class="install-section">
								<span class="install-os lbl">MACOS</span>
								<ol class="install-steps">
									<li>Öffne das Terminal.</li>
									<li>Führe aus: <span class="mono">python3 --version</span>. Ist Python nicht installiert, erscheint ein Dialog mit dem Installer-Link.</li>
									<li>Führe aus: <span class="mono">pip3 install pandas matplotlib</span></li>
								</ol>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</main>

		<!-- ================= Fussleiste ================= -->
		<footer class="fb">
			<span class="fb-msg">{canNext ? 'Alles erledigt, du kannst weiter.' : 'Hake alles ab, dann geht es weiter.'}</span>
			<div class="fb-btns">
				<button class="btn secondary" onclick={back} disabled={cur === 0 && !finished}>
					<span class="arr back"></span><span class="hide-sm">Zurück</span>
				</button>
				{#if canNext}
					<button class="btn primary" onclick={next}>
						{cur === PYTHON_STEPS.length - 1 ? 'Lektion abschliessen' : 'Weiter'}<span class="arr"></span>
					</button>
				{:else}
					<span class="btn disabled" title="Erst alle Haken setzen">
						Weiter<span class="arr"></span>
					</span>
				{/if}
			</div>
		</footer>

		<!-- ================= Kopier-Toast ================= -->
		{#if copied}
			<div class="toast" role="status" aria-live="polite"><span class="toast-ok">✓</span>Kopiert</div>
		{/if}
	{/if}
</div>

<style>
	/* ---------- Grundgeruest (Werte 1:1 aus B3 Design) ---------- */
	.page { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; position: relative; }
	.h1 { margin: 0; font-size: 32px; line-height: 40px; font-weight: 600; letter-spacing: -0.015em; }
	.lbl { font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; color: var(--ink-3); }
	.mono { font-family: var(--mono); }

	/* Kopfleiste */
	.top { height: 56px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 20px; border-bottom: 1px solid var(--line); background: var(--surface); position: relative; z-index: 5; }
	.back-link { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 6px; font-size: 14px; font-weight: 500; color: var(--ink-2); }
	.back-link:hover { background: var(--subtle); }
	.sep { width: 1px; height: 20px; background: var(--line); }
	.ltitle { font-size: 15px; font-weight: 500; white-space: nowrap; flex: 1; }
	.progress { flex: 1; display: flex; justify-content: center; align-items: center; gap: 12px; }
	.dots { display: flex; align-items: center; gap: 6px; }
	.pdot { width: 8px; height: 8px; border-radius: 999px; background: var(--line-strong); }
	.pdot.done { background: var(--accent); }
	.pdot.cur { width: 22px; background: var(--accent); }
	.steplbl { font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; color: var(--ink-3); }
	.chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--line-strong) !important; font-size: 12px; color: var(--ink-2) !important; }
	.chip:hover { background: var(--subtle) !important; }
	.avatar { width: 32px; height: 32px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink); display: grid; place-items: center; font-size: 12px; font-weight: 600; }
	.sm-title { font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
	.sm-only { display: none; }

	/* Pfeil-Icon aus dem Design */
	.arr { display: inline-block; width: 0.9em; height: 0.9em; flex: none; vertical-align: -0.1em; background: currentColor;
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
	}
	.arr.back { transform: scaleX(-1); }

	/* Hauptinhalt */
	.main { flex: 1; min-height: 0; overflow-y: auto; display: flex; justify-content: center; padding: 40px 40px 20px; }
	.col { width: 760px; max-width: 100%; display: flex; flex-direction: column; gap: 20px; }

	/* Schritt-Kopf */
	.step-head { display: flex; align-items: flex-end; gap: 16px; }
	.step-head-txt { flex: 1; display: flex; flex-direction: column; gap: 8px; }
	:global(.tb .step-owl) { width: 96px; height: 86px; flex: none; }

	.intro { margin: 0; font-size: 16px; line-height: 26px; color: var(--ink-2); }

	/* Download-Karte */
	.dl-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.dl-name { font-size: 14px; flex: 1; }
	.dl-meta { color: var(--ink-3); font-size: 12px; }
	.dl-btn { height: 40px; padding: 0 16px !important; font-size: 14px; }

	/* Code + Ausgabe nebeneinander */
	.code-row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 14px; }

	/* Codeblock (dunkel) */
	.code-block { border-radius: 10px; background: #0f172a; overflow: hidden; }
	.cb-head { display: flex; align-items: center; padding: 8px 14px; border-bottom: 1px solid #1e293b; font-family: var(--mono); font-size: 12px; color: #94a3b8; }
	.cb-head > :first-child { flex: 1; }
	.copy-btn { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 6px; background: #1e293b !important; color: #e2e8f0 !important; font-size: 12px; font-weight: 500; }
	.copy-btn:hover { background: #334155 !important; }
	.cb-body { padding: 12px 14px; overflow-x: auto; }
	.cl { display: flex; font-family: var(--mono); font-size: 13px; line-height: 22px; }
	.cn { width: 28px; flex: none; text-align: right; padding-right: 12px; color: #64748b; user-select: none; }
	.ct { white-space: pre; }

	/* Erwartete Ausgabe */
	.output-card { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; }
	.output-lbl { padding: 8px 14px; border-bottom: 1px solid var(--line); display: block; }
	.output-pre { margin: 0; padding: 14px; font-family: var(--mono); font-size: 14px; line-height: 22px; white-space: pre-wrap; overflow-wrap: anywhere; }
	.output-note { padding: 0 14px 14px; font-size: 13px; line-height: 20px; color: var(--ink-2); }

	/* Checkliste */
	.checklist { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; }
	.checklist-lbl { display: block; padding-bottom: 6px; }
	.check-row { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 4px; border-radius: 6px; font-size: 15px; text-align: left; }
	.check-row:hover { background: var(--subtle) !important; }
	.check-box { width: 22px; height: 22px; flex: none; border-radius: 5px; border: 1.5px solid var(--line-strong); display: grid; place-items: center; }
	.check-box.checked { background: var(--accent); border-color: var(--accent); }
	.check-mark { color: #fff; font-size: 12px; font-weight: 700; line-height: 1; }
	.check-label { flex: 1; }

	/* Python-installieren-Akkordeon */
	.install-accordion { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; }
	.install-toggle { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 12px 16px !important; font-size: 15px; font-weight: 500; text-align: left; }
	.install-toggle:hover { background: var(--subtle) !important; }
	.install-label { flex: 1; }
	.install-sub { font-size: 13px; font-weight: 400; color: var(--ink-3); }
	.install-arrow { color: var(--ink-3); transition: transform 0.2s; display: inline-block; }
	.install-arrow.open { transform: rotate(90deg); }
	.install-body { padding: 16px; display: flex; flex-direction: column; gap: 16px; border-top: 1px solid var(--line); }
	.install-section { display: flex; flex-direction: column; gap: 8px; }
	.install-os { display: block; }
	.install-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 22px; }
	.install-steps .mono { font-size: 13px; background: var(--subtle); padding: 0 5px; border-radius: 4px; }

	/* Fussleiste */
	.fb { flex: none; border-top: 1px solid var(--line); background: var(--surface); padding: 12px 24px; display: flex; align-items: center; gap: 14px; min-height: 72px; }
	.fb-msg { flex: 1; font-size: 15px; font-weight: 600; }
	.fb-btns { display: flex; align-items: center; gap: 10px; }

	/* Buttons */
	.btn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px !important; border-radius: 6px; font-size: 15px; font-weight: 500; white-space: nowrap; }
	.btn.primary { background: var(--accent) !important; color: #fff !important; padding: 0 18px !important; }
	.btn.primary:hover { background: var(--accent-strong) !important; }
	.btn.secondary { border: 1px solid var(--line-strong) !important; background: var(--surface) !important; }
	.btn.secondary:hover:not(:disabled) { background: var(--subtle) !important; }
	.btn.secondary:disabled { color: var(--ink-3) !important; opacity: 0.6; }
	.btn.disabled { background: var(--subtle); color: var(--ink-3); padding: 0 18px !important; cursor: default; }

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
	.btn-lg.secondary { border: 1px solid var(--line-strong); background: var(--surface); }
	.btn-lg.secondary:hover { background: var(--subtle); }

	/* Toast */
	.toast { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 18px; border-radius: 10px; background: #0f172a; color: #fff; font-size: 14px; font-weight: 500; box-shadow: var(--shadow-pop); pointer-events: none; z-index: 40; }
	.toast-ok { color: #4ade80; }

	/* Mobil: donescr extra Buttons */
	.m-done-btns { display: none; }

	/* ---------- Tablet 768-1279 ---------- */
	@media (max-width: 1279px) {
		.top { gap: 12px; padding: 0 16px; }
		.main { padding: 28px 24px 16px; }
		.col { width: 100%; }
		.step-head { gap: 12px; }
		:global(.tb .step-owl) { width: 80px; height: 72px; }
		.h1 { font-size: 26px; line-height: 34px; }
		.code-row { grid-template-columns: 1fr; }
		.ltitle { flex: 1; }
	}

	/* ---------- Mobil < 768 ---------- */
	@media (max-width: 767px) {
		.page { font-size: 15px; line-height: 24px; }
		.top { gap: 8px; padding: 0 12px; }
		.hide-sm { display: none !important; }
		.sm-only { display: inline !important; }
		.progress { flex: 1; justify-content: center; }
		.pdot { width: 7px; height: 7px; }
		.pdot.cur { width: 18px; }
		.steplbl { letter-spacing: 0; font-size: 11px; }
		.back-link { width: 44px; height: 44px; justify-content: center; padding: 0; font-size: 18px; }

		.main { padding: 16px 16px 8px; }
		.col { gap: 14px; }
		.step-head { flex-direction: row; align-items: flex-start; gap: 10px; }
		:global(.tb .step-owl) { width: 64px; height: 58px; }
		.h1 { font-size: 22px; line-height: 28px; }
		.intro { font-size: 14px; line-height: 22px; }

		.dl-card { padding: 10px 12px; gap: 10px; }
		.dl-name { font-size: 13px; }
		.dl-btn { height: 36px; font-size: 13px; padding: 0 12px !important; }

		.code-row { grid-template-columns: 1fr; gap: 10px; }
		.cb-body { padding: 10px 12px; }
		.cl { font-size: 12px; line-height: 20px; }
		.cn { width: 22px; padding-right: 8px; }
		.output-pre { font-size: 12px; padding: 10px 12px; }
		.output-note { font-size: 12px; padding: 0 12px 12px; }

		.check-row { font-size: 14px; }
		.install-toggle { font-size: 14px; min-height: 44px; padding: 10px 14px !important; }
		.install-sub { display: none; }
		.install-steps { font-size: 13px; line-height: 21px; }

		.fb { padding: 10px 16px; gap: 10px; min-height: 60px; }
		.fb-msg { font-size: 14px; }
		.btn { height: 44px; font-size: 14px; }

		.donescr { padding: 16px; }
		.done-in { gap: 14px; }
		:global(.tb .done-owl) { width: 160px; height: 144px; }
		.done-head .lbl { font-size: 11px; }
		.donescr .h1 { font-size: 24px; line-height: 30px; }
		.done-sub { display: none; }
		.done-row { gap: 10px; padding: 10px 14px; font-size: 14px; }
		.done-btns { display: none; }
		.m-done-btns { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px 20px; border-top: 1px solid var(--line); background: var(--surface); }
		.m-btn { display: flex; align-items: center; justify-content: center; gap: 8px; height: 48px; border-radius: 6px; font-size: 16px; font-weight: 500; }
		.m-btn.secondary { border: 1px solid var(--line-strong) !important; background: var(--surface) !important; }
	}
</style>
