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
		_redirect = page.url.searchParams.get('redirect') ?? '';
		const c = page.url.searchParams.get('code');
		if (c) loginCode = c;
		if (page.url.searchParams.get('rolle') === 'lehrkraft') seg = 1;
		return () => mo.disconnect();
	});

	let _redirect = $state('');

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
</script>

<svelte:head><title>Anmelden · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="form-wrap">

			{#if view === 'login'}
				<Edgar pose="wave" {dark} class="owl" />

				<div class="title-block">
					<h1>Anmelden</h1>
					<p class="sub">{seg === 0 ? 'Mit deiner Klasse: Klassencode, Name und Passwort.' : 'Mit Ihrer E-Mail-Adresse.'}</p>
				</div>

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

				{#if loginError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						{seg === 0 ? 'Klassencode, Name oder Passwort falsch.' : 'E-Mail-Adresse oder Passwort falsch.'}
					</div>
				{/if}

				{#if serverError}
					<div class="err-banner" role="alert"><span class="err-ico">!</span>{serverError}</div>
				{/if}

				{#if seg === 0}
					<form onsubmit={submitStudentLogin} novalidate>
						<div class="field">
							<label for="cl-code">Klassencode</label>
							<input id="cl-code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false"
								placeholder="z. B. blau-tiger-mond-42" class:err={codeErr} disabled={busy} bind:value={loginCode} />
							<span class="field-hint">Steht an der Tafel oder bei deiner Lehrkraft.</span>
							{#if codeErr}<span class="field-hint err-hint">Bitte gib den Klassencode ein.</span>{/if}
						</div>
						<div class="field">
							<label for="cl-name">Name</label>
							<input id="cl-name" type="text" autocomplete="off" placeholder="so, wie du ihn beim Beitreten geschrieben hast"
								class:err={nameErr} disabled={busy} bind:value={loginName} />
							{#if nameErr}<span class="field-hint err-hint">Bitte gib deinen Namen ein.</span>{/if}
						</div>
						<div class="field">
							<div class="label-row">
								<label for="cl-pw">Passwort</label>
								<button type="button" class="link-sm" onclick={() => go('student-reset')}>Passwort vergessen?</button>
							</div>
							<input id="cl-pw" type="password" autocomplete="current-password" placeholder="••••••••"
								class:err={pwErr} disabled={busy} bind:value={loginPw} />
							{#if pwErr}<span class="field-hint err-hint">Bitte gib dein Passwort ein.</span>{/if}
						</div>
						<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Anmelden …' : 'Anmelden'}</button>
					</form>
					<p class="foot-note">Dein Name und dein Passwort verlassen diesen Rechner nicht. Tabula sieht nur eine Nummer, deinen Namen kann nur deine Lehrkraft lesen.</p>
					<p class="foot">Neu in der Klasse? <a class="link-foot" href="/beitreten">Klasse beitreten</a></p>
				{:else}
					<form onsubmit={submitTeacherLogin} novalidate>
						<div class="field">
							<label for="t-email">E-Mail</label>
							<input id="t-email" type="email" autocomplete="username" placeholder="name@schule.de"
								class:err={tEmailErr} disabled={busy} bind:value={tEmail} />
							{#if tEmailErr}<span class="field-hint err-hint">Bitte geben Sie Ihre E-Mail-Adresse ein.</span>{/if}
						</div>
						<div class="field">
							<div class="label-row">
								<label for="t-pw">Passwort</label>
								<button type="button" class="link-sm" onclick={() => go('forgot')}>Passwort vergessen?</button>
							</div>
							<input id="t-pw" type="password" autocomplete="current-password" placeholder="••••••••"
								class:err={tPwErr} disabled={busy} bind:value={tPw} />
							{#if tPwErr}<span class="field-hint err-hint">Bitte geben Sie Ihr Passwort ein.</span>{/if}
						</div>
						<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Anmelden …' : 'Anmelden'}</button>
					</form>
					<p class="foot">Noch kein Konto? <button type="button" class="link-foot" onclick={() => go('register')}>Konto für Lehrkräfte erstellen</button></p>
				{/if}

			{:else if view === 'student-reset'}
				<Edgar pose="thinking" {dark} class="owl" />
				<div class="title-block">
					<h1>Passwort vergessen?</h1>
					<p class="sub">Bitte deine Lehrkraft um einen Einmal-Code. Er gilt 15 Minuten.</p>
				</div>
				{#if showNotice}
					<div class="notice-box" role="status"><span class="notice-ico">i</span><span>Die Anmeldung ist in Kürze verfügbar.</span></div>
				{/if}
				{#if serverError}
					<div class="err-banner" role="alert"><span class="err-ico">!</span>{serverError}</div>
				{/if}
				<form onsubmit={submitStudentReset} novalidate>
					<div class="field">
						<label for="sr-code">Klassencode</label>
						<input id="sr-code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false"
							placeholder="z. B. blau-tiger-mond-42" class:err={codeErr} disabled={busy} bind:value={loginCode} />
					</div>
					<div class="field">
						<label for="sr-name">Name</label>
						<input id="sr-name" type="text" autocomplete="off" class:err={nameErr} disabled={busy} bind:value={loginName} />
					</div>
					<div class="field">
						<label for="sr-rc">Einmal-Code der Lehrkraft</label>
						<input id="sr-rc" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="z. B. K7M4QX2P"
							class:err={resetCodeErr} disabled={busy} bind:value={resetCode} />
						{#if resetCodeErr}<span class="field-hint err-hint">Bitte gib den Code deiner Lehrkraft ein.</span>{/if}
					</div>
					<div class="field">
						<label for="sr-pw">Neues Passwort</label>
						<input id="sr-pw" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={resetPwErr} disabled={busy} bind:value={resetPw} />
						{#if resetPwErr}<span class="field-hint err-hint">Mindestens 8 Zeichen.</span>{/if}
					</div>
					<div class="field">
						<label for="sr-pw2">Neues Passwort wiederholen</label>
						<input id="sr-pw2" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={resetPw2Err} disabled={busy} bind:value={resetPw2} />
						{#if resetPw2Err}<span class="field-hint err-hint">Die Passwörter stimmen nicht überein.</span>{/if}
					</div>
					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Neues Passwort speichern'}</button>
				</form>
				<p class="foot">Zurück zur <button type="button" class="link-foot" onclick={() => go('login')}>Anmeldung</button></p>

			{:else if view === 'register'}
				<div class="title-block">
					<h1>Konto für Lehrkräfte</h1>
					<p class="sub">Schüler brauchen kein Konto. Sie treten Ihrer Klasse mit dem Klassencode bei.</p>
				</div>

				{#if showNotice}
					<div class="notice-box" role="status"><span class="notice-ico">i</span><span>Konten sind in Kürze verfügbar.</span></div>
				{/if}
				{#if serverError}
					<div class="err-banner" role="alert"><span class="err-ico">!</span>{serverError}</div>
				{/if}

				<form onsubmit={submitRegister} novalidate>
					<div class="field">
						<label for="regl-name">Name</label>
						<input id="regl-name" type="text" autocomplete="name" placeholder="z. B. Anna Müller"
							class:err={regNameErr} disabled={busy} bind:value={regName} />
						<span class="field-hint">Sehen Ihre Schüler beim Beitreten.</span>
						{#if regNameErr}<span class="field-hint err-hint">Bitte geben Sie Ihren Namen ein.</span>{/if}
					</div>
					<div class="field">
						<label for="regl-email">E-Mail</label>
						<input id="regl-email" type="email" autocomplete="email" placeholder="name@gymnasium-beispiel.de"
							class:err={regEmailErr} disabled={busy} bind:value={regEmail} />
						{#if regEmailErr}<span class="field-hint err-hint">Bitte geben Sie eine gültige E-Mail-Adresse ein.</span>{/if}
					</div>
					<div class="field">
						<label for="regl-pw">Passwort</label>
						<input id="regl-pw" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={regLPwErr} disabled={busy} bind:value={regLPw} />
						{#if touched}
							<div class="rules">
								<span class:ok={lpw8ok} class:no={!lpw8ok}>{lpw8ok ? '✓' : '○'} mind. 8 Zeichen</span>
								<span class:ok={lpwHasNum} class:no={!lpwHasNum}>{lpwHasNum ? '✓' : '○'} eine Zahl</span>
							</div>
						{/if}
					</div>
					<div class="field">
						<label for="regl-pw2">Passwort wiederholen</label>
						<input id="regl-pw2" type="password" autocomplete="new-password" placeholder="••••••••"
							class:err={regLPwRepeatErr} disabled={busy} bind:value={regLPwRepeat} />
						{#if regLPwRepeatErr}<span class="field-hint err-hint">Die Passwörter stimmen nicht überein.</span>{/if}
					</div>
					<div class="field">
						<div class="label-row">
							<label for="regl-school">Schule</label>
							<span class="opt-label">optional</span>
						</div>
						<input id="regl-school" type="text" autocomplete="organization" placeholder="z. B. Gymnasium am Park"
							disabled={busy} bind:value={regSchoolOpt} />
					</div>
					<div class="check-row" class:chk-err={regAcceptedErr}>
						<button type="button" class="checkbox" class:checked={regAccepted} role="checkbox" aria-checked={regAccepted}
							disabled={busy} onclick={() => (regAccepted = !regAccepted)}>{#if regAccepted}✓{/if}</button>
						<span>Ich habe die Hinweise zum Datenschutz gelesen. <a href="/datenschutz" class="link-inline">Datenschutzerklärung</a></span>
					</div>
					{#if regAcceptedErr}
						<span class="field-hint err-hint" style="margin-top:-8px">Bitte bestätigen Sie, dass Sie die Hinweise zum Datenschutz gelesen haben.</span>
					{/if}
					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Konto wird erstellt …' : 'Konto erstellen'}</button>
				</form>
				<p class="foot">Schon ein Konto? <button type="button" class="link-foot" onclick={() => switchSeg(1)}>Anmelden</button></p>

			{:else if view === 'recovery'}
				<Edgar pose="success" {dark} class="owl" />
				<div class="title-block">
					<h1>Ihr Wiederherstellungscode</h1>
					<p class="sub">Die Namen Ihrer Schüler sind verschlüsselt, nur Ihr Browser kann sie lesen. Vergessen Sie Ihr Passwort, holen Sie sie mit diesem Code zurück. Tabula kennt den Code nicht und kann ihn nicht wiederherstellen.</p>
				</div>
				<div class="recovery-box" aria-label="Wiederherstellungscode">{recoveryCode}</div>
				<div class="btn-row">
					<button type="button" class="btn-secondary" onclick={() => window.print()}>Drucken</button>
					<button type="button" class="btn-secondary" onclick={copyRecovery}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
				</div>
				<div class="check-row">
					<button type="button" class="checkbox" class:checked={recoveryNoted} role="checkbox" aria-checked={recoveryNoted}
						onclick={() => (recoveryNoted = !recoveryNoted)}>{#if recoveryNoted}✓{/if}</button>
					<span>Ich habe den Code notiert oder ausgedruckt.</span>
				</div>
				<button type="button" class="btn-primary" disabled={!recoveryNoted} onclick={() => goto(_redirect || '/teach')}>Weiter zu meinen Klassen</button>
				<p class="foot-note">Ohne Code geht nichts verloren außer den Namen: Sie kommen zurück, sobald sich Ihre Schüler das nächste Mal anmelden. Einen neuen Code können Sie jederzeit im Profil erzeugen.</p>

			{:else if view === 'forgot'}
				<Edgar pose="thinking" {dark} class="owl" />
				<div class="title-block">
					<h1>Passwort vergessen?</h1>
					<p class="sub">Geben Sie die E-Mail-Adresse Ihres Lehrkraft-Kontos ein.</p>
				</div>
				{#if serverError}
					<div class="err-banner" role="alert"><span class="err-ico">!</span>{serverError}</div>
				{/if}
				<form onsubmit={submitForgot} novalidate>
					<div class="field">
						<label for="forgot-email">E-Mail</label>
						<input id="forgot-email" type="email" autocomplete="email" placeholder="name@schule.de"
							class:err={forgotEmailErr} disabled={busy} bind:value={forgotEmail} />
						{#if forgotEmailErr}<span class="field-hint err-hint">Bitte geben Sie eine gültige E-Mail-Adresse ein.</span>{/if}
					</div>
					<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Wird gesendet …' : 'Link senden'}</button>
				</form>
				<p class="foot-note">Halten Sie danach Ihren Wiederherstellungscode bereit, damit die Namen Ihrer Schüler sofort wieder lesbar sind.</p>
				<p class="foot">Zurück zur <button type="button" class="link-foot" onclick={() => switchSeg(1)}>Anmeldung</button></p>

			{:else if view === 'forgot-sent'}
				<Edgar pose="success" {dark} class="owl" />
				<div class="title-block"><h1>Schauen Sie in Ihr Postfach</h1></div>
				<div class="ok-banner" role="status">
					<span class="ok-ico">✓</span>
					Falls ein Konto mit dieser Adresse existiert, haben wir Ihnen eine E-Mail geschickt.
				</div>
				<p class="foot">Zurück zur <button type="button" class="link-foot" onclick={() => switchSeg(1)}>Anmeldung</button></p>
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
		padding: 64px 20px 80px;
	}

	.form-wrap {
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	:global(.owl) { width: 88px; height: 79px; display: block; }

	/* Title */
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	h1 { font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
	.sub { font-size: 15px; line-height: 22px; color: var(--ink-2); margin: 0; }

	/* Segment */
	.segment { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 8px; background: var(--subtle); font-size: 15px; font-weight: 500; }
	.seg-btn { height: 40px; display: grid; place-items: center; border-radius: 6px; color: var(--ink-2); cursor: pointer; font-size: 15px; font-weight: 500; }
	.seg-btn.on { background: var(--surface); box-shadow: 0 1px 2px rgb(15 23 42 / .1); color: var(--ink); }

	/* Banners */
	.notice-box {
		display: flex; gap: 10px; padding: 12px 14px; border-radius: 10px;
		border: 1px solid var(--accent-line); background: var(--accent-soft);
		font-size: 14px; line-height: 20px; color: var(--accent-ink);
	}
	.notice-ico {
		width: 20px; height: 20px; flex: none; border-radius: 999px;
		background: var(--accent); color: #fff; display: grid; place-items: center;
		font-size: 12px; font-weight: 700;
	}
	.err-banner {
		display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px;
		border: 1px solid var(--danger-line); background: var(--danger-soft);
		font-size: 14px; line-height: 20px; color: var(--danger-ink);
	}
	.err-ico {
		width: 20px; height: 20px; flex: none; border-radius: 999px;
		background: var(--danger); color: #fff; display: grid; place-items: center;
		font-size: 12px; font-weight: 700;
	}
	.ok-banner {
		display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px;
		border: 1px solid var(--ok-line); background: var(--ok-soft);
		font-size: 14px; line-height: 20px; color: var(--ok-ink);
	}
	.ok-ico {
		width: 20px; height: 20px; flex: none; border-radius: 999px;
		background: var(--ok); color: #fff; display: grid; place-items: center;
		font-size: 12px; font-weight: 700;
	}

	/* Form */
	form { display: flex; flex-direction: column; gap: 18px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	label { font-size: 14px; font-weight: 500; }
	.label-row { display: flex; align-items: baseline; gap: 8px; }
	.label-row label { flex: 1; }
	.opt-label { font-size: 13px; color: var(--ink-3); }

	input {
		height: 44px; padding: 0 12px; border-radius: 6px;
		border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 15px; font-family: inherit; color: var(--ink);
		outline: none; width: 100%; box-sizing: border-box;
	}
	input::placeholder { color: var(--ink-3); }
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input.err { border-color: var(--danger); border-width: 1.5px; }
	input:disabled { opacity: 0.6; cursor: not-allowed; }

	.field-hint { font-size: 13px; line-height: 18px; color: var(--ink-3); }
	.err-hint { color: var(--danger-ink); }

	/* Password rules */
	.rules { display: flex; flex-wrap: wrap; gap: 6px 14px; }
	.rules .ok { font-size: 13px; color: var(--ok-ink); }
	.rules .no { font-size: 13px; color: var(--ink-3); }

	/* Checkbox */
	.check-row { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 20px; }
	.check-row.chk-err .checkbox { border-color: var(--danger); }
	.checkbox {
		width: 20px; height: 20px; flex: none; border-radius: 5px;
		border: 1.5px solid var(--line-strong); background: var(--surface);
		display: grid; place-items: center; font-size: 12px;
		margin-top: 1px; cursor: pointer;
	}
	.checkbox.checked { background: var(--accent); border-color: var(--accent); color: #fff; }
	.link-inline { color: var(--accent-strong); text-decoration: underline; }

	/* Button */
	.btn-primary {
		display: flex; align-items: center; justify-content: center;
		height: 48px; border-radius: 6px; background: var(--accent); color: #fff;
		font-size: 16px; font-weight: 500; cursor: pointer;
		font-family: inherit; width: 100%;
	}
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

	/* Footer links */
	.foot { font-size: 14px; color: var(--ink-2); text-align: center; margin: 0; }
	.link-sm { font-size: 13px; font-weight: 500; color: var(--accent-strong); cursor: pointer; font-family: inherit; }
	.link-sm:hover { text-decoration: underline; }
	.link-foot { font-size: 14px; font-weight: 500; color: var(--accent-strong); cursor: pointer; font-family: inherit; }
	.link-foot:hover { text-decoration: underline; }
	.foot-note { font-size: 13px; line-height: 18px; color: var(--ink-3); margin: 0; }


	/* Wiederherstellungscode */
	.recovery-box {
		padding: 16px; border-radius: 10px; border: 1.5px dashed var(--line-strong); background: var(--subtle);
		font-family: var(--font-mono, ui-monospace, monospace); font-size: 17px; line-height: 26px; text-align: center;
		word-break: break-word; user-select: all; color: var(--ink);
	}
	.btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.btn-secondary {
		height: 44px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 15px; font-weight: 500; color: var(--ink); cursor: pointer; font-family: inherit;
	}
	.btn-secondary:hover { background: var(--subtle); }
	@media print {
		:global(body *) { visibility: hidden; }
		.recovery-box, .recovery-box * { visibility: visible; }
		.recovery-box { position: absolute; top: 40px; left: 40px; right: 40px; border: 1px solid #000; }
	}

	@media (max-width: 767px) {
		.center { padding: 24px 20px 48px; }
		h1 { font-size: 26px; line-height: 32px; }
		.form-wrap { gap: 16px; }
	}
</style>
