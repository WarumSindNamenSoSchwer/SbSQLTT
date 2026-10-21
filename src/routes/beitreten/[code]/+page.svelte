<script lang="ts">
	// Weiterleitung an /beitreten mit Code aus URL-Param.
	// Wird bei QR-Scans genutzt: /beitreten/ABC123 -> beitreten-Seite mit Code vorausgefüllt.
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { session } from '$lib/tabula/session.svelte.js';
	import { apiJoinClass, ApiError } from '$lib/tabula/api.js';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { goto } from '$app/navigation';

	type State = 'confirm' | 'success' | 'error' | 'already' | 'needlogin';

	let dark = $state(false);
	let busy = $state(false);
	let serverError = $state<string | null>(null);
	let className = $state('');
	let joinState = $state<State>('confirm');

	const code = $derived(page.params.code ?? '');

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		// Warten bis Session geladen, dann prüfen ob angemeldet
		const checkAuth = () => {
			if (!ACCOUNTS_LIVE) { goto('/login?redirect=/beitreten/' + page.params.code); return; }
			if (session.loading) { setTimeout(checkAuth, 50); return; }
			if (!session.user) {
				goto(`/login?redirect=/beitreten/${page.params.code}`);
			}
		};
		checkAuth();

		return () => mo.disconnect();
	});

	async function confirmJoin() {
		busy = true;
		serverError = null;
		try {
			const result = await apiJoinClass(code);
			className = result.class_name;
			joinState = 'success';
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				serverError = 'Code ungültig oder abgelaufen. Prüfe ihn noch einmal.';
				joinState = 'error';
			} else if (err instanceof ApiError && err.status === 409) {
				joinState = 'already';
			} else if (err instanceof Error) {
				serverError = err.message;
				joinState = 'error';
			}
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Klasse beitreten · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="card">

			{#if joinState === 'confirm'}
				<Edgar pose="wave" {dark} class="owl" />
				<h1>Klasse beitreten?</h1>
				{#if session.user}
					<p class="body">Du bist angemeldet als <strong>{session.user.display_name}</strong>.</p>
				{/if}
				<div class="class-card">
					<span class="class-code-badge">{code}</span>
				</div>
				<div class="btn-row">
					<button class="btn-primary" onclick={confirmJoin} disabled={busy}>
						{busy ? 'Beitreten …' : 'Beitreten'}
					</button>
					<a href="/beitreten" class="btn-secondary">Abbrechen</a>
				</div>

			{:else if joinState === 'success'}
				<Edgar pose="success" {dark} class="owl" />
				<h1>Du bist jetzt in {className || 'der Klasse'}</h1>
				<p class="body">Melde dich am PC mit demselben Konto an. Dein Fortschritt ist dort auch.</p>
				<div class="class-card">
					<span class="class-name">{className}</span>
				</div>
				<div class="btn-row">
					<a href="/learn" class="btn-primary">Zu den Lektionen</a>
				</div>

			{:else if joinState === 'error'}
				<Edgar pose="error" {dark} class="owl" />
				<h1>Code nicht gefunden</h1>
				<p class="body">{serverError ?? 'Code ungültig oder abgelaufen.'}</p>
				<div class="btn-row">
					<a href="/beitreten" class="btn-primary">Erneut versuchen</a>
				</div>

			{:else if joinState === 'already'}
				<Edgar pose="wink" {dark} class="owl" />
				<h1>Du bist schon dabei</h1>
				<p class="body">Du bist bereits in dieser Klasse.</p>
				<div class="btn-row">
					<a href="/learn" class="btn-primary">Zu den Lektionen</a>
				</div>
			{/if}

		</div>
	</main>
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; }
	.center { flex: 1; display: flex; justify-content: center; align-items: center; padding: 40px 20px 64px; }
	.card { width: 100%; max-width: 390px; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
	:global(.owl) { width: 140px; height: 126px; display: block; }
	h1 { font-size: 26px; line-height: 32px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
	.body { font-size: 15px; line-height: 23px; color: var(--ink-2); margin: 0; max-width: 300px; }
	.class-card { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); text-align: left; }
	.class-code-badge { font-family: monospace; font-size: 22px; font-weight: 600; letter-spacing: 0.1em; }
	.class-name { font-size: 18px; font-weight: 600; }
	.btn-row { width: 100%; display: flex; flex-direction: column; gap: 10px; }
	.btn-primary { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; font-family: inherit; width: 100%; text-decoration: none; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-secondary { display: flex; align-items: center; justify-content: center; height: 44px; border-radius: 6px; font-size: 15px; font-weight: 500; color: var(--ink-2); text-decoration: none; }
	.btn-secondary:hover { background: var(--subtle) !important; }
</style>
