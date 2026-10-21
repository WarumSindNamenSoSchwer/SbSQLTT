<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session, sessionLogin, sessionRegister } from '$lib/tabula/session.svelte.js';
	import { apiPasswordForgot, ApiError } from '$lib/tabula/api.js';

	// ---- Theme ---------------------------------------------------------------
	let dark = $state(false);
	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		// Redirect nach Login?
		const redirect = page.url.searchParams.get('redirect') ?? '/learn';
		_redirect = redirect;
		return () => mo.disconnect();
	});

	let _redirect = $state('/learn');

	// ---- View state ----------------------------------------------------------
	type View = 'login' | 'register' | 'forgot' | 'forgot-sent';
	let view = $state<View>('login');

	// Segment: Schüler (0) or Lehrkraft (1)
	let seg = $state<0 | 1>(0);

	// ---- Busy / Server error -------------------------------------------------
	let busy = $state(false);
	let serverError = $state<string | null>(null);

	// ---- Login form ----------------------------------------------------------
	let loginIdent = $state('');
	let loginPw = $state('');
	let loginTouched = $state(false);
	let loginError = $state(false);    // wrong credentials banner

	// ---- Register form (Schüler) ---------------------------------------------
	let regUsername = $state('');
	let regDisplay = $state('');
	let regPw = $state('');
	let regPwRepeat = $state('');
	let regEmailOpt = $state('');
	let regClassOpt = $state('');

	// ---- Register form (Lehrkraft) -------------------------------------------
	let regName = $state('');
	let regEmail = $state('');
	let regLPw = $state('');
	let regLPwRepeat = $state('');
	let regSchoolOpt = $state('');
	let regAccepted = $state(false);

	// ---- Forgot form ---------------------------------------------------------
	let forgotEmail = $state('');
	let forgotTouched = $state(false);

	// ---- Submit state --------------------------------------------------------
	let regTouched = $state(false);
	let showNotice = $state(false);    // "Konten kommen bald" notice on submit

	// ---- Validation helpers --------------------------------------------------
	const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

	// Login
	const loginIdentErr = $derived(loginTouched && !loginIdent.trim());
	const loginPwErr = $derived(loginTouched && !loginPw.trim());

	// Register Schüler
	const regUsernameErr = $derived(regTouched && !regUsername.trim());
	const regDisplayErr = $derived(regTouched && !regDisplay.trim());
	const regPwErr = $derived(regTouched && regPw.length < 8);
	const regPwRepeatErr = $derived(regTouched && regPw !== regPwRepeat);
	const pw8ok = $derived(regPw.length >= 8);
	const pwMatch = $derived(regPw.length > 0 && regPw === regPwRepeat);

	// Register Lehrkraft
	const regNameErr = $derived(regTouched && !regName.trim());
	const regEmailErr = $derived(regTouched && !validEmail(regEmail));
	const regLPwErr = $derived(regTouched && regLPw.length < 8);
	const regLPwRepeatErr = $derived(regTouched && regLPw !== regLPwRepeat);
	const regAcceptedErr = $derived(regTouched && !regAccepted);
	const lpw8ok = $derived(regLPw.length >= 8);
	const lpwHasNum = $derived(/\d/.test(regLPw));

	// Forgot
	const forgotEmailErr = $derived(forgotTouched && !validEmail(forgotEmail));

	// ---- Handlers ------------------------------------------------------------
	async function submitLogin(e: Event) {
		e.preventDefault();
		loginTouched = true;
		loginError = false;
		serverError = null;
		if (!loginIdent.trim() || !loginPw.trim()) return;

		if (!ACCOUNTS_LIVE) {
			showNotice = true;
			return;
		}

		busy = true;
		try {
			await sessionLogin(loginIdent.trim(), loginPw);
			goto(session.user?.must_change_password ? '/profil?pw=1' : _redirect);
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				loginError = true;
			} else if (err instanceof Error) {
				serverError = err.message;
			}
		} finally {
			busy = false;
		}
	}

	async function submitRegister(e: Event) {
		e.preventDefault();
		regTouched = true;
		serverError = null;

		if (seg === 0) {
			if (!regUsername.trim() || !regDisplay.trim() || regPw.length < 8 || regPw !== regPwRepeat) return;
		} else {
			if (!regName.trim() || !validEmail(regEmail) || regLPw.length < 8 || regLPw !== regLPwRepeat || !regAccepted) return;
		}

		if (!ACCOUNTS_LIVE) {
			showNotice = true;
			return;
		}

		busy = true;
		try {
			if (seg === 0) {
				await sessionRegister({
					role: 'student',
					username: regUsername.trim(),
					display_name: regDisplay.trim(),
					password: regPw,
					email: regEmailOpt.trim() || undefined,
					class_code: regClassOpt.trim() || undefined,
				});
			} else {
				await sessionRegister({
					role: 'teacher',
					username: regEmail.trim(),
					display_name: regName.trim(),
					name: regName.trim(),
					email: regEmail.trim(),
					password: regLPw,
					school: regSchoolOpt.trim() || undefined,
					terms_accepted: true,
				});
			}
			goto(_redirect);
		} catch (err) {
			if (err instanceof Error) {
				serverError = err.message;
			}
		} finally {
			busy = false;
		}
	}

	async function submitForgot(e: Event) {
		e.preventDefault();
		forgotTouched = true;
		serverError = null;
		if (!validEmail(forgotEmail)) return;

		if (!ACCOUNTS_LIVE) {
			view = 'forgot-sent';
			return;
		}

		busy = true;
		try {
			await apiPasswordForgot(forgotEmail.trim());
			view = 'forgot-sent';
		} catch (err) {
			if (err instanceof Error) {
				serverError = err.message;
			}
		} finally {
			busy = false;
		}
	}

	function go(v: View) {
		view = v;
		loginTouched = false;
		loginError = false;
		regTouched = false;
		forgotTouched = false;
		showNotice = false;
		serverError = null;
	}

	function switchSeg(s: 0 | 1) {
		seg = s;
		regTouched = false;
		showNotice = false;
		serverError = null;
	}
