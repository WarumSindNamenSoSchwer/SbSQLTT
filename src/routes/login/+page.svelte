<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import {
		session,
		sessionLogin,
		sessionRegisterTeacher,
		sessionClassLogin,
		sessionClassReset,
	} from '$lib/tabula/session.svelte.js';
	import { apiPasswordForgot, ApiError } from '$lib/tabula/api.js';

	// ---- Theme ---------------------------------------------------------------
	let dark = $state(false);
	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		const r = page.url.searchParams.get('redirect') ?? '';
		_redirect = /^\/(?![\/\\])[^\s]*$/.test(r) ? r : '';
		const c = page.url.searchParams.get('code');
		if (c) loginCode = c;
		if (page.url.searchParams.get('rolle') === 'lehrkraft') seg = 1;
		return () => mo.disconnect();
	});

	let _redirect = $state('');

	let _checkedExisting = false;
	$effect(() => {
		if (_checkedExisting || session.loading) return;
		_checkedExisting = true;
		const u = session.user;
		if (!u || page.url.searchParams.has('token')) return;
		if (u.role === 'teacher') goto(session.needsKeyRecovery ? '/profil?schluessel=1' : (_redirect || '/teach'), { replaceState: true });
		else goto(_redirect || '/learn', { replaceState: true });
	});

	// ---- View state ----------------------------------------------------------
	type View = 'login' | 'register' | 'recovery' | 'forgot' | 'forgot-sent' | 'student-reset';
	let view = $state<View>('login');
	/** 0 = Schüler (Klassen-Login), 1 = Lehrkraft */
	let seg = $state<0 | 1>(0);

	let busy = $state(false);
	let serverError = $state<string | null>(null);
	let showNotice = $state(false);
	let touched = $state(false);

	// ---- Schüler: Klassen-Login ---------------------------------------------
	let loginCode = $state('');
	let loginName = $state('');
	let loginPw = $state('');
	let loginError = $state(false);

	// ---- Schüler: Passwort vergessen (Einmal-Code der Lehrkraft) -------------
	let resetCode = $state('');
	let resetPw = $state('');
	let resetPw2 = $state('');

	// ---- Lehrkraft: Anmelden --------------------------------------------------
	let tEmail = $state('');
	let tPw = $state('');

	// ---- Lehrkraft: Registrieren ----------------------------------------------
	let regName = $state('');
	let regEmail = $state('');
	let regLPw = $state('');
	let regLPwRepeat = $state('');
	let regSchoolOpt = $state('');
	let regAccepted = $state(false);

	// ---- Wiederherstellungscode nach der Registrierung -----------------------
	let recoveryCode = $state('');
	let recoveryNoted = $state(false);
	let copied = $state(false);

	// ---- Passwort vergessen (Lehrkraft) ---------------------------------------
	let forgotEmail = $state('');

	// ---- Validierung ----------------------------------------------------------
	const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

	const codeErr = $derived(touched && loginCode.trim().length < 3);
	const nameErr = $derived(touched && !loginName.trim());
	const pwErr = $derived(touched && !loginPw);
	const tEmailErr = $derived(touched && !validEmail(tEmail));
	const tPwErr = $derived(touched && !tPw);

	const resetCodeErr = $derived(touched && resetCode.trim().length < 6);
	const resetPwErr = $derived(touched && resetPw.length < 8);
	const resetPw2Err = $derived(touched && resetPw !== resetPw2);

	const regNameErr = $derived(touched && !regName.trim());
	const regEmailErr = $derived(touched && !validEmail(regEmail));
	const regLPwErr = $derived(touched && regLPw.length < 8);
	const regLPwRepeatErr = $derived(touched && regLPw !== regLPwRepeat);
	const regAcceptedErr = $derived(touched && !regAccepted);
	const lpw8ok = $derived(regLPw.length >= 8);
	const lpwHasNum = $derived(/\d/.test(regLPw));

	const forgotEmailErr = $derived(touched && !validEmail(forgotEmail));

	function fail(err: unknown) {
		if (err instanceof Error) serverError = err.message;
	}

	// ---- Handler ---------------------------------------------------------------
	async function submitStudentLogin(e: Event) {
		e.preventDefault();
		touched = true;
		loginError = false;
		serverError = null;
		if (loginCode.trim().length < 3 || !loginName.trim() || !loginPw) return;
		if (!ACCOUNTS_LIVE) { showNotice = true; return; }
		busy = true;
		try {
			await sessionClassLogin(loginCode.trim(), loginName, loginPw);
			goto(_redirect || '/learn');
		} catch (err) {
			if (err instanceof ApiError && (err.status === 401 || err.status === 404)) loginError = true;
			else fail(err);
		} finally {
			busy = false;
		}
	}

	async function submitStudentReset(e: Event) {
		e.preventDefault();
		touched = true;
		serverError = null;
		if (loginCode.trim().length < 3 || !loginName.trim() || resetCode.trim().length < 6 || resetPw.length < 8 || resetPw !== resetPw2) return;
		if (!ACCOUNTS_LIVE) { showNotice = true; return; }
		busy = true;
		try {
			await sessionClassReset(loginCode.trim(), loginName, resetCode, resetPw);
			goto(_redirect || '/learn');
		} catch (err) {
			fail(err);
		} finally {
			busy = false;
		}
	}

	async function submitTeacherLogin(e: Event) {
		e.preventDefault();
		touched = true;
		loginError = false;
		serverError = null;
		if (!validEmail(tEmail) || !tPw) return;
		if (!ACCOUNTS_LIVE) { showNotice = true; return; }
		busy = true;
		try {
			await sessionLogin(tEmail.trim(), tPw);
			goto(session.needsKeyRecovery ? '/profil?schluessel=1' : (_redirect || '/teach'));
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) loginError = true;
			else fail(err);
		} finally {
			busy = false;
		}
	}

	async function submitRegister(e: Event) {
		e.preventDefault();
		touched = true;
		serverError = null;
		if (!regName.trim() || !validEmail(regEmail) || regLPw.length < 8 || regLPw !== regLPwRepeat || !regAccepted) return;
		if (!ACCOUNTS_LIVE) { showNotice = true; return; }
		busy = true;
		try {
			recoveryCode = await sessionRegisterTeacher({
				display_name: regName.trim(),
				name: regName.trim(),
				email: regEmail.trim(),
				password: regLPw,
				school: regSchoolOpt.trim() || undefined,
			});
			view = 'recovery';
		} catch (err) {
			fail(err);
		} finally {
			busy = false;
		}
	}

	async function copyRecovery() {
		try {
			await navigator.clipboard.writeText(recoveryCode);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* Kopieren nicht erlaubt: Code steht ja da */
		}
	}

	async function submitForgot(e: Event) {
		e.preventDefault();
		touched = true;
		serverError = null;
		if (!validEmail(forgotEmail)) return;
		if (!ACCOUNTS_LIVE) { view = 'forgot-sent'; return; }
		busy = true;
		try {
			await apiPasswordForgot(forgotEmail.trim());
			view = 'forgot-sent';
		} catch (err) {
			fail(err);
		} finally {
			busy = false;
		}
	}

	function go(v: View) {
		view = v;
		touched = false;
		loginError = false;
		showNotice = false;
		serverError = null;
	}

	function switchSeg(s: 0 | 1) {
		seg = s;
		go('login');
	}

	// Metadaten je View/Seg
	type Meta = { kicker: string; title: string; pose: string };
	const meta = $derived((): Meta => {
		if (view === 'recovery') return { kicker: 'Für Lehrkräfte', title: 'Ihr Wiederherstellungscode', pose: 'success' };
		if (view === 'forgot' || view === 'forgot-sent') return { kicker: 'Für Lehrkräfte', title: 'Passwort vergessen', pose: view === 'forgot-sent' ? 'success' : 'thinking' };
		if (view === 'student-reset') return { kicker: 'Für Schüler', title: 'Passwort vergessen', pose: 'thinking' };
		if (view === 'register') return { kicker: 'Für Lehrkräfte', title: 'Lehrer-Konto erstellen', pose: loginError ? 'thinking' : 'wave' };
		// login
		return seg === 0
			? { kicker: 'Für Schüler', title: 'Anmelden', pose: loginError ? 'thinking' : 'wave' }
			: { kicker: 'Für Lehrkräfte', title: 'Anmelden', pose: loginError ? 'thinking' : 'wave' };
	});
