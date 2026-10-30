<script lang="ts">
	// Klasse beitreten: Code -> Klasse prüfen -> Name+Passwort -> Erfolg
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

	const stepLabels = ['Code eingeben', 'Name und Passwort', 'Fertig'];
	const stepIdx = $derived(step === 'code' ? 0 : step === 'details' ? 1 : 2);
</script>

<svelte:head><title>Klasse beitreten · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="wrap">

			<!-- Hero -->
			<div class="hero">
				<Edgar pose={step === 'success' ? 'success' : step === 'details' ? 'wave' : (serverError ? 'thinking' : 'idle')} {dark} class="hero-owl" />
				<div class="hero-text">
					<p class="kicker">Für Schüler</p>
					<h1>{step === 'success' ? 'Willkommen!' : 'Klasse beitreten'}</h1>
				</div>
			</div>

			<!-- Schritt-Fortschrittsbalken -->
			<ol class="steps" aria-label="Schritte">
				{#each stepLabels as label, i}
					<li class="step" class:step-done={i < stepIdx} class:step-active={i === stepIdx}>
						<span class="step-bar"></span>
						{label}
					</li>
				{/each}
			</ol>

			{#if step === 'code'}
				<form class="card" onsubmit={lookup} novalidate>
					{#if notice}
						<div class="notice-box" role="status"><span class="notice-ico">i</span><span>Klassen sind in Kürze verfügbar. Bis dahin wird dein Fortschritt im Browser gespeichert.</span></div>
					{/if}
					{#if serverError}
						<p class="alert-err" role="alert">{serverError}</p>
					{/if}
					<div class="field">
						<label for="j-code">Klassencode</label>
						<input id="j-code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false"
							placeholder="sonne-apfel-kugel-33" disabled={busy} bind:value={code}
							style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:500;height:52px;padding:0 14px;" />
						<span class="hint">Drei Wörter und eine Zahl, getrennt mit Bindestrichen. Deine Lehrkraft zeigt den Code am Beamer.</span>
					</div>
					<button type="submit" class="btn-primary" disabled={busy || code.trim().length < 3}>{busy ? 'Suche ...' : 'Weiter'}</button>
				</form>

				<!-- QR-Hinweis -->
				<div class="info-row card">
					<svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="var(--ink-2)" stroke-width="1.4" style="flex:none" aria-hidden="true">
						<rect x="2" y="2" width="4.5" height="4.5" rx=".8"/><rect x="9.5" y="2" width="4.5" height="4.5" rx=".8"/>
						<rect x="2" y="9.5" width="4.5" height="4.5" rx=".8"/><path d="M9.5 9.5h2v2h-2zM12 12h2v2h-2z"/>
					</svg>
					<p class="info-txt"><strong>QR-Code am Beamer?</strong> Öffne die Kamera deines Handys und richte sie auf den Code. Du landest direkt im nächsten Schritt.</p>
				</div>

				<p class="foot">Schon in der Klasse? <a class="link" href="/login">Anmelden</a></p>

			{:else if step === 'details' && info}
				<form class="card" onsubmit={join} novalidate>
					<!-- Klassen-Bestätigung -->
					<div class="class-confirm">
						<div class="class-confirm-info">
							<p class="class-name">{info.class_name}</p>
							<p class="class-sub">bei {info.teacher_name} · <span class="mono">{code.trim().toLowerCase()}</span></p>
						</div>
						<button type="button" class="link-change" onclick={() => { step = 'code'; info = null; serverError = null; }}>Ändern</button>
					</div>

					{#if serverError}
						<p class="alert-err" role="alert">{serverError}</p>
					{/if}

					<div class="field">
						<label for="j-name">Dein Name</label>
						<input id="j-name" type="text" autocomplete="off" placeholder="z. B. Lena S." class:err={nameErr} disabled={busy} bind:value={name} />
						<span class="hint">So sieht dich deine Lehrkraft. Ein Vorname reicht.</span>
						{#if nameErr}<span class="hint err">Bitte gib deinen Namen ein.</span>{/if}
					</div>
					<div class="field">
						<label for="j-pw">Passwort</label>
						<input id="j-pw" type="password" autocomplete="new-password" placeholder="••••••••" class:err={pwErr} disabled={busy} bind:value={pw} />
						{#if touched}
							<div class="rules"><span class:rule-ok={pw8ok} class:rule-no={!pw8ok}>{pw8ok ? '✓' : '○'} mind. 8 Zeichen</span></div>
						{/if}
					</div>
					<div class="field">
						<label for="j-pw2">Passwort wiederholen</label>
						<input id="j-pw2" type="password" autocomplete="new-password" placeholder="••••••••" class:err={pw2Err} disabled={busy} bind:value={pw2} />
						{#if touched}
							<div class="rules"><span class:rule-ok={pwMatch} class:rule-no={!pwMatch}>{pwMatch ? '✓' : '○'} stimmt überein</span></div>
						{/if}
					</div>

					<!-- Datenschutz-Hinweis -->
					<div class="privacy-note">
						<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--ok)" stroke-width="1.6" stroke-linecap="round" style="flex:none;margin-top:1px" aria-hidden="true">
							<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>
						</svg>
						<span>Name und Passwort bleiben auf diesem Gerät. Der Server bekommt nur eine Nummer und deinen Lernfortschritt. Deinen Namen kann nur deine Lehrkraft lesen.</span>
					</div>

					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Beitreten ...' : 'Klasse beitreten'}</button>
				</form>

			{:else if step === 'success'}
				<div class="card">
					<p style="margin:0;font-size:16px;line-height:1.55">Willkommen in <strong>{info?.class_name}</strong>! Deine Lehrkraft sieht ab sofort deinen Fortschritt.</p>
					<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
						<button type="button" class="btn-primary" style="flex:1;min-width:160px" onclick={() => goto('/learn')}>Los geht's</button>
					</div>
				</div>
			{/if}

		</div>
	</main>
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; }

	.center {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: clamp(32px, 7vh, 96px) 20px 64px;
	}

	.wrap {
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		animation: tbIn .3s ease-out;
	}

	@keyframes tbIn { from { transform: translateY(6px); } to { transform: none; } }
	@media (prefers-reduced-motion: reduce) { .wrap { animation: none; } }

	/* Hero */
	.hero { display: flex; align-items: flex-end; gap: 16px; }
	:global(.hero-owl) { width: 96px; height: 86px; flex: none; display: block; }
	.hero-text { padding-bottom: 6px; }
	.kicker { margin: 0 0 4px; font-size: 14px; color: var(--ink-3); }
	h1 {
		margin: 0;
		font-size: clamp(26px, 2.2vw, 34px);
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.025em;
		text-wrap: balance;
	}

	/* Schritt-Fortschritt */
	.steps {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		gap: 6px;
	}
	.step {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
		color: var(--ink-3);
	}
	.step-bar {
		height: 4px;
		border-radius: 2px;
		background: var(--line);
		display: block;
	}
	.step-active { color: var(--accent-ink); }
	.step-active .step-bar { background: var(--accent); }
	.step-done { color: var(--ok-ink); }
	.step-done .step-bar { background: var(--ok); }

	/* Karten */
	.card {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
	}

	.alert-err {
		margin: 0;
		padding: 12px 14px;
		border-radius: 8px;
		background: var(--danger-soft);
		border: 1px solid var(--danger-line);
		color: var(--danger-ink);
		font-size: 14px;
		line-height: 1.5;
	}

	.notice-box {
		display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px;
		border: 1px solid var(--accent-line); background: var(--accent-soft);
		font-size: 14px; color: var(--accent-ink);
	}
	.notice-ico {
		width: 18px; height: 18px; flex: none; border-radius: 999px;
		background: var(--accent); color: #fff;
		display: grid; place-items: center; font-size: 11px; font-weight: 700;
	}

	/* Info-Reihe */
	.info-row { flex-direction: row; align-items: center; gap: 14px; }
	.info-txt { margin: 0; flex: 1; font-size: 14px; line-height: 1.5; color: var(--ink-2); }
	.info-txt strong { color: var(--ink); font-weight: 600; }

	/* Klassen-Bestätigung */
	.class-confirm {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 10px;
		background: var(--accent-soft);
	}
	.class-confirm-info { flex: 1; min-width: 0; }
	.class-name { margin: 0; font-size: 16px; font-weight: 600; }
	.class-sub { margin: 2px 0 0; font-size: 13px; color: var(--ink-2); }
	.mono { font-family: 'IBM Plex Mono', monospace; }
	.link-change {
		border: none; background: none; color: var(--accent-ink); font-size: 13px;
		cursor: pointer; text-decoration: underline; text-underline-offset: 3px;
		font-family: inherit;
	}
	.link-change:hover { color: var(--accent-strong); }

	/* Felder */
	.field { display: flex; flex-direction: column; gap: 6px; }
	label { font-size: 14px; font-weight: 500; }

	input[type="text"], input[type="password"] {
		height: 44px; padding: 0 12px; border-radius: 8px;
		border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 15px; font-family: inherit; color: var(--ink);
		outline: none; width: 100%; box-sizing: border-box; font-weight: 400;
	}
	input::placeholder { color: var(--ink-3); }
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input.err { border-color: var(--danger); border-width: 1.5px; }
	input:disabled { opacity: 0.6; }

	.hint { font-size: 13px; line-height: 1.4; color: var(--ink-3); }
	.hint.err { color: var(--danger-ink); }

	.rules { display: flex; gap: 14px; font-size: 13px; }
	.rule-ok { color: var(--ok-ink); }
	.rule-no { color: var(--ink-3); }

	/* Datenschutz */
	.privacy-note {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: 10px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--ink-2);
	}

	/* Buttons */
	.btn-primary {
		height: 46px; border-radius: 8px; background: var(--accent); color: #fff;
		font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; width: 100%;
		display: flex; align-items: center; justify-content: center; transition: background .15s;
		text-decoration: none;
	}
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

	.foot { font-size: 14px; color: var(--ink-2); margin: 0; }
	.link { color: var(--accent-ink); font-weight: 500; text-underline-offset: 3px; }
	.link:hover { color: var(--accent-strong); }

	@media (max-width: 480px) {
		.center { padding: 24px 16px 48px; }
		:global(.hero-owl) { width: 72px; height: 65px; }
	}
</style>
