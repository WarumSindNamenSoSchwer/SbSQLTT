<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import {
		apiQuizList,
		apiQuizDelete,
		apiQuizStart,
		type QuizSet,
	} from '$lib/tabula/quiz-api.js';

	let dark = $state(false);
	let quizzes = $state<QuizSet[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busy = $state<number | null>(null);
	// Aktiver Tab
	let activeTab = $state<'auto' | 'mine'>('auto');

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		const check = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(check, 50); return; }
			if (!session.user) { goto('/login?redirect=/teach/quiz'); return; }
			if (session.user.role !== 'teacher') { goto('/teach'); return; }
			load();
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

	async function startQuiz(q: QuizSet) {
		busy = q.id;
		try {
			const s = await apiQuizStart(q.id);
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
</script>

<svelte:head><title>Quiz starten · Tabula</title></svelte:head>

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
					<!-- Vorschlag-Box mit Edgar (Quiz-Pose) -->
					<div class="suggestion-box">
						<Edgar pose="quiz" style="width:64px;height:58px;flex:none" />
						<div class="suggestion-info">
							<span class="suggestion-label">VORSCHLAG ZUR FOKUS-LEKTION</span>
							<span class="suggestion-title">Tabellen verbinden mit JOIN</span>
							<span class="suggestion-meta">8 Fragen · ca. 6 min</span>
						</div>
						<button class="btn-vorschau-link">Vorschau</button>
						<button class="btn-start-primary">▶ Starten</button>
					</div>

					<!-- Liste mit allen automatischen Fragensätzen -->
					{#if loading}
						<div class="spinner-wrap"><span class="spinner"></span></div>
					{:else if quizzes.length === 0}
						<div class="empty-state">
							<span class="empty-title">Noch kein Fragensatz</span>
							<p class="empty-body">Erstellen Sie Ihren ersten Fragensatz.</p>
							<button class="btn-primary mt6" onclick={() => goto('/teach/quiz/neu')}>+ Neuer Fragensatz</button>
						</div>
					{:else}
						<div class="quiz-table">
							{#each quizzes as q (q.id)}
								<div class="quiz-row">
									<span class="row-num">{quizzes.indexOf(q) + 1}</span>
									<span class="row-title">{q.title}</span>
									<span class="row-meta">{q.question_count} {q.question_count === 1 ? 'Frage' : 'Fragen'} · {estTime(q.question_count)}</span>
									<button class="btn-row-link" onclick={() => {}}>Vorschau</button>
									<button class="btn-row-link" onclick={() => goto(`/teach/quiz/${q.id}/bearbeiten`)}>Kopieren &amp; bearbeiten</button>
									<button
										class="btn-starten"
										onclick={() => startQuiz(q)}
										disabled={busy === q.id || q.question_count === 0}
									>{busy === q.id ? '…' : 'Starten'}</button>
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

<style>
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
</style>