</script>

<svelte:head><title>Anmelden · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="wrap">

			<!-- Hero-Block: Edgar + Kicker + Titel -->
			<div class="hero">
				<Edgar pose={meta().pose} {dark} class="hero-owl" />
				<div class="hero-text">
					<p class="kicker">{meta().kicker}</p>
					<h1>{meta().title}</h1>
				</div>
			</div>

			{#if view === 'login'}
				<!-- Umschalter Schüler / Lehrkraft -->
				<div class="segment">
					<button class="seg-btn" class:on={seg === 0} onclick={() => switchSeg(0)}>Ich bin Schüler</button>
					<button class="seg-btn" class:on={seg === 1} onclick={() => switchSeg(1)}>Ich bin Lehrkraft</button>
				</div>

				{#if showNotice}
					<div class="notice-box" role="status">
						<span class="notice-ico">i</span>
						<span>Die Anmeldung ist in Kürze verfügbar. Bis dahin wird dein Fortschritt automatisch im Browser gespeichert.</span>
					</div>
				{/if}

				{#if seg === 0}
					<!-- Schüler-Login -->
					<form class="card" onsubmit={submitStudentLogin} novalidate>
						{#if loginError}
							<p class="alert-err" role="alert">Klassencode, Name oder Passwort falsch. Prüfe beides und versuche es erneut.</p>
						{/if}
						{#if serverError}
							<p class="alert-err" role="alert">{serverError}</p>
						{/if}
						<div class="field">
							<label for="cl-code">Klassencode</label>
							<input id="cl-code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false"
								placeholder="z. B. blau-tiger-mond-42" class:err={codeErr} disabled={busy} bind:value={loginCode} />
							{#if codeErr}<span class="hint err">Bitte gib den Klassencode ein.</span>{/if}
						</div>
						<div class="field">
							<label for="cl-name">Name</label>
							<input id="cl-name" type="text" autocomplete="off" placeholder="z. B. Lena S."
								class:err={nameErr} disabled={busy} bind:value={loginName} />
							{#if nameErr}<span class="hint err">Bitte gib deinen Namen ein.</span>{/if}
						</div>
						<div class="field">
							<div class="label-row">
								<label for="cl-pw">Passwort</label>
								<button type="button" class="link-sm" onclick={() => go('student-reset')}>Passwort vergessen?</button>
							</div>
							<input id="cl-pw" type="password" autocomplete="current-password" placeholder="••••••••"
								class:err={pwErr} disabled={busy} bind:value={loginPw} />
							{#if pwErr}<span class="hint err">Bitte gib dein Passwort ein.</span>{/if}
						</div>
						<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Anmelden ...' : 'Anmelden'}</button>
					</form>

					<!-- Hinweis: Klasse beitreten -->
					<div class="info-row card">
						<p class="info-txt"><strong>Neu in der Klasse?</strong> Du brauchst noch kein Passwort. Tritt zuerst mit dem Klassencode deiner Lehrkraft bei.</p>
						<a class="link-sm" href="/beitreten">Klasse beitreten</a>
					</div>

				{:else}
					<!-- Lehrkraft-Login -->
					<form class="card" onsubmit={submitTeacherLogin} novalidate>
						{#if loginError}
							<p class="alert-err" role="alert">E-Mail-Adresse oder Passwort falsch. Prüfen Sie beides und versuchen Sie es erneut.</p>
						{/if}
						{#if serverError}
							<p class="alert-err" role="alert">{serverError}</p>
						{/if}
						<div class="field">
							<label for="t-email">E-Mail-Adresse</label>
							<input id="t-email" type="email" autocomplete="username" placeholder="name@schule.de"
								class:err={tEmailErr} disabled={busy} bind:value={tEmail} />
							{#if tEmailErr}<span class="hint err">Bitte geben Sie Ihre E-Mail-Adresse ein.</span>{/if}
						</div>
						<div class="field">
							<div class="label-row">
								<label for="t-pw">Passwort</label>
								<button type="button" class="link-sm" onclick={() => go('forgot')}>Passwort vergessen?</button>
							</div>
							<input id="t-pw" type="password" autocomplete="current-password" placeholder="••••••••"
								class:err={tPwErr} disabled={busy} bind:value={tPw} />
							{#if tPwErr}<span class="hint err">Bitte geben Sie Ihr Passwort ein.</span>{/if}
						</div>
						<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Anmelden ...' : 'Anmelden'}</button>
						<p class="foot-inline">Noch kein Konto? <button type="button" class="link-sm" onclick={() => go('register')}>Lehrer-Konto erstellen</button></p>
					</form>

					<!-- Hinweis Schüler beim Lehrer-Login -->
					<div class="info-row card">
						<p class="info-txt"><strong>Du bist Schüler oder Schülerin?</strong> Du brauchst kein Konto. Tritt mit dem Klassencode deiner Lehrkraft bei.</p>
						<a class="link-sm" href="/beitreten">Klasse beitreten</a>
					</div>
				{/if}

			{:else if view === 'student-reset'}
				<!-- Schüler: Einmal-Code der Lehrkraft -->
				<form class="card" onsubmit={submitStudentReset} novalidate>
					<p class="card-intro">Bitte deine Lehrkraft um einen Einmal-Code. Er gilt 15 Minuten.</p>
					{#if showNotice}
						<div class="notice-box" role="status"><span class="notice-ico">i</span><span>Die Anmeldung ist in Kürze verfügbar.</span></div>
					{/if}
					{#if serverError}
						<p class="alert-err" role="alert">{serverError}</p>
					{/if}
					<div class="field">
						<label for="sr-code">Klassencode</label>
						<input id="sr-code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false"
							placeholder="z. B. blau-tiger-mond-42" class:err={codeErr} disabled={busy} bind:value={loginCode} />
						{#if codeErr}<span class="hint err">Bitte gib den Klassencode ein.</span>{/if}
					</div>
					<div class="field">
						<label for="sr-name">Name</label>
						<input id="sr-name" type="text" autocomplete="off" placeholder="z. B. Lena S." class:err={nameErr} disabled={busy} bind:value={loginName} />
						{#if nameErr}<span class="hint err">Bitte gib deinen Namen ein.</span>{/if}
					</div>
					<div class="field">
						<label for="sr-rc">Einmal-Code der Lehrkraft</label>
						<input id="sr-rc" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
							placeholder="z. B. K7M4QX2P" class:err={resetCodeErr} disabled={busy} bind:value={resetCode} />
						{#if resetCodeErr}<span class="hint err">Bitte gib den Code deiner Lehrkraft ein.</span>{/if}
					</div>
					<div class="field">
						<label for="sr-pw">Neues Passwort</label>
						<input id="sr-pw" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={resetPwErr} disabled={busy} bind:value={resetPw} />
						{#if resetPwErr}<span class="hint err">Mindestens 8 Zeichen.</span>{/if}
					</div>
					<div class="field">
						<label for="sr-pw2">Neues Passwort wiederholen</label>
						<input id="sr-pw2" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={resetPw2Err} disabled={busy} bind:value={resetPw2} />
						{#if resetPw2Err}<span class="hint err">Die Passwörter stimmen nicht überein.</span>{/if}
					</div>
					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Wird gespeichert ...' : 'Neues Passwort speichern'}</button>
				</form>
				<p class="foot-link"><button type="button" class="link-sm" onclick={() => go('login')}>Zurück zur Anmeldung</button></p>

			{:else if view === 'register'}
				<!-- Lehrkraft-Registrierung -->
				<form class="card" onsubmit={submitRegister} novalidate>
					{#if showNotice}
						<div class="notice-box" role="status"><span class="notice-ico">i</span><span>Konten sind in Kürze verfügbar.</span></div>
					{/if}
					{#if serverError}
						<p class="alert-err" role="alert">{serverError}</p>
					{/if}
					<div class="field">
						<label for="regl-name">Name</label>
						<input id="regl-name" type="text" autocomplete="name" placeholder="z. B. Anna Müller"
							class:err={regNameErr} disabled={busy} bind:value={regName} />
						{#if regNameErr}<span class="hint err">Bitte geben Sie Ihren Namen ein.</span>{/if}
					</div>
					<div class="field">
						<label for="regl-email">E-Mail-Adresse</label>
						<input id="regl-email" type="email" autocomplete="email" placeholder="name@gymnasium-beispiel.de"
							class:err={regEmailErr} disabled={busy} bind:value={regEmail} />
						{#if regEmailErr}<span class="hint err">Bitte geben Sie eine gültige E-Mail-Adresse ein.</span>{/if}
					</div>
					<div class="field">
						<label for="regl-pw">Passwort</label>
						<input id="regl-pw" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={regLPwErr} disabled={busy} bind:value={regLPw} />
						{#if touched}
							<ul class="rules" aria-label="Passwort-Regeln">
								<li class:rule-ok={lpw8ok} class:rule-no={!lpw8ok}><span class="rule-dot" class:dot-ok={lpw8ok}>{lpw8ok ? '✓' : ''}</span>Mindestens 8 Zeichen</li>
								<li class:rule-ok={lpwHasNum} class:rule-no={!lpwHasNum}><span class="rule-dot" class:dot-ok={lpwHasNum}>{lpwHasNum ? '✓' : ''}</span>Mindestens eine Zahl</li>
							</ul>
						{/if}
					</div>
					<div class="field">
						<label for="regl-pw2">Passwort wiederholen</label>
						<input id="regl-pw2" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={regLPwRepeatErr} disabled={busy} bind:value={regLPwRepeat} />
						{#if regLPwRepeatErr}<span class="hint err">Die Passwörter stimmen nicht überein.</span>{/if}
					</div>
					<div class="field">
						<div class="label-row">
							<label for="regl-school">Schule</label>
							<span class="opt-lbl">optional</span>
						</div>
						<input id="regl-school" type="text" autocomplete="organization" placeholder="z. B. Gymnasium am Park"
							disabled={busy} bind:value={regSchoolOpt} />
					</div>
					<label class="check-row" class:chk-err={regAcceptedErr}>
						<input type="checkbox" disabled={busy} bind:checked={regAccepted} style="width:18px;height:18px;accent-color:#2563eb;flex:none;margin-top:2px" />
						<span>Ich habe die <a href="/datenschutz" class="link-inline">Datenschutzerklärung</a> gelesen. Gespeichert werden Name, E-Mail-Adresse, das Passwort nur als Hash und optional die Schule.</span>
					</label>
					{#if regAcceptedErr}
						<span class="hint err">Bitte bestätigen Sie, dass Sie die Datenschutzerklärung gelesen haben.</span>
					{/if}
					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Konto wird erstellt ...' : 'Lehrer-Konto erstellen'}</button>
					<p class="foot-inline">Schon ein Konto? <button type="button" class="link-sm" onclick={() => switchSeg(1)}>Anmelden</button></p>
				</form>

			{:else if view === 'recovery'}
				<!-- Wiederherstellungscode anzeigen -->
				<div class="card">
					<p class="card-intro">Die Namen Ihrer Schüler sind verschlüsselt, nur Ihr Browser kann sie lesen. Vergessen Sie Ihr Passwort, holen Sie sie mit diesem Code zurück. Tabula kennt den Code nicht und kann ihn nicht wiederherstellen.</p>
					<div class="recovery-box" aria-label="Wiederherstellungscode">{recoveryCode}</div>
					<div class="btn-row">
						<button type="button" class="btn-secondary" onclick={() => window.print()}>Drucken</button>
						<button type="button" class="btn-secondary" onclick={copyRecovery}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
					</div>
					<label class="check-row">
						<input type="checkbox" bind:checked={recoveryNoted} style="width:18px;height:18px;accent-color:#2563eb;flex:none;margin-top:2px" />
						<span>Ich habe den Code notiert oder ausgedruckt.</span>
					</label>
					<button type="button" class="btn-primary" disabled={!recoveryNoted} onclick={() => goto(_redirect || '/teach')}>Weiter zu meinen Klassen</button>
					<p class="hint-note">Ohne Code geht nichts verloren außer den Namen: Sie kommen zurück, sobald sich Ihre Schüler das nächste Mal anmelden. Einen neuen Code können Sie jederzeit im Profil erzeugen.</p>
				</div>

			{:else if view === 'forgot'}
				<!-- Lehrkraft: Passwort vergessen -->
				<form class="card" onsubmit={submitForgot} novalidate>
					<p class="card-intro">Geben Sie die E-Mail-Adresse Ihres Lehrkraft-Kontos ein.</p>
					{#if serverError}
						<p class="alert-err" role="alert">{serverError}</p>
					{/if}
					<div class="field">
						<label for="forgot-email">E-Mail-Adresse</label>
						<input id="forgot-email" type="email" autocomplete="email" placeholder="name@schule.de"
							class:err={forgotEmailErr} disabled={busy} bind:value={forgotEmail} />
						{#if forgotEmailErr}<span class="hint err">Bitte geben Sie eine gültige E-Mail-Adresse ein.</span>{/if}
					</div>
					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Wird gesendet ...' : 'Link zum Zurücksetzen senden'}</button>
				</form>
				<p class="foot-link"><button type="button" class="link-sm" onclick={() => switchSeg(1)}>Zurück zur Anmeldung</button></p>

			{:else if view === 'forgot-sent'}
				<!-- Lehrkraft: E-Mail versendet -->
				<div class="card" role="status">
					<p style="margin:0;font-size:15px;line-height:1.55">Falls ein Konto mit dieser Adresse existiert, haben wir Ihnen eine E-Mail mit einem Link geschickt. Der Link ist eine Stunde gültig.</p>
				</div>
				<p class="foot-link"><button type="button" class="link-sm" onclick={() => switchSeg(1)}>Zurück zur Anmeldung</button></p>
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
		max-width: 440px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		animation: tbIn .3s ease-out;
	}

	@keyframes tbIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
	@media (prefers-reduced-motion: reduce) { .wrap { animation: none; } }

	/* Hero */
	.hero {
		display: flex;
		align-items: flex-end;
		gap: 16px;
	}
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

	/* Umschalter */
	.segment {
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 3px;
		border-radius: 9px;
		background: var(--subtle);
	}
	.seg-btn {
		height: 36px;
		display: grid;
		place-items: center;
		border-radius: 7px;
		font-size: 14px;
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
		font-family: inherit;
		transition: background .15s, color .15s;
	}
	.seg-btn.on {
		background: var(--surface);
		box-shadow: 0 1px 3px rgb(15 23 42 / .1);
		color: var(--ink);
	}

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

	.card-intro { margin: 0; font-size: 14px; line-height: 1.55; color: var(--ink-2); }

	/* Fehler-/Info-Banner in Karten */
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

	/* Notice */
	.notice-box {
		display: flex;
		gap: 10px;
		padding: 12px 14px;
		border-radius: 8px;
		border: 1px solid var(--accent-line);
		background: var(--accent-soft);
		font-size: 14px;
		color: var(--accent-ink);
	}
	.notice-ico {
		width: 18px; height: 18px; flex: none; border-radius: 999px;
		background: var(--accent); color: #fff;
		display: grid; place-items: center; font-size: 11px; font-weight: 700;
	}

	/* Info-Reihe (Klasse beitreten / Schüler beim Lehrer) */
	.info-row {
		flex-direction: row;
		align-items: center;
		gap: 14px;
	}
	.info-txt { margin: 0; flex: 1; font-size: 14px; line-height: 1.5; color: var(--ink-2); }
	.info-txt strong { color: var(--ink); font-weight: 600; }

	/* Felder */
	.field { display: flex; flex-direction: column; gap: 6px; }
	label { font-size: 14px; font-weight: 500; }
	.label-row { display: flex; align-items: baseline; gap: 8px; }
	.label-row label { flex: 1; }
	.opt-lbl { font-size: 13px; color: var(--ink-3); font-weight: 400; }

	input[type="text"], input[type="email"], input[type="password"] {
		height: 44px;
		padding: 0 12px;
		border-radius: 8px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		font-size: 15px;
		font-family: inherit;
		color: var(--ink);
		outline: none;
		width: 100%;
		box-sizing: border-box;
		font-weight: 400;
	}
	input::placeholder { color: var(--ink-3); }
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input.err { border-color: var(--danger); border-width: 1.5px; }
	input:disabled { opacity: 0.6; cursor: not-allowed; }

	.hint { font-size: 13px; line-height: 1.4; color: var(--ink-3); }
	.hint.err { color: var(--danger-ink); }

	/* Passwort-Regeln */
	.rules {
		margin: -2px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}
	.rules li { display: flex; align-items: center; gap: 8px; }
	.rule-ok { color: var(--ok-ink); }
	.rule-no { color: var(--ink-3); }
	.rule-dot {
		width: 14px; height: 14px; border-radius: 50%; flex: none;
		display: grid; place-items: center;
		background: var(--line); color: var(--ink-3); font-size: 10px;
	}
	.dot-ok { background: var(--ok); color: #fff; }

	/* Checkbox */
	.check-row {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 14px;
		line-height: 1.5;
		color: var(--ink-2);
		cursor: pointer;
	}
	.check-row.chk-err { color: var(--danger-ink); }
	.link-inline { color: var(--accent-ink); text-underline-offset: 3px; }

	/* Buttons */
	.btn-primary {
		height: 46px;
		border-radius: 8px;
		background: var(--accent);
		color: #fff;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background .15s;
	}
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

	.btn-secondary {
		flex: 1;
		height: 44px;
		border-radius: 8px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		color: var(--ink);
	}
	.btn-secondary:hover { background: var(--subtle); }

	.btn-row { display: flex; gap: 10px; }

	/* Footer */
	.foot-inline { margin: 0; font-size: 14px; color: var(--ink-2); }
	.foot-link { margin: 0; font-size: 14px; }
	.link-sm {
		font-size: 14px;
		font-weight: 500;
		color: var(--accent-ink);
		cursor: pointer;
		font-family: inherit;
		text-underline-offset: 3px;
	}
	.link-sm:hover { text-decoration: underline; color: var(--accent-strong); }

	.hint-note { font-size: 13px; line-height: 1.5; color: var(--ink-3); margin: 0; }

	/* Wiederherstellungscode */
	.recovery-box {
		padding: 16px;
		border-radius: 10px;
		border: 1.5px dashed var(--line-strong);
		background: var(--subtle);
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 17px;
		line-height: 1.55;
		text-align: center;
		word-break: break-word;
		user-select: all;
		color: var(--ink);
	}
	@media print {
		:global(body *) { visibility: hidden; }
		.recovery-box { visibility: visible; position: absolute; top: 40px; left: 40px; right: 40px; border: 1px solid #000; }
	}

	@media (max-width: 480px) {
		.center { padding: 24px 16px 48px; }
		.hero { gap: 12px; }
		:global(.hero-owl) { width: 72px; height: 65px; }
		.info-row { flex-direction: column; align-items: flex-start; }
	}
</style>