</script>

<svelte:head><title>Anmelden · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="form-wrap">

			<!-- ============ LOGIN (C1) ============ -->
			{#if view === 'login'}
				<Edgar pose="wave" {dark} class="owl" />

				<div class="title-block">
					<h1>Anmelden</h1>
					<p class="sub">Mit E-Mail oder Benutzername.</p>
				</div>

				{#if showNotice}
					<div class="notice-box" role="status">
						<span class="notice-ico">i</span>
						<span>Konten sind in Kürze verfügbar. Bis dahin wird dein Fortschritt automatisch im Browser gespeichert, du brauchst kein Konto.</span>
					</div>
				{/if}

				{#if loginError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						E-Mail/Benutzername oder Passwort falsch.
					</div>
				{/if}

				{#if serverError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						{serverError}
					</div>
				{/if}

				<form onsubmit={submitLogin} novalidate>
					<div class="field">
						<div class="label-row">
							<label for="login-ident">E-Mail oder Benutzername</label>
						</div>
						<input
							id="login-ident"
							type="text"
							autocomplete="username"
							placeholder="mia.k oder name@schule.de"
							class:err={loginIdentErr}
							disabled={busy}
							bind:value={loginIdent}
						/>
						{#if loginIdentErr}
							<span class="field-hint err-hint">Bitte gib deinen Benutzernamen oder deine E-Mail ein.</span>
						{/if}
					</div>

					<div class="field">
						<div class="label-row">
							<label for="login-pw">Passwort</label>
							<button type="button" class="link-sm" onclick={() => go('forgot')}>Passwort vergessen?</button>
						</div>
						<input
							id="login-pw"
							type="password"
							autocomplete="current-password"
							placeholder="••••••••"
							class:err={loginPwErr}
							disabled={busy}
							bind:value={loginPw}
						/>
						{#if loginPwErr}
							<span class="field-hint err-hint">Bitte gib dein Passwort ein.</span>
						{/if}
					</div>

					<button type="submit" class="btn-primary" disabled={busy}>
						{busy ? 'Anmelden …' : 'Anmelden'}
					</button>
				</form>

				<p class="foot">Noch kein Konto? <button type="button" class="link-foot" onclick={() => go('register')}>Konto erstellen</button></p>

			<!-- ============ REGISTER (C2) ============ -->
			{:else if view === 'register'}
				<div class="title-block">
					<h1>Konto erstellen</h1>
				</div>

				<!-- Segment control -->
				<div class="segment">
					<button class="seg-btn" class:on={seg === 0} onclick={() => switchSeg(0)}>Ich bin Schüler:in</button>
					<button class="seg-btn" class:on={seg === 1} onclick={() => switchSeg(1)}>Ich bin Lehrkraft</button>
				</div>

				{#if showNotice}
					<div class="notice-box" role="status">
						<span class="notice-ico">i</span>
						<span>Konten sind in Kürze verfügbar. Bis dahin {seg === 0 ? 'wird dein Fortschritt automatisch im Browser gespeichert, du brauchst kein Konto.' : 'wird Ihr Fortschritt automatisch im Browser gespeichert.'}</span>
					</div>
				{/if}

				{#if serverError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						{serverError}
					</div>
				{/if}

				{#if seg === 0}
					<!-- Schüler:in -->
					<form onsubmit={submitRegister} novalidate>
						<div class="field">
							<label for="reg-uname">Benutzername</label>
							<input
								id="reg-uname"
								type="text"
								autocomplete="username"
								placeholder="z. B. mia.k"
								class:err={regUsernameErr}
								disabled={busy}
								bind:value={regUsername}
							/>
							<span class="field-hint">Damit meldest du dich an. Nicht dein echter Name nötig.</span>
							{#if regUsernameErr}
								<span class="field-hint err-hint">Bitte wähle einen Benutzernamen.</span>
							{/if}
						</div>

						<div class="field">
							<label for="reg-display">Anzeigename</label>
							<input
								id="reg-display"
								type="text"
								autocomplete="name"
								placeholder="z. B. Mia K."
								class:err={regDisplayErr}
								disabled={busy}
								bind:value={regDisplay}
							/>
							<span class="field-hint">Sieht deine Lehrkraft.</span>
							{#if regDisplayErr}
								<span class="field-hint err-hint">Bitte gib einen Anzeigenamen ein.</span>
							{/if}
						</div>

						<div class="field">
							<label for="reg-pw">Passwort</label>
							<input
								id="reg-pw"
								type="password"
								autocomplete="new-password"
								placeholder="••••••••"
								class:err={regPwErr}
								disabled={busy}
								bind:value={regPw}
							/>
							{#if regTouched}
								<div class="rules">
									<span class:ok={pw8ok} class:no={!pw8ok}>{pw8ok ? '✓' : '○'} mind. 8 Zeichen</span>
								</div>
							{/if}
						</div>

						<div class="field">
							<label for="reg-pw2">Passwort wiederholen</label>
							<input
								id="reg-pw2"
								type="password"
								autocomplete="new-password"
								placeholder="••••••••"
								class:err={regPwRepeatErr}
								disabled={busy}
								bind:value={regPwRepeat}
							/>
							{#if regTouched}
								<div class="rules">
									<span class:ok={pwMatch} class:no={!pwMatch}>{pwMatch ? '✓' : '○'} stimmt überein</span>
								</div>
							{/if}
						</div>

						<div class="field">
							<div class="label-row">
								<label for="reg-email">E-Mail</label>
								<span class="opt-label">optional</span>
							</div>
							<input
								id="reg-email"
								type="email"
								autocomplete="email"
								placeholder="nur für Passwort-Reset"
								disabled={busy}
								bind:value={regEmailOpt}
							/>
						</div>

						<div class="field">
							<div class="label-row">
								<label for="reg-class">Klassencode</label>
								<span class="opt-label">optional</span>
							</div>
							<input
								id="reg-class"
								type="text"
								autocomplete="off"
								placeholder="z. B. ABC123"
								disabled={busy}
								bind:value={regClassOpt}
							/>
						</div>

						<button type="submit" class="btn-primary" disabled={busy}>
							{busy ? 'Konto wird erstellt …' : 'Konto erstellen'}
						</button>
					</form>
				{:else}
					<!-- Lehrkraft -->
					<form onsubmit={submitRegister} novalidate>
						<div class="field">
							<label for="regl-name">Name</label>
							<input
								id="regl-name"
								type="text"
								autocomplete="name"
								placeholder="z. B. Anna Müller"
								class:err={regNameErr}
								disabled={busy}
								bind:value={regName}
							/>
							{#if regNameErr}
								<span class="field-hint err-hint">Bitte geben Sie Ihren Namen ein.</span>
							{/if}
						</div>

						<div class="field">
							<label for="regl-email">E-Mail</label>
							<input
								id="regl-email"
								type="email"
								autocomplete="email"
								placeholder="name@gymnasium-beispiel.de"
								class:err={regEmailErr}
								disabled={busy}
								bind:value={regEmail}
							/>
							{#if regEmailErr}
								<span class="field-hint err-hint">Bitte geben Sie eine gültige E-Mail-Adresse ein.</span>
							{/if}
						</div>

						<div class="field">
							<label for="regl-pw">Passwort</label>
							<input
								id="regl-pw"
								type="password"
								autocomplete="new-password"
								placeholder="••••••••"
								class:err={regLPwErr}
								disabled={busy}
								bind:value={regLPw}
							/>
							{#if regTouched}
								<div class="rules">
									<span class:ok={lpw8ok} class:no={!lpw8ok}>{lpw8ok ? '✓' : '○'} mind. 8 Zeichen</span>
									<span class:ok={lpwHasNum} class:no={!lpwHasNum}>{lpwHasNum ? '✓' : '○'} eine Zahl</span>
								</div>
							{/if}
						</div>

						<div class="field">
							<label for="regl-pw2">Passwort wiederholen</label>
							<input
								id="regl-pw2"
								type="password"
								autocomplete="new-password"
								placeholder="••••••••"
								class:err={regLPwRepeatErr}
								disabled={busy}
								bind:value={regLPwRepeat}
							/>
							{#if regLPwRepeatErr}
								<span class="field-hint err-hint">Die Passwörter stimmen nicht überein.</span>
							{/if}
						</div>

						<div class="field">
							<div class="label-row">
								<label for="regl-school">Schule</label>
								<span class="opt-label">optional</span>
							</div>
							<input
								id="regl-school"
								type="text"
								autocomplete="organization"
								placeholder="z. B. Gymnasium am Park"
								disabled={busy}
								bind:value={regSchoolOpt}
							/>
						</div>

						<div class="check-row" class:chk-err={regAcceptedErr}>
							<button
								type="button"
								class="checkbox"
								class:checked={regAccepted}
								role="checkbox"
								aria-checked={regAccepted}
								disabled={busy}
								onclick={() => (regAccepted = !regAccepted)}
							>{#if regAccepted}✓{/if}</button>
							<span>Ich habe die Hinweise zum Datenschutz gelesen. <a href="/datenschutz" class="link-inline">Datenschutzerklärung</a></span>
						</div>
						{#if regAcceptedErr}
							<span class="field-hint err-hint" style="margin-top:-8px">Bitte bestätigen Sie, dass Sie die Hinweise zum Datenschutz gelesen haben.</span>
						{/if}

						<button type="submit" class="btn-primary" disabled={busy}>
							{busy ? 'Konto wird erstellt …' : 'Konto erstellen'}
						</button>
					</form>
				{/if}

				<p class="foot">Schon ein Konto? <button type="button" class="link-foot" onclick={() => go('login')}>Anmelden</button></p>

			<!-- ============ FORGOT (C5) ============ -->
			{:else if view === 'forgot'}
				<Edgar pose="thinking" {dark} class="owl" />

				<div class="title-block">
					<h1>Passwort vergessen?</h1>
					<p class="sub">Gib die E-Mail-Adresse deines Kontos ein.</p>
				</div>

				{#if serverError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						{serverError}
					</div>
				{/if}

				<form onsubmit={submitForgot} novalidate>
					<div class="field">
						<label for="forgot-email">E-Mail</label>
						<input
							id="forgot-email"
							type="email"
							autocomplete="email"
							placeholder="name@schule.de"
							class:err={forgotEmailErr}
							disabled={busy}
							bind:value={forgotEmail}
						/>
						{#if forgotEmailErr}
							<span class="field-hint err-hint">Bitte gib eine gültige E-Mail-Adresse ein.</span>
						{/if}
					</div>
					<button type="submit" class="btn-primary" disabled={busy}>
						{busy ? 'Wird gesendet …' : 'Link senden'}
					</button>
				</form>

				<p class="foot-note">Kein Konto mit E-Mail? Bitte deine Lehrkraft, dein Passwort zurückzusetzen.</p>

				<p class="foot">Zurück zur <button type="button" class="link-foot" onclick={() => go('login')}>Anmeldung</button></p>

			<!-- ============ FORGOT SENT (C5-02) ============ -->
			{:else if view === 'forgot-sent'}
				<Edgar pose="success" {dark} class="owl" />

				<div class="title-block">
					<h1>Schau in dein Postfach</h1>
				</div>

				<div class="ok-banner" role="status">
					<span class="ok-ico">✓</span>
					Falls ein Konto existiert, haben wir dir eine E-Mail geschickt.
				</div>

				<p class="foot">Zurück zur <button type="button" class="link-foot" onclick={() => go('login')}>Anmeldung</button></p>
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

	@media (max-width: 767px) {
		.center { padding: 24px 20px 48px; }
		h1 { font-size: 26px; line-height: 32px; }
		.form-wrap { gap: 16px; }
	}
</style>
