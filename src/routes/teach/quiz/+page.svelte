<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
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
	let busy = $state<number | null>(null); // quiz-id in Arbeit

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
</script>

<svelte:head><title>Quiz · Tabula</title></svelte:head>

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
					<span>Konten sind in Kürze freigeschaltet. Bitte versuchen Sie es später erneut.</span>
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
				<div class="page-header">
					<h1 class="page-title">Fragensätze</h1>
					<a href="/teach" class="btn-ghost">← Klassen</a>
					<button class="btn-primary" onclick={() => goto('/teach/quiz/neu')}>+ Neuer Fragensatz</button>
				</div>

				{#if error}
					<div class="error-box">{error}</div>
				{/if}

				{#if loading}
					<div class="spinner-wrap"><span class="spinner"></span></div>
				{:else if quizzes.length === 0}
					<div class="empty-state">
						<span class="empty-title">Noch kein Fragensatz</span>
						<p class="empty-body">Erstellen Sie Ihren ersten Fragensatz und starten Sie ein Live-Quiz direkt im Unterricht.</p>
						<button class="btn-primary mt6" onclick={() => goto('/teach/quiz/neu')}>+ Neuer Fragensatz</button>
					</div>
				{:else}
					<div class="quiz-list">
						{#each quizzes as q (q.id)}
							<div class="quiz-card">
								<div class="quiz-info">
									<span class="quiz-title">{q.title}</span>
									<span class="quiz-meta">{q.question_count} {q.question_count === 1 ? 'Frage' : 'Fragen'} · {relTime(q.created_at)}</span>
								</div>
								<div class="quiz-actions">
									<button
										class="btn-ghost"
										onclick={() => goto(`/teach/quiz/${q.id}/bearbeiten`)}
										disabled={busy === q.id}
									>Bearbeiten</button>
									<button
										class="btn-danger-ghost"
										onclick={() => deleteQuiz(q)}
										disabled={busy === q.id}
									>Löschen</button>
									<button
										class="btn-primary"
										onclick={() => startQuiz(q)}
										disabled={busy === q.id || q.question_count === 0}
									>
										{busy === q.id ? '…' : '▶ Starten'}
									</button>
								</div>
							</div>
						{/each}
					</div>
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
	.teach-main { flex: 1; display: flex; justify-content: center; padding: 44px 40px; }
	@media (max-width: 767px) { .teach-main { padding: 20px 16px; } }
	.teach-content { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 28px; }
	.page-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.page-title { flex: 1; font-size: 34px; font-weight: 600; letter-spacing: -0.015em; }
	.error-box { padding: 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; border: 1px dashed var(--line-strong); border-radius: 10px; padding: 56px 40px; min-height: 280px; }
	.empty-title { font-size: 22px; font-weight: 600; }
	.empty-body { font-size: 15px; color: var(--ink-2); max-width: 440px; line-height: 24px; }
	.mt6 { margin-top: 6px; }
	.quiz-list { display: flex; flex-direction: column; gap: 10px; }
	.quiz-card { display: flex; align-items: center; gap: 16px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); flex-wrap: wrap; }
	.quiz-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
	.quiz-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.quiz-meta { font-size: 13px; color: var(--ink-3); }
	.quiz-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
	.btn-primary { display: inline-flex; align-items: center; height: 38px; padding: 0 16px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-ghost { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
	.btn-ghost:hover:not(:disabled) { background: var(--subtle); color: var(--ink); }
	.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-danger-ghost { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; font-weight: 500; cursor: pointer; }
	.btn-danger-ghost:hover:not(:disabled) { background: var(--danger-soft); }
	.btn-danger-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
