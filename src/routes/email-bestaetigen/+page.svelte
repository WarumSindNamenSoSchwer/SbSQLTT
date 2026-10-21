<script lang="ts">
	// Bestätigung der E-Mail-Adresse (Lehrkraft, K7). Link aus der Mail: /email-bestaetigen?token=…
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { apiVerifyEmail } from '$lib/tabula/api.js';

	let dark = $state(false);
	let phase = $state<'loading' | 'ok' | 'error' | 'off'>('loading');
	let msg = $state('');

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		if (!ACCOUNTS_LIVE) {
			phase = 'off';
		} else {
			const token = page.url.searchParams.get('token') ?? '';
			if (!token) {
				phase = 'error';
				msg = 'Der Link ist unvollständig. Bitte öffnen Sie ihn direkt aus der E-Mail.';
			} else {
				apiVerifyEmail(token)
					.then(() => (phase = 'ok'))
					.catch((e) => {
						phase = 'error';
						msg = e instanceof Error ? e.message : 'Link ungültig oder abgelaufen.';
					});
			}
		}
		return () => mo.disconnect();
	});
</script>

<svelte:head><title>E-Mail bestätigen · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />
	<main class="center">
		<div class="form-wrap" aria-live="polite">
			{#if phase === 'loading'}
				<Edgar pose="loading" {dark} class="owl" />
				<div class="title-block"><h1>Einen Moment</h1><p class="sub">Ihre E-Mail-Adresse wird bestätigt.</p></div>
			{:else if phase === 'ok'}
				<Edgar pose="success" {dark} class="owl" />
				<div class="title-block"><h1>E-Mail bestätigt</h1><p class="sub">Danke. Ihr Lehrkraft-Konto ist jetzt vollständig eingerichtet.</p></div>
				<a href="/teach" class="btn-primary">Zum Lehrerbereich</a>
			{:else if phase === 'off'}
				<Edgar pose="wave" {dark} class="owl" />
				<div class="title-block"><h1>Konten kommen in Kürze</h1><p class="sub">Diese Funktion ist noch nicht freigeschaltet.</p></div>
				<a href="/" class="btn-primary">Zur Startseite</a>
			{:else}
				<Edgar pose="thinking" {dark} class="owl" />
				<div class="title-block"><h1>Das hat nicht geklappt</h1><p class="sub">{msg}</p></div>
				<p class="hint">Melden Sie sich an. Im Lehrerbereich können Sie einen neuen Bestätigungslink anfordern.</p>
				<a href="/login?redirect=/teach" class="btn-primary">Anmelden</a>
			{/if}
		</div>
	</main>
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; }
	.center { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 64px 20px 80px; }
	.form-wrap { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 18px; }
	:global(.owl) { width: 88px; height: 79px; display: block; }
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	h1 { font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
	.sub { font-size: 15px; line-height: 22px; color: var(--ink-2); margin: 0; }
	.hint { font-size: 14px; line-height: 20px; color: var(--ink-2); margin: 0; }
	.btn-primary { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 500; text-decoration: none; }
	.btn-primary:hover { background: var(--accent-strong); }
</style>
