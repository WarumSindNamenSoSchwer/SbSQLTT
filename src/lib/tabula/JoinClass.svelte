<script lang="ts">
	// Klasse beitreten (Klassen-Login): Code → Klasse prüfen → Name und eigenes Passwort.
	// Name und Passwort verlassen den Browser nie. Mit `initialCode` (QR-Code) ist der Code vorausgefüllt.
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { session, sessionJoinClass, sessionLogout } from '$lib/tabula/session.svelte.js';
	import { apiClassLookup, ApiError, type ClassLookup } from '$lib/tabula/api.js';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';

	let { initialCode = '' }: { initialCode?: string } = $props();

	type Step = 'code' | 'details' | 'success';
	let step = $state<Step>('code');
	let dark = $state(false);
	let code = $state('');
	let info = $state<ClassLookup | null>(null);
	let name = $state('');
	let pw = $state('');
	let pw2 = $state('');
	let touched = $state(false);
	let busy = $state(false);
	let serverError = $state<string | null>(null);
	let notice = $state(false);

	const nameErr = $derived(touched && !name.trim());
	const pwErr = $derived(touched && pw.length < 8);
	const pw2Err = $derived(touched && pw !== pw2);
	const pw8ok = $derived(pw.length >= 8);
	const pwMatch = $derived(pw.length > 0 && pw === pw2);

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		if (initialCode) {
			code = initialCode;
			void lookup();
		}
		return () => mo.disconnect();
	});

	async function lookup(e?: Event) {
		e?.preventDefault();
		serverError = null;
		if (code.trim().length < 3) {
			serverError = 'Bitte gib den Klassencode ein.';
			return;
		}
		if (!ACCOUNTS_LIVE) {
			notice = true;
			return;
		}
		busy = true;
		try {
			info = await apiClassLookup(code.trim());
			step = 'details';
		} catch (err) {
			serverError = err instanceof ApiError && err.status === 404
				? 'Diese Klasse gibt es nicht. Prüfe den Code noch einmal.'
				: err instanceof Error ? err.message : 'Fehler.';
		} finally {
			busy = false;
		}
	}

	async function join(e: Event) {
		e.preventDefault();
		touched = true;
		serverError = null;
		if (!name.trim() || pw.length < 8 || pw !== pw2) return;
		busy = true;
		try {
			// Wer am selben Rechner noch angemeldet ist (z. B. Mitschüler), wird zuerst abgemeldet
			if (session.user) await sessionLogout();
			await sessionJoinClass(code.trim(), name, pw);
			step = 'success';
		} catch (err) {
			serverError = err instanceof ApiError && err.status === 409
				? 'In dieser Klasse gibt es schon jemanden mit diesem Namen und diesem Passwort. Bitte wähle ein anderes Passwort.'
				: err instanceof Error ? err.message : 'Fehler.';
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
			{#if step === 'code'}
				<Edgar pose="idle" {dark} class="owl" />
				<h1>Klasse beitreten</h1>
				<p class="body">Gib den Klassencode ein, den deine Lehrkraft zeigt.</p>

				{#if notice}
					<div class="notice-box" role="status"><span class="notice-ico">i</span><span>Klassen sind in Kürze verfügbar. Bis dahin wird dein Fortschritt im Browser gespeichert.</span></div>
				{/if}
				{#if serverError}
					<div class="err-banner" role="alert"><span class="err-ico">!</span>{serverError}</div>
				{/if}

				<form onsubmit={lookup} novalidate>
					<input type="text" class="code-input" autocomplete="off" autocapitalize="none" spellcheck="false"
						placeholder="z. B. blau-tiger-mond-42" disabled={busy} bind:value={code} aria-label="Klassencode" />
					<button type="submit" class="btn-primary" disabled={busy || code.trim().length < 3}>{busy ? 'Suche …' : 'Weiter'}</button>
				</form>
				<p class="foot">Schon in der Klasse? <a class="link" href="/login">Anmelden</a></p>

			{:else if step === 'details' && info}
				<Edgar pose="wave" {dark} class="owl" />
				<h1>Klasse beitreten</h1>
				<div class="class-card">
					<span class="class-name">{info.class_name}</span>
					<span class="class-hint">bei {info.teacher_name}</span>
				</div>

				{#if serverError}
					<div class="err-banner" role="alert"><span class="err-ico">!</span>{serverError}</div>
				{/if}

				<form class="left" onsubmit={join} novalidate>
					<div class="field">
						<label for="j-name">Dein Name</label>
						<input id="j-name" type="text" autocomplete="off" placeholder="z. B. Lena S." class:err={nameErr} disabled={busy} bind:value={name} />
						<span class="hint">Sieht nur deine Lehrkraft. Merk dir genau, wie du ihn schreibst, du brauchst ihn zum Anmelden.</span>
						{#if nameErr}<span class="hint err-hint">Bitte gib deinen Namen ein.</span>{/if}
					</div>
					<div class="field">
						<label for="j-pw">Passwort</label>
						<input id="j-pw" type="password" autocomplete="new-password" placeholder="••••••••" class:err={pwErr} disabled={busy} bind:value={pw} />
						{#if touched}<div class="rules"><span class:ok={pw8ok} class:no={!pw8ok}>{pw8ok ? '✓' : '○'} mind. 8 Zeichen</span></div>{/if}
					</div>
					<div class="field">
						<label for="j-pw2">Passwort wiederholen</label>
						<input id="j-pw2" type="password" autocomplete="new-password" placeholder="••••••••" class:err={pw2Err} disabled={busy} bind:value={pw2} />
						{#if touched}<div class="rules"><span class:ok={pwMatch} class:no={!pwMatch}>{pwMatch ? '✓' : '○'} stimmt überein</span></div>{/if}
					</div>
					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Beitreten …' : 'Beitreten'}</button>
					<p class="privacy">Dein Name und dein Passwort verlassen diesen Rechner nicht. Tabula speichert nur eine Nummer und deinen Fortschritt, deinen Namen kann nur deine Lehrkraft lesen.</p>
				</form>
				<button type="button" class="btn-secondary" onclick={() => { step = 'code'; info = null; serverError = null; }}>Anderer Code</button>

			{:else if step === 'success'}
				<Edgar pose="success" {dark} class="owl" />
				<h1>Willkommen!</h1>
				<p class="body">Du bist jetzt in der Klasse <strong>{info?.class_name}</strong>.</p>
				<div class="class-card">
					<span class="class-hint">Zum Anmelden an einem anderen Rechner brauchst du:</span>
					<span class="class-name mono">{code.trim().toLowerCase()}</span>
					<span class="class-hint">deinen Namen und dein Passwort.</span>
				</div>
				<button type="button" class="btn-primary" onclick={() => goto('/learn')}>Los geht's</button>
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
	.body { font-size: 15px; line-height: 23px; color: var(--ink-2); margin: 0; max-width: 320px; }
	form { width: 100%; display: flex; flex-direction: column; gap: 12px; }
	form.left { text-align: left; gap: 16px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	label { font-size: 14px; font-weight: 500; }
	input { height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 15px; font-family: inherit; color: var(--ink); outline: none; width: 100%; box-sizing: border-box; }
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input.err { border-color: var(--danger); border-width: 1.5px; }
	input:disabled { opacity: 0.6; }
	.code-input { text-align: center; font-family: var(--mono, monospace); font-size: 17px; }
	.hint { font-size: 13px; line-height: 18px; color: var(--ink-3); }
	.err-hint { color: var(--danger-ink); }
	.rules { display: flex; gap: 14px; font-size: 13px; }
	.rules .ok { color: var(--ok-ink); }
	.rules .no { color: var(--ink-3); }
	.privacy { font-size: 13px; line-height: 18px; color: var(--ink-3); margin: 0; }
	.notice-box { width: 100%; display: flex; gap: 10px; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--accent-soft); font-size: 14px; line-height: 20px; color: var(--accent-ink); text-align: left; }
	.notice-ico { width: 20px; height: 20px; flex: none; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
	.err-banner { width: 100%; display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--danger-line); background: var(--danger-soft); font-size: 14px; line-height: 20px; color: var(--danger-ink); text-align: left; }
	.err-ico { width: 20px; height: 20px; flex: none; border-radius: 999px; background: var(--danger); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
	.class-card { width: 100%; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); text-align: left; }
	.class-hint { font-size: 14px; color: var(--ink-2); }
	.class-name { font-size: 18px; font-weight: 600; }
	.mono { font-family: var(--mono, monospace); }
	.btn-primary { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; font-family: inherit; width: 100%; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-secondary { display: flex; align-items: center; justify-content: center; height: 44px; border-radius: 6px; font-size: 15px; font-weight: 500; color: var(--ink-2); cursor: pointer; font-family: inherit; width: 100%; }
	.btn-secondary:hover { background: var(--subtle); }
	.foot { font-size: 14px; color: var(--ink-2); margin: 0; }
	.link { color: var(--accent-strong); font-weight: 500; }
</style>
