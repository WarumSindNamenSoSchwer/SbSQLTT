<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { page } from '$app/state';
	import { apiTeacherGetClasses, type TeacherClass } from '$lib/tabula/api.js';
	import {
		apiQuizList,
		apiQuizDelete,
		apiQuizStart,
		apiQuizBankList,
		apiQuizStartFromBank,
		type QuizSet,
		type QuizBankEntry,
	} from '$lib/tabula/quiz-api.js';

	let dark = $state(false);
	let quizzes = $state<QuizSet[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busy = $state<number | null>(null);
	// Aktiver Tab
	let activeTab = $state<'auto' | 'mine'>('auto');

	// Auto-Tab
	let bank = $state<QuizBankEntry[]>([]);
	let bankLoading = $state(false);
	let bankBusy = $state<string | null>(null);  // lesson_id des laufenden Starts
	// Vorschau-Modal
	let previewEntry = $state<QuizBankEntry | null>(null);

	// Klasse (Pflicht: Quiz nur innerhalb einer Klasse)
	let classes = $state<TeacherClass[]>([]);
	let classId = $state<number | null>(null);
	async function loadClasses() {
		try {
			classes = (await apiTeacherGetClasses()).classes.filter((c) => !c.archived);
			const wanted = Number(page.url.searchParams.get('klasse'));
			classId = classes.find((c) => c.id === wanted)?.id ?? classes[0]?.id ?? null;
		} catch {
			classes = [];
		}
	}
	function needClass(): number | null {
		if (classId == null) error = 'Bitte legen Sie zuerst eine Klasse an. Ein Quiz läuft immer innerhalb einer Klasse.';
		return classId;
	}

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		if (page.url.searchParams.get('tab') === 'mine') activeTab = 'mine';
		const check = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(check, 50); return; }
			if (!session.user) { goto('/login?redirect=/teach/quiz'); return; }
			if (session.user.role !== 'teacher') { goto('/teach'); return; }
			load();
			loadBank();
			loadClasses();
		};
		check();
		return () => mo.disconnect();
	});

	async function load() {
		loading = true; error = null;
		try {
			const res = await apiQuizList();
			quizzes = res.quizzes;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden.';
		} finally {
			loading = false;
		}
	}

	async function loadBank() {
		bankLoading = true;
		try {
			bank = await apiQuizBankList();
		} catch {
			// Bank-Ladefehler still ignorieren - Fallback auf leere Liste
		} finally {
			bankLoading = false;
		}
	}

	async function startFromBank(entry: QuizBankEntry) {
		error = null;
		const cid = needClass();
		if (cid == null) return;
		bankBusy = entry.lesson_id;
		try {
			const s = await apiQuizStartFromBank(entry.lesson_id, { class_id: cid });
			goto(`/teach/quiz/live/${s.session_id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Start fehlgeschlagen.';
			bankBusy = null;
		}
	}

	async function startQuiz(q: QuizSet) {
		error = null;
		const cid = needClass();
		if (cid == null) return;
		busy = q.id;
		try {
			const s = await apiQuizStart(q.id, { class_id: cid });
			goto(`/teach/quiz/live/${s.session_id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Start fehlgeschlagen.';
			busy = null;
		}
	}

	async function deleteQuiz(q: QuizSet) {
		if (!confirm(`"${q.title}" wirklich löschen?`)) return;
		busy = q.id;
		try {
			await apiQuizDelete(q.id);
			quizzes = quizzes.filter(x => x.id !== q.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Löschen fehlgeschlagen.';
		} finally {
			busy = null;
		}
	}

	function relTime(ts: number): string {
		const s = Math.floor(Date.now() / 1000 - ts);
		if (s < 120) return 'gerade eben';
		if (s < 3600) return `vor ${Math.floor(s / 60)} min`;
		if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
		if (s < 172800) return 'gestern';
		return `vor ${Math.floor(s / 86400)} Tagen`;
	}

	function estTime(count: number): string {
		const mins = Math.round(count * 0.75);
		return `ca. ${mins} min`;
	}

	// Tastatur: Escape schliesst Modal
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') previewEntry = null;
	}
</script>

<svelte:head><title>Quiz starten · Tabula</title></svelte:head>
<svelte:window onkeydown={onKeydown} />

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center">
			<div class="form-wrap narrow">
				<div class="title-block">
					<h1>Quiz</h1>
					<p class="sub">Die Quiz-Funktion ist in Kürze verfügbar.</p>
				</div>
				<div class="notice-box" role="status">
					<span class="notice-ico">i</span>
					<span>Konten sind in Kürze freigeschaltet.</span>
				</div>
			</div>
		</main>
	{:else if session.loading}
		<main class="center"><div class="spinner-wrap"><span class="spinner"></span></div></main>
	{:else if !session.user}
		<main class="center">
			<div class="form-wrap narrow">
				<div class="title-block"><h1>Nicht angemeldet</h1></div>
				<a href="/login?redirect=/teach/quiz" class="btn-primary">Zur Anmeldung</a>
			</div>
		</main>
	{:else}
		<main class="teach-main">
			<div class="teach-content">

				<!-- Seiten-Header -->
				<div class="page-header">
					<div class="page-header-left">
						<a href="/teach" class="breadcrumb">← Klassen</a>
						<h1 class="page-title">Quiz starten</h1>
					</div>
					<button class="btn-new" onclick={() => goto('/teach/quiz/neu')}>+ Neuer Fragensatz</button>
				</div>

				{#if error}
					<div class="error-box">{error}</div>
				{/if}

				<div class="class-pick">
					<label for="quiz-class">Für Klasse</label>
					{#if classes.length > 0}
						<select id="quiz-class" bind:value={classId}>
							{#each classes as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
						</select>
						<span class="class-pick-hint">Nur Schüler dieser Klasse können mitmachen.</span>
					{:else}
						<a href="/teach/neu" class="breadcrumb">Erst eine Klasse anlegen →</a>
					{/if}
				</div>

				<!-- Tabs -->
				<div class="tabs">
					<button
						class="tab"
						class:active={activeTab === 'auto'}
						onclick={() => activeTab = 'auto'}
					>Automatisch</button>
					<button
						class="tab"
						class:active={activeTab === 'mine'}
						onclick={() => activeTab = 'mine'}
					>Meine Fragensätze</button>
				</div>

				{#if activeTab === 'auto'}

					{#if bankLoading}
						<div class="spinner-wrap"><span class="spinner"></span></div>
					{:else if bank.length === 0}
						<div class="empty-state">
							<span class="empty-title">Keine Fragensätze verfügbar</span>
							<p class="empty-body">Die automatischen Fragensätze konnten nicht geladen werden.</p>
						</div>
					{:else}
						<!-- Vorschlag-Box: erster Eintrag als Empfehlung -->
						{@const suggestion = bank[0]}
						<div class="suggestion-box">
							<Edgar pose="quiz" style="width:64px;height:58px;flex:none" />
							<div class="suggestion-info">
								<span class="suggestion-label">VORSCHLAG</span>
								<span class="suggestion-title">{suggestion.title}</span>
								<span class="suggestion-meta">{suggestion.question_count} Fragen · {estTime(suggestion.question_count)}</span>
							</div>
							<button
								class="btn-vorschau-link"
								onclick={() => previewEntry = suggestion}
							>Vorschau</button>
							<button
								class="btn-start-primary"
								disabled={bankBusy === suggestion.lesson_id}
								onclick={() => startFromBank(suggestion)}
							>{bankBusy === suggestion.lesson_id ? '…' : '▶ Starten'}</button>
						</div>

						<!-- Alle Lektionen -->
						<div class="quiz-table">
							{#each bank as entry, i (entry.lesson_id)}
								<div class="quiz-row">
									<span class="row-num">{i + 1}</span>
									<span class="row-title">{entry.title}</span>
									<span class="row-meta">{entry.question_count} Fragen · {estTime(entry.question_count)}</span>
									<button
										class="btn-row-link"
										onclick={() => previewEntry = entry}
									>Vorschau</button>
									<button
										class="btn-starten"
										disabled={bankBusy === entry.lesson_id}
										onclick={() => startFromBank(entry)}
									>{bankBusy === entry.lesson_id ? '…' : 'Starten'}</button>
								</div>
							{/each}
						</div>
					{/if}

				{:else}
					<!-- Tab "Meine Fragensätze" -->
					{#if loading}
						<div class="spinner-wrap"><span class="spinner"></span></div>
					{:else if quizzes.length === 0}
						<div class="empty-state">
							<span class="empty-title">Noch kein Fragensatz</span>
							<p class="empty-body">Erstellen Sie Ihren ersten Fragensatz und starten Sie ein Live-Quiz direkt im Unterricht.</p>
							<button class="btn-primary mt6" onclick={() => goto('/teach/quiz/neu')}>+ Neuer Fragensatz</button>
						</div>
					{:else}
						<div class="quiz-table">
							{#each quizzes as q (q.id)}
								<div class="quiz-row">
									<span class="row-num">{quizzes.indexOf(q) + 1}</span>
									<span class="row-title">{q.title}</span>
									<span class="row-meta">{q.question_count} {q.question_count === 1 ? 'Frage' : 'Fragen'} · {relTime(q.created_at)}</span>
									<button class="btn-row-link" onclick={() => goto(`/teach/quiz/${q.id}/bearbeiten`)}>Bearbeiten</button>
									<button
										class="btn-danger-link"
										onclick={() => deleteQuiz(q)}
										disabled={busy === q.id}
									>Löschen</button>
									<button
										class="btn-starten"
										onclick={() => startQuiz(q)}
										disabled={busy === q.id || q.question_count === 0}
									>{busy === q.id ? '…' : 'Starten'}</button>
								</div>
							{/each}
						</div>
					{/if}
				{/if}

			</div>
		</main>
	{/if}
</div>

<!-- Vorschau-Modal -->
{#if previewEntry}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={() => previewEntry = null}>
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Vorschau: {previewEntry.title}" tabindex="-1">
			<div class="modal-header">
				<h2 class="modal-title">{previewEntry.title}</h2>
				<button class="modal-close" onclick={() => previewEntry = null} aria-label="Schließen">✕</button>
			</div>
			<p class="modal-meta">{previewEntry.question_count} Fragen · {estTime(previewEntry.question_count)}</p>
			<p class="modal-hint">Alle Fragen sind Multiple Choice mit 20 Sekunden Antwortzeit.</p>
			<div class="modal-actions">
				<button class="btn-modal-secondary" onclick={() => previewEntry = null}>Abbrechen</button>
				<button
					class="btn-modal-primary"
					disabled={bankBusy === previewEntry.lesson_id}
					onclick={() => { const e = previewEntry!; previewEntry = null; startFromBank(e); }}
				>{bankBusy === previewEntry?.lesson_id ? '…' : '▶ Starten'}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.class-pick { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; }
	.class-pick label { font-weight: 500; }
	.class-pick select { height: 36px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font: inherit; }
	.class-pick-hint { color: var(--ink-3); font-size: 13px; }
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
	.form-wrap { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 20px; }
	.narrow { max-width: 440px; }
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	.title-block h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
	.title-block .sub { font-size: 15px; color: var(--ink-2); }
	.notice-box { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px; background: var(--accent-soft); border: 1px solid var(--accent-line); font-size: 14px; color: var(--accent-ink); }
	.notice-ico { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }
	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	/* Layout */
	.teach-main { flex: 1; display: flex; justify-content: center; padding: 36px 40px; }
	@media (max-width: 767px) { .teach-main { padding: 20px 16px; } }
	.teach-content { width: 100%; max-width: 1100px; display: flex; flex-direction: column; gap: 22px; }

	/* Header */
	.page-header { display: flex; align-items: flex-end; gap: 16px; }
	.page-header-left { flex: 1; display: flex; flex-direction: column; }
	.breadcrumb { font-size: 14px; color: var(--ink-3); text-decoration: none; }
	.breadcrumb:hover { color: var(--ink); }
	.page-title { font-size: 32px; line-height: 40px; font-weight: 600; letter-spacing: -0.01em; }
	.btn-new {
		display: inline-flex; align-items: center; height: 40px; padding: 0 16px;
		border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 15px; font-weight: 500; cursor: pointer;
	}
	.btn-new:hover { background: var(--subtle); }

	/* Error */
	.error-box { padding: 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }

	/* Tabs */
	.tabs { display: flex; gap: 28px; font-size: 15px; color: var(--ink-2); border-bottom: 1px solid var(--line); }
	.tab { padding-bottom: 10px; font-size: 15px; background: none; border: none; cursor: pointer; font-family: inherit; color: var(--ink-2); }
	.tab.active { box-shadow: 0 2px 0 var(--accent); color: var(--ink); font-weight: 500; }

	/* Vorschlag-Box */
	.suggestion-box {
		display: flex; align-items: center; gap: 18px;
		padding: 18px 20px; border-radius: 10px;
		border: 1px solid var(--accent-line); background: var(--accent-soft);
	}
	.suggestion-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
	.suggestion-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: var(--accent-ink); }
	.suggestion-title { font-size: 18px; line-height: 26px; font-weight: 600; }
	.suggestion-meta { font-size: 14px; color: var(--ink-2); }
	.btn-vorschau-link { font-size: 14px; font-weight: 500; color: var(--accent-strong); background: none; border: none; cursor: pointer; font-family: inherit; }
	.btn-start-primary {
		display: inline-flex; align-items: center; height: 44px; padding: 0 20px;
		border-radius: 6px; background: var(--accent); color: #fff;
		font-size: 15px; font-weight: 500; border: none; cursor: pointer; font-family: inherit;
	}
	.btn-start-primary:hover { background: var(--accent-strong); }

	/* Quiz-Tabelle */
	.quiz-table { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.quiz-row {
		display: flex; align-items: center; gap: 16px;
		min-height: 60px; padding: 0 20px;
		border-bottom: 1px solid var(--line);
	}
	.quiz-row:last-child { border-bottom: none; }
	.row-num { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-3); width: 24px; }
	.row-title { flex: 1; font-size: 15px; font-weight: 500; }
	.row-meta { font-size: 13px; color: var(--ink-3); width: 160px; }
	.btn-row-link { font-size: 14px; color: var(--ink-2); background: none; border: none; cursor: pointer; font-family: inherit; }
	.btn-row-link:hover { color: var(--ink); }
	.btn-danger-link { font-size: 14px; color: var(--danger-ink); background: none; border: none; cursor: pointer; font-family: inherit; }
	.btn-starten {
		display: inline-flex; align-items: center; height: 36px; padding: 0 14px;
		border-radius: 6px; border: 1px solid var(--line-strong);
		font-size: 14px; font-weight: 500; cursor: pointer; background: var(--surface);
	}
	.btn-starten:hover:not(:disabled) { background: var(--subtle); }
	.btn-starten:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Leer-Status */
	.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; border: 1px dashed var(--line-strong); border-radius: 10px; padding: 56px 40px; min-height: 240px; }
	.empty-title { font-size: 22px; font-weight: 600; }
	.empty-body { font-size: 15px; color: var(--ink-2); max-width: 440px; line-height: 24px; }
	.mt6 { margin-top: 6px; }
	.btn-primary { display: inline-flex; align-items: center; height: 38px; padding: 0 16px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; }
	.btn-primary:hover { background: var(--accent-strong); }
	.btn-start-primary:disabled { opacity: 0.6; cursor: not-allowed; }

	/* Vorschau-Modal */
	.modal-backdrop {
		position: fixed; inset: 0; z-index: 100;
		background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
		display: flex; align-items: center; justify-content: center; padding: 24px;
	}
	.modal {
		width: 100%; max-width: 440px;
		background: var(--surface); border-radius: 12px;
		border: 1px solid var(--line); padding: 28px 28px 24px;
		display: flex; flex-direction: column; gap: 12px;
	}
	.modal-header { display: flex; align-items: flex-start; gap: 12px; }
	.modal-title { flex: 1; font-size: 20px; font-weight: 600; line-height: 28px; }
	.modal-close {
		width: 28px; height: 28px; border-radius: 6px; border: none;
		background: var(--subtle); color: var(--ink-2); cursor: pointer;
		font-size: 14px; display: grid; place-items: center; flex: none;
	}
	.modal-close:hover { background: var(--line); }
	.modal-meta { font-size: 14px; color: var(--ink-2); }
	.modal-hint { font-size: 14px; color: var(--ink-3); line-height: 22px; }
	.modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 8px; }
	.btn-modal-secondary {
		height: 38px; padding: 0 16px; border-radius: 6px;
		border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
	}
	.btn-modal-secondary:hover { background: var(--subtle); }
	.btn-modal-primary {
		height: 38px; padding: 0 18px; border-radius: 6px;
		border: none; background: var(--accent); color: #fff;
		font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
	}
	.btn-modal-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-modal-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
