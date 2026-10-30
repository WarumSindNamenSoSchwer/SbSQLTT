<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { apiQuizCreate } from '$lib/tabula/quiz-api.js';

	let dark = $state(false);
	let title = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		if (ACCOUNTS_LIVE && !session.loading && !session.user) goto('/login?redirect=/teach/quiz/neu');
		return () => mo.disconnect();
	});

	async function submit() {
		if (!title.trim()) { error = 'Bitte einen Titel eingeben.'; return; }
		busy = true; error = null;
		try {
			const res = await apiQuizCreate(title.trim());
			goto(`/teach/quiz/${res.quiz.id}/bearbeiten`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Erstellen fehlgeschlagen.';
			busy = false;
		}
	}
</script>

<svelte:head><title>Neuer Fragensatz · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center">
			<div class="form-wrap narrow">
				<div class="title-block"><h1>Quiz</h1><p class="sub">Kommt in Kürze.</p></div>
			</div>
		</main>
	{:else}
		<main class="center">
			<div class="form-wrap">
				<div class="title-block">
					<h1>Neuer Fragensatz</h1>
					<p class="sub">Geben Sie dem Fragensatz einen Titel, danach können Sie Fragen hinzufügen.</p>
				</div>

				{#if error}
					<div class="error-box">{error}</div>
				{/if}

				<div class="field">
					<label for="quiz-title" class="field-label">Titel</label>
					<input
						id="quiz-title"
						class="field-input"
						type="text"
						bind:value={title}
						placeholder="z. B. SQL-Grundlagen"
						maxlength="120"
						onkeydown={(e) => e.key === 'Enter' && submit()}
					/>
				</div>

				<div class="btn-row">
					<a href="/teach/quiz" class="btn-ghost">Abbrechen</a>
					<button class="btn-primary" onclick={submit} disabled={busy || !title.trim()}>
						{busy ? 'Erstelle …' : 'Erstellen'}
					</button>
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
	.error-box { padding: 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	.field-label { font-size: 14px; font-weight: 500; color: var(--ink-2); }
	.field-input { box-sizing: border-box; height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 15px; width: 100%; }
	.field-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
	.btn-row { display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; }
	.btn-primary { display: inline-flex; align-items: center; height: 44px; padding: 0 20px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-ghost { display: inline-flex; align-items: center; height: 44px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--line); color: var(--ink-2); font-size: 15px; font-weight: 500; text-decoration: none; }
	.btn-ghost:hover { background: var(--subtle); color: var(--ink); }
</style>
