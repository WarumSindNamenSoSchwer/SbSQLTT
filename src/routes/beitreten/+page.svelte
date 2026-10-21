<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { session } from '$lib/tabula/session.svelte.js';
	import { apiJoinClass, ApiError } from '$lib/tabula/api.js';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';

	// C4 states: enter | confirm | success | error | already
	type State = 'enter' | 'confirm' | 'success' | 'error' | 'already';

	let dark = $state(false);
	let code = $state('');
	let codeErr = $state(false);
	let busy = $state(false);
	let serverError = $state<string | null>(null);
	let className = $state('');
	let joinState = $state<State>('enter');

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		// Wenn code in URL: direkt bestätigen (nach QR-Scan)
		const urlCode = page.params.code ?? '';
		if (urlCode) {
			code = urlCode;
			joinState = 'confirm';
		}

		// Wenn nicht angemeldet und ACCOUNTS_LIVE: weiterleiten
		const checkAuth = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(checkAuth, 50); return; }
			if (!session.user) goto('/login?redirect=/beitreten');
		};
		checkAuth();

		return () => mo.disconnect();
	});

	function onInput(e: Event) {
		const val = (e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
		code = val;
		codeErr = false;
		serverError = null;
	}

	async function submitCode(e: Event) {
		e.preventDefault();
		if (code.length < 2) {
			codeErr = true;
			return;
		}

		// Wenn nicht angemeldet: zum Login weiterleiten
		if (!ACCOUNTS_LIVE || !session.user) {
			goto(`/login?redirect=/beitreten/${code}`);
			return;
		}

		joinState = 'confirm';
	}

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

	// Einzelne Zeichen des Codes als Array
	const codeChars = $derived(() => {
		const chars = code.split('');
		// Auffüllen auf 6 Zeichen
		while (chars.length < 6) chars.push('');
		return chars.slice(0, 6);
	});
</script>

<svelte:head><title>Klasse beitreten · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="card">

			{#if joinState === 'enter'}
				<!-- C3-01 / C4: Code eingeben -->
				<Edgar pose="idle" {dark} class="owl" />
				<h1>Klasse beitreten</h1>
				<p class="body">Gib den Code ein, den deine Lehrkraft zeigt.</p>

				<form onsubmit={submitCode} novalidate>
					<div class="code-boxes">
						{#each codeChars() as ch, i}
							<span class="code-box" class:err={codeErr && code.length > 0}>{ch}</span>
						{/each}
					</div>
					<input
						type="text"
						class="code-input"
						autocomplete="off"
						autocapitalize="characters"
						placeholder="z. B. ABC123"
						maxlength="8"
						disabled={busy}
						value={code}
						oninput={onInput}
					/>
					{#if codeErr}
						<p class="err-text">Bitte gib einen Code ein.</p>
					{/if}

					<div class="btn-row">
						<button type="submit" class="btn-primary" disabled={busy || code.length < 2}>
							Weiter
						</button>
					</div>
				</form>

			{:else if joinState === 'confirm'}
				<!-- C3-02: Bestätigen -->
				<Edgar pose="wave" {dark} class="owl" />
				<h1>Klasse beitreten?</h1>
				{#if session.user}
					<p class="body">Du bist angemeldet als <strong>{session.user.display_name}</strong>.</p>
				{/if}
				<div class="class-card">
					<span class="class-code-badge">{code}</span>
					<span class="class-hint">Klasse wird geladen …</span>
				</div>

				<div class="btn-row stacked">
					<button class="btn-primary" onclick={confirmJoin} disabled={busy}>
						{busy ? 'Beitreten …' : 'Beitreten'}
					</button>
					<button class="btn-secondary" onclick={() => (joinState = 'enter')} disabled={busy}>
						Abbrechen
					</button>
				</div>

			{:else if joinState === 'success'}
				<!-- C3-03: Erfolg -->
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
				<!-- C3-04: Fehler -->
				<Edgar pose="error" {dark} class="owl" />
				<h1>Klasse beitreten</h1>
				<p class="body">Gib den Code ein, den deine Lehrkraft zeigt.</p>

				<div class="code-boxes">
					{#each codeChars() as ch}
						<span class="code-box err">{ch}</span>
					{/each}
				</div>

				{#if serverError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						{serverError}
					</div>
				{/if}

				<div class="btn-row">
					<button class="btn-primary" onclick={() => { joinState = 'enter'; serverError = null; code = ''; }}>
						Erneut versuchen
					</button>
				</div>

			{:else if joinState === 'already'}
				<!-- C3-05: Schon dabei -->
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
	form { width: 100%; display: flex; flex-direction: column; gap: 12px; }
	.code-boxes { display: flex; gap: 8px; justify-content: center; margin-top: 4px; }
	.code-box { width: 44px; height: 56px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); display: grid; place-items: center; font-family: var(--mono, monospace); font-size: 24px; font-weight: 500; }
	.code-box.err { border: 1.5px solid var(--danger); }
	.code-input { height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 16px; font-family: monospace; color: var(--ink); outline: none; width: 100%; box-sizing: border-box; text-align: center; letter-spacing: 0.1em; text-transform: uppercase; }
	.code-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	.code-input:disabled { opacity: 0.6; }
	.err-text { font-size: 13px; color: var(--danger-ink); margin: 0; }
	.err-banner { width: 100%; display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--danger-line); background: var(--danger-soft); font-size: 14px; line-height: 20px; color: var(--danger-ink); text-align: left; }
	.err-ico { width: 20px; height: 20px; flex: none; border-radius: 999px; background: var(--danger); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
	.class-card { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); text-align: left; }
	.class-code-badge { font-family: monospace; font-size: 22px; font-weight: 600; letter-spacing: 0.1em; }
	.class-hint { font-size: 14px; color: var(--ink-2); }
	.class-name { font-size: 18px; font-weight: 600; }
	.btn-row { width: 100%; display: flex; flex-direction: column; gap: 10px; }
	.btn-row.stacked { gap: 10px; }
	.btn-primary { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; font-family: inherit; width: 100%; text-decoration: none; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-secondary { display: flex; align-items: center; justify-content: center; height: 44px; border-radius: 6px; font-size: 15px; font-weight: 500; color: var(--ink-2); cursor: pointer; font-family: inherit; width: 100%; }
	.btn-secondary:hover:not(:disabled) { background: var(--subtle) !important; }
</style>
