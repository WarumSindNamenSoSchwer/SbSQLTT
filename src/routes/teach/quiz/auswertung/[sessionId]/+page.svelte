<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { apiQuizResults, type QuizResult } from '$lib/tabula/quiz-api.js';

	let dark = $state(false);
	let result = $state<QuizResult | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const sessionId = $derived(Number(page.params.sessionId));

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
			const res = await apiQuizResults(sessionId);
			result = res.result;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden.';
		} finally {
			loading = false;
		}
	}

	function fmtDate(ts: number): string {
		const d = new Date(ts * 1000);
		return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
			+ ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
	}
</script>

<svelte:head><title>Auswertung · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center"><div class="form-wrap narrow"><div class="title-block"><h1>Quiz</h1><p class="sub">Kommt in Kürze.</p></div></div></main>
	{:else if loading}
		<main class="center"><div class="spinner-wrap"><span class="spinner"></span></div></main>
	{:else if error || !result}
		<main class="center">
			<div class="form-wrap narrow">
				<p class="err">{error ?? 'Nicht gefunden.'}</p>
				<a href="/teach/quiz" class="btn-ghost">Zurück</a>
			</div>
		</main>
	{:else}
		<main class="teach-main">
			<div class="teach-content">
				<div class="page-header">
					<a href="/teach/quiz" class="btn-ghost sm">← Fragensatz</a>
					<h1 class="page-title">Auswertung: {result.quiz_title}</h1>
				</div>
				<p class="meta-line">{fmtDate(result.ended_at)} · {result.participants.length} Teilnehmer</p>

				{#if result.participants.length === 0}
					<div class="empty-state"><span class="empty-title">Keine Teilnehmer</span></div>
				{:else}
					<div class="results-table">
						<div class="results-head">
							<span class="col-rank">#</span>
							<span class="col-name">Name</span>
							<span class="col-pts">Punkte</span>
							<span class="col-correct">Richtig</span>
							<span class="col-pct">Quote</span>
						</div>
						{#each result.participants as p, i}
							<div class="results-row" class:podium={i < 3}>
								<span class="col-rank rank-badge" class:gold={i === 0} class:silver={i === 1} class:bronze={i === 2}>{i + 1}</span>
								<span class="col-name">{p.display_name}</span>
								<span class="col-pts">{p.total_points}</span>
								<span class="col-correct">{p.correct}/{p.total}</span>
								<span class="col-pct">{p.total > 0 ? Math.round(p.correct / p.total * 100) : 0} %</span>
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
	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }
	.teach-main { flex: 1; display: flex; justify-content: center; padding: 44px 40px; }
	@media (max-width: 767px) { .teach-main { padding: 20px 16px; } }
	.teach-content { width: 100%; max-width: 860px; display: flex; flex-direction: column; gap: 24px; }
	.page-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.page-title { flex: 1; font-size: 28px; font-weight: 600; letter-spacing: -0.015em; }
	.meta-line { font-size: 14px; color: var(--ink-3); }
	.err { color: var(--danger-ink); font-size: 15px; }
	.empty-state { display: flex; align-items: center; justify-content: center; border: 1px dashed var(--line-strong); border-radius: 10px; padding: 56px; }
	.empty-title { font-size: 20px; font-weight: 600; }
	.results-table { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
	.results-head, .results-row { display: grid; grid-template-columns: 48px 1fr 90px 80px 70px; padding: 12px 20px; align-items: center; gap: 12px; }
	.results-head { background: var(--subtle); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: var(--ink-3); text-transform: uppercase; border-bottom: 1px solid var(--line); }
	.results-row { border-top: 1px solid var(--line); font-size: 15px; }
	.results-row:first-of-type { border-top: none; }
	.results-row.podium { background: var(--surface); }
	.col-rank { font-weight: 700; }
	.rank-badge { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; }
	.rank-badge.gold { background: #fef08a; color: #854d0e; }
	.rank-badge.silver { background: #e2e8f0; color: #475569; }
	.rank-badge.bronze { background: #fed7aa; color: #9a3412; }
	.col-pts { font-weight: 600; color: var(--accent); }
	.col-pct { color: var(--ink-3); font-size: 13px; }
	.btn-ghost { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; }
	.btn-ghost:hover { background: var(--subtle); color: var(--ink); }
	.btn-ghost.sm { height: 34px; font-size: 13px; padding: 0 12px; }
	@media (max-width: 640px) { .results-head, .results-row { grid-template-columns: 40px 1fr 70px 60px; } .col-pct { display: none; } }
</style>
