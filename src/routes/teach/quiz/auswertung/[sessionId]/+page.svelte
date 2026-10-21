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
		return 'Quiz · ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
			+ ' · heute, ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
	}

	// Korrekt-Quote pro Teilnehmer, Durchschnitt
	const avgCorrect = $derived(() => {
		if (!result || result.participants.length === 0) return null;
		const sum = result.participants.reduce((s, p) => s + (p.total > 0 ? p.correct / p.total : 0), 0);
		return Math.round(sum / result.participants.length * 100);
	});

	// Breite des Balken-Fortschrittsbalkens je Teilnehmer
	function barWidth(p: { correct: number; total: number }): string {
		if (p.total === 0) return '0%';
		return Math.round(p.correct / p.total * 100) + '%';
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
				<!-- Breadcrumb + Titel -->
				<div class="page-header">
					<span class="breadcrumb">Quiz · {result.quiz_title} · {fmtDate(result.ended_at).replace('Quiz · ', '').split(' · ').slice(1).join(' · ')}</span>
					<h1 class="page-title">Auswertung</h1>
					{#if avgCorrect() !== null}
						<p class="page-sub">{result.participants.length} Schüler · im Schnitt {avgCorrect()} % richtig. Schwierigste Fragen zuerst.</p>
					{/if}
				</div>

				{#if result.participants.length === 0}
					<div class="empty-state"><span class="empty-title">Keine Teilnehmer</span></div>
				{:else}
					<!-- Tabelle nach Korrektheit sortiert (schlechteste zuerst) -->
					<div class="eval-table">
						{#each result.participants
							.slice()
							.sort((a, b) => (a.total > 0 ? a.correct / a.total : 0) - (b.total > 0 ? b.correct / b.total : 0)) as p, i}
							<div class="eval-row">
								<span class="eval-num">{result.participants.indexOf(p) + 1}</span>
								<span class="eval-name">{p.display_name}</span>
								<div class="eval-bar-wrap">
									<div class="eval-bar-fill" style="width:{barWidth(p)}"></div>
								</div>
								<span class="eval-pct mono">{p.total > 0 ? Math.round(p.correct / p.total * 100) : 0} %</span>
								<span class="eval-pts">{p.total_points} Pkt.</span>
							</div>
						{/each}
					</div>
				{/if}

				<div class="footer-actions">
					<a href="/teach/quiz" class="btn-ghost">← Fragensätze</a>
				</div>
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
	.err { color: var(--danger-ink); font-size: 15px; }

	.teach-main { flex: 1; display: flex; justify-content: center; padding: 36px 40px; }
	@media (max-width: 767px) { .teach-main { padding: 20px 16px; } }
	.teach-content { width: 100%; max-width: 1100px; display: flex; flex-direction: column; gap: 20px; }

	/* Header */
	.page-header { display: flex; flex-direction: column; gap: 2px; }
	.breadcrumb { font-size: 14px; color: var(--ink-3); }
	.page-title { font-size: 32px; line-height: 40px; font-weight: 600; letter-spacing: -0.01em; }
	.page-sub { font-size: 15px; color: var(--ink-2); }

	/* Auswertungs-Tabelle */
	.eval-table {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
	}
	.eval-row {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) 260px 80px 120px;
		align-items: center;
		gap: 16px;
		min-height: 60px;
		padding: 0 20px;
		border-bottom: 1px solid var(--line);
	}
	.eval-row:last-child { border-bottom: none; }
	.eval-num { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-3); }
	.eval-name { font-size: 15px; }
	.eval-bar-wrap {
		height: 8px;
		border-radius: 999px;
		background: var(--line);
		overflow: hidden;
	}
	.eval-bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
	}
	.eval-pct { font-size: 13px; font-family: 'IBM Plex Mono', monospace; }
	.eval-pts { font-size: 14px; font-weight: 500; color: var(--accent-strong); text-align: right; }
	.mono { font-family: 'IBM Plex Mono', monospace; }

	.empty-state { display: flex; align-items: center; justify-content: center; border: 1px dashed var(--line-strong); border-radius: 10px; padding: 56px; }
	.empty-title { font-size: 20px; font-weight: 600; }

	.footer-actions { display: flex; gap: 12px; }
	.btn-ghost { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; font-weight: 500; text-decoration: none; }
	.btn-ghost:hover { background: var(--subtle); color: var(--ink); }
</style>
