<script lang="ts">
	import SiteFooter from '$lib/tabula/SiteFooter.svelte';
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';

	let dark = $state(false);
	let pin = $state('');
	let error = $state<string | null>(null);

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		// URL-PIN vorausfüllen falls schon im Pfad
		const urlPin = page.url.searchParams.get('pin');
		if (urlPin) pin = urlPin;
		return () => mo.disconnect();
	});

	function submit() {
		const clean = pin.replace(/\s/g, '').toUpperCase();
		if (!clean) { error = 'Bitte einen PIN eingeben.'; return; }
		if (!/^[A-Z0-9]{4,8}$/.test(clean)) { error = 'Ungültiger PIN.'; return; }
		goto(`/quiz/${clean}`);
	}
</script>

<svelte:head><title>Quiz beitreten · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center">
			<div class="form-wrap narrow">
				<div class="title-block">
					<h1>Quiz beitreten</h1>
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
				<div class="title-block">
					<h1>Quiz beitreten</h1>
					<p class="sub">Du musst angemeldet sein, um an einem Quiz teilzunehmen.</p>
				</div>
				<a href="/login?redirect=/quiz" class="btn-primary">Jetzt anmelden</a>
			</div>
		</main>
	{:else}
		<main class="center">
			<div class="form-wrap">
				<div class="title-block">
					<h1>Quiz beitreten</h1>
					<p class="sub">Gib den PIN ein, den dir deine Lehrkraft gezeigt hat.</p>
				</div>

				{#if error}
					<div class="error-box">{error}</div>
				{/if}

				<div class="field">
					<label for="quiz-pin" class="field-label">PIN</label>
					<input
						id="quiz-pin"
						class="field-input pin-input"
						type="text"
						bind:value={pin}
						placeholder="z. B. AB12"
						maxlength="8"
						autocomplete="off"
						autocorrect="off"
						autocapitalize="characters"
						onkeydown={(e) => e.key === 'Enter' && submit()}
					/>
				</div>

				<button class="btn-primary full" onclick={submit}>Beitreten</button>
			</div>
		</main>
	{/if}
	<SiteFooter />
</div>

<style>
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
	.form-wrap { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 20px; }
	.narrow { max-width: 440px; }
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	.title-block h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
	.title-block .sub { font-size: 15px; color: var(--ink-2); }
	.notice-box { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px; background: var(--accent-soft); border: 1px solid var(--accent-line); font-size: 14px; color: var(--accent-ink); }
	.notice-ico { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }
	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }
	.error-box { padding: 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	.field-label { font-size: 14px; font-weight: 500; color: var(--ink-2); }
	.field-input { height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 15px; width: 100%; }
	.field-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
	.pin-input { font-size: 28px; font-weight: 700; letter-spacing: 0.18em; text-align: center; height: 60px; font-family: var(--mono); }
	.btn-primary { display: inline-flex; align-items: center; justify-content: center; height: 48px; padding: 0 24px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; }
	.btn-primary:hover { background: var(--accent-strong); }
	.full { width: 100%; }
</style>
