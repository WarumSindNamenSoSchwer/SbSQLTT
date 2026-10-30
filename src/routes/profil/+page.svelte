<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import {
		session,
		sessionLogout,
		sessionStudentRekey,
		sessionLeaveClass,
		sessionChangeTeacherPassword,
		sessionRecoverWithCode,
		sessionStartFreshKeys,
		sessionNewRecoveryCode,
	} from '$lib/tabula/session.svelte.js';
	import { apiPatchMe, apiDeleteMe } from '$lib/tabula/api.js';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';

	let dark = $state(false);

	type EditField = 'name' | 'school' | 'password' | 'recovery' | null;
	let editing = $state<EditField>(null);
	let busy = $state(false);
	let err = $state<string | null>(null);

	// Felder
	let fName = $state('');
	let fSchool = $state('');
	let curPw = $state('');
	let newPw = $state('');
	let newPw2 = $state('');

	// Lehrkraft: Schlüssel nach Passwort-Reset wiederherstellen
	let recCode = $state('');
	let recPw = $state('');
	let recBusy = $state(false);
	let recErr = $state<string | null>(null);
	/** Neu erzeugter Wiederherstellungscode (einmal anzeigen) */
	let shownCode = $state<string | null>(null);

	// Schüler: Klasse verlassen Bestätigung
	let leaveAsk = $state(false);

	// Gefährliche Aktion (Lehrkraft: Konto löschen, Schüler: austreten)
	let dangerOpen = $state(false);
	let dangerConfirm = $state('');
	let dangerPw = $state('');
	let dangerBusy = $state(false);
	let dangerErr = $state<string | null>(null);

	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	function showToast(msg: string) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3000);
	}

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		const checkAuth = () => {
			if (!ACCOUNTS_LIVE) { goto('/'); return; }
			if (session.loading) { setTimeout(checkAuth, 50); return; }
			if (!session.user) goto('/login?redirect=/profil');
		};
		checkAuth();
		return () => mo.disconnect();
	});

	function startEdit(field: EditField) {
		editing = field;
		err = null;
		curPw = ''; newPw = ''; newPw2 = '';
		if (field === 'name') fName = session.displayName;
		if (field === 'school') fSchool = session.teacher?.school ?? '';
	}

	async function run(fn: () => Promise<void>, ok: string) {
		busy = true;
		err = null;
		try {
			await fn();
			editing = null;
			showToast(ok);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Fehler.';
		} finally {
			busy = false;
		}
	}

	// ---- Schüler --------------------------------------------------------------
	function saveStudentName(e: Event) {
		e.preventDefault();
		if (!fName.trim()) { err = 'Bitte gib deinen Namen ein.'; return; }
		if (!curPw) { err = 'Zum Ändern brauchst du dein Passwort.'; return; }
		void run(() => sessionStudentRekey(curPw, fName, curPw), 'Name geändert. Melde dich ab jetzt mit dem neuen Namen an.');
	}
	function saveStudentPassword(e: Event) {
		e.preventDefault();
		if (!curPw) { err = 'Bitte gib dein aktuelles Passwort ein.'; return; }
		if (newPw.length < 8) { err = 'Das neue Passwort braucht mindestens 8 Zeichen.'; return; }
		if (newPw !== newPw2) { err = 'Die Passwörter stimmen nicht überein.'; return; }
		void run(() => sessionStudentRekey(curPw, session.displayName, newPw), 'Passwort geändert.');
	}

	// ---- Lehrkraft ------------------------------------------------------------
	function saveTeacherName(e: Event) {
		e.preventDefault();
		if (!fName.trim()) { err = 'Bitte geben Sie Ihren Namen ein.'; return; }
		void run(async () => {
			await apiPatchMe({ display_name: fName.trim(), name: fName.trim() });
			if (session.teacher) session.teacher.display_name = fName.trim();
		}, 'Name gespeichert.');
	}
	function saveSchool(e: Event) {
		e.preventDefault();
		void run(async () => {
			await apiPatchMe({ school: fSchool.trim() || null });
			if (session.teacher) session.teacher.school = fSchool.trim() || null;
		}, 'Schule gespeichert.');
	}
	function saveTeacherPassword(e: Event) {
		e.preventDefault();
		if (!curPw) { err = 'Bitte geben Sie Ihr aktuelles Passwort ein.'; return; }
		if (newPw.length < 8) { err = 'Das neue Passwort braucht mindestens 8 Zeichen.'; return; }
		if (newPw !== newPw2) { err = 'Die Passwörter stimmen nicht überein.'; return; }
		void run(() => sessionChangeTeacherPassword(curPw, newPw), 'Passwort geändert. Andere Geräte wurden abgemeldet.');
	}
	function newRecovery(e: Event) {
		e.preventDefault();
		if (!curPw) { err = 'Bitte geben Sie Ihr Passwort ein.'; return; }
		void run(async () => { shownCode = await sessionNewRecoveryCode(curPw); }, 'Neuer Code erzeugt. Der alte gilt nicht mehr.');
	}

	async function recoverWithCode(e: Event) {
		e.preventDefault();
		recErr = null;
		if (!recCode.trim()) { recErr = 'Bitte geben Sie Ihren Wiederherstellungscode ein.'; return; }
		if (!recPw) { recErr = 'Bitte geben Sie Ihr neues Passwort ein.'; return; }
		recBusy = true;
		try {
			await sessionRecoverWithCode(recCode, recPw);
			showToast('Schlüssel wiederhergestellt. Die Namen sind wieder lesbar.');
		} catch (e2) {
			recErr = e2 instanceof Error ? e2.message : 'Fehler.';
		} finally {
			recBusy = false;
		}
	}
	async function startFresh() {
		recErr = null;
		if (!recPw) { recErr = 'Bitte geben Sie Ihr neues Passwort ein.'; return; }
		recBusy = true;
		try {
			shownCode = await sessionStartFreshKeys(recPw);
		} catch (e2) {
			recErr = e2 instanceof Error ? e2.message : 'Fehler.';
		} finally {
			recBusy = false;
		}
	}

	// ---- Löschen / Austreten --------------------------------------------------
	const dangerWord = $derived(session.teacher ? 'LÖSCHEN' : 'AUSTRETEN');
	async function confirmDanger() {
		if (dangerConfirm.trim().toUpperCase() !== dangerWord) { dangerErr = session.teacher ? `Bitte tippen Sie ${dangerWord}.` : `Bitte tippe ${dangerWord}.`; return; }
		dangerBusy = true;
		dangerErr = null;
		try {
			if (session.teacher) {
				if (!dangerPw) { dangerErr = 'Bitte geben Sie Ihr Passwort ein.'; return; }
				await apiDeleteMe(dangerPw);
				await sessionLogout().catch(() => {});
			} else {
				await sessionLeaveClass();
			}
			goto('/');
		} catch (e) {
			dangerErr = e instanceof Error ? e.message : 'Fehler.';
		} finally {
			dangerBusy = false;
		}
	}

	const initials = $derived(() => {
		const parts = session.displayName.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '';
		if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		return parts[0].slice(0, 2).toUpperCase();
	});

	// Thema-Steuerung
	const currentTheme = $derived(dark ? 'dunkel' : 'hell');
	function setTheme(t: 'hell' | 'dunkel' | 'auto') {
		if (t === 'hell') { document.documentElement.classList.add('light'); }
		else if (t === 'dunkel') { document.documentElement.classList.remove('light'); }
		else { /* auto: System */ document.documentElement.classList.remove('light'); }
		localStorage?.setItem('tabula-theme', t);
	}
</script>

<svelte:head><title>Profil · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}

	<main class="main">
		<div class="content">

			<!-- Kopf: Avatar + Name + Rolle -->
			<div class="page-head">
				<span class="avatar">{initials()}</span>
				<div>
					<p class="head-name">{session.displayName}</p>
					<p class="head-sub">{session.teacher ? 'Lehrkraft' : (session.student?.class ? `Schüler in ${session.student.class.name}` : 'Schüler')}</p>
				</div>
				<button class="btn-logout" onclick={async () => { await sessionLogout(); goto('/login'); }}>Abmelden</button>
			</div>

			{#if session.user}

				<!-- Warnung: Schlüssel nach Passwort-Reset wiederherstellen -->
				{#if session.teacher && session.needsKeyRecovery}
					<section class="section warn-section" role="alert">
						<h2>Namen Ihrer Schüler wiederherstellen</h2>
						<p class="section-hint">Ihr Passwort wurde zurückgesetzt. Die Namen Ihrer Schüler sind verschlüsselt und nur mit Ihrem Wiederherstellungscode wieder lesbar.</p>
						<form class="edit-form" onsubmit={recoverWithCode}>
							<input type="text" autocomplete="off" spellcheck="false" placeholder="Wiederherstellungscode (8 Wörter)" disabled={recBusy} bind:value={recCode} />
							<input type="password" autocomplete="current-password" placeholder="Ihr neues Passwort" disabled={recBusy} bind:value={recPw} />
							{#if recErr}<span class="field-err">{recErr}</span>{/if}
							<div class="btn-row">
								<button type="submit" class="btn-save" disabled={recBusy}>{recBusy ? 'Wird geprüft ...' : 'Wiederherstellen'}</button>
								<button type="button" class="btn-cancel" disabled={recBusy} onclick={startFresh}>Ich habe keinen Code</button>
							</div>
							<span class="field-hint">Ohne Code: Sie bekommen einen neuen Schlüssel. Fortschritt und Klassen bleiben, die Namen erscheinen wieder, sobald sich Ihre Schüler das nächste Mal anmelden.</span>
						</form>
					</section>
				{/if}

				<!-- Neu erzeugter Wiederherstellungscode -->
				{#if shownCode}
					<section class="section code-section" role="status">
						<h2>Ihr neuer Wiederherstellungscode</h2>
						<div class="code-val" aria-label="Wiederherstellungscode">{shownCode}</div>
						<p class="field-hint">Bitte notieren oder ausdrucken. Tabula kennt diesen Code nicht und kann ihn nicht wiederherstellen.</p>
						<div class="btn-row">
							<button class="btn-cancel" onclick={() => window.print()}>Drucken</button>
							<button class="btn-save" onclick={() => (shownCode = null)}>Notiert</button>
						</div>
					</section>
				{/if}

				<!-- === LEHRKRAFT === -->
				{#if session.teacher}
					<!-- Angaben -->
					<section class="section">
						<h2>Konto</h2>
						<dl class="dl-grid">
							<dt>Name</dt>
							<dd>
								{#if editing === 'name'}
									<form class="inline-form" onsubmit={saveTeacherName}>
										<input type="text" autocomplete="off" disabled={busy} bind:value={fName} />
										{#if err}<span class="field-err">{err}</span>{/if}
										<div class="btn-row">
											<button type="submit" class="btn-save" disabled={busy}>{busy ? 'Speichern ...' : 'Speichern'}</button>
											<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
										</div>
									</form>
								{:else}
									<span class="val-row">{session.displayName}<button class="btn-action" onclick={() => startEdit('name')}>Ändern</button></span>
								{/if}
							</dd>
							<dt>E-Mail</dt>
							<dd>{session.teacher.email}</dd>
							<dt>Schule</dt>
							<dd>
								{#if editing === 'school'}
									<form class="inline-form" onsubmit={saveSchool}>
										<input type="text" autocomplete="organization" disabled={busy} bind:value={fSchool} />
										{#if err}<span class="field-err">{err}</span>{/if}
										<div class="btn-row">
											<button type="submit" class="btn-save" disabled={busy}>Speichern</button>
											<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
										</div>
									</form>
								{:else}
									<span class="val-row">{session.teacher.school ?? 'Nicht angegeben'}<button class="btn-action" onclick={() => startEdit('school')}>Ändern</button></span>
								{/if}
							</dd>
						</dl>
						<div class="btn-group">
							<button class="btn-secondary" onclick={() => startEdit('password')}>Passwort ändern</button>
						</div>
						{#if editing === 'password'}
							<form class="edit-form" onsubmit={saveTeacherPassword}>
								<input type="password" autocomplete="current-password" placeholder="Aktuelles Passwort" disabled={busy} bind:value={curPw} />
								<input type="password" autocomplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)" disabled={busy} bind:value={newPw} />
								<input type="password" autocomplete="new-password" placeholder="Neues Passwort wiederholen" disabled={busy} bind:value={newPw2} />
								{#if err}<span class="field-err">{err}</span>{/if}
								<div class="btn-row">
									<button type="submit" class="btn-save" disabled={busy}>{busy ? 'Speichern ...' : 'Speichern'}</button>
									<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
								</div>
							</form>
						{/if}
					</section>

					<!-- Wiederherstellungscode -->
					<section class="section">
						<h2>Wiederherstellungscode</h2>
						<p class="section-hint">Nur bei Ihnen gespeichert. Mit diesem Code können Sie verschlüsselte Schülernamen wiederherstellen, falls Sie Ihr Passwort vergessen.</p>
						{#if editing === 'recovery'}
							<form class="edit-form" onsubmit={newRecovery}>
								<input type="password" autocomplete="current-password" placeholder="Ihr Passwort" disabled={busy} bind:value={curPw} />
								<span class="field-hint">Erzeugt einen neuen Code. Der alte gilt danach nicht mehr.</span>
								{#if err}<span class="field-err">{err}</span>{/if}
								<div class="btn-row">
									<button type="submit" class="btn-save" disabled={busy}>Neuen Code erzeugen</button>
									<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
								</div>
							</form>
						{:else}
							<button class="btn-secondary" onclick={() => startEdit('recovery')}>Neuen Code erzeugen</button>
						{/if}
					</section>

					<!-- Darstellung -->
					<section class="section">
						<h2>Darstellung</h2>
						<div class="theme-pills" role="radiogroup" aria-label="Darstellung">
							<button type="button" role="radio" aria-checked={!dark} class="theme-pill" class:active={!dark} onclick={() => setTheme('hell')}>Hell</button>
							<button type="button" role="radio" aria-checked={dark} class="theme-pill" class:active={dark} onclick={() => setTheme('dunkel')}>Dunkel</button>
						</div>
					</section>

					<!-- Konto löschen -->
					<section class="section danger-section">
						<h2 class="danger-title">Konto löschen</h2>
						<p class="section-hint">Ihr Konto, alle Klassen und der Lernfortschritt Ihrer Schüler werden endgültig gelöscht. Geben Sie zur Bestätigung Ihre E-Mail-Adresse ein.</p>
						<input
							placeholder={session.teacher?.email ?? 'Ihre E-Mail-Adresse'}
							aria-label="E-Mail-Adresse zur Bestätigung"
							bind:value={dangerConfirm}
							style="height:42px;padding:0 12px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);font-size:14px;width:100%;box-sizing:border-box;outline:none;font-family:inherit"
						/>
						<button
							type="button"
							class="btn-danger-sm"
							disabled={dangerConfirm.trim().toLowerCase() !== (session.teacher?.email ?? '').toLowerCase()}
							onclick={() => { dangerOpen = true; dangerConfirm = dangerConfirm; }}
						>Konto endgültig löschen</button>
					</section>

				<!-- === SCHÜLER === -->
				{:else if session.student}
					<!-- Name und Passwort -->
					<section class="section">
						<h2>Meine Angaben</h2>
						<dl class="dl-grid">
							<dt>Name</dt>
							<dd>
								{#if editing === 'name'}
									<form class="inline-form" onsubmit={saveStudentName}>
										<input type="text" autocomplete="off" disabled={busy} bind:value={fName} />
										<input type="password" autocomplete="current-password" placeholder="Dein Passwort" disabled={busy} bind:value={curPw} />
										<span class="field-hint">Du meldest dich danach mit dem neuen Namen an.</span>
										{#if err}<span class="field-err">{err}</span>{/if}
										<div class="btn-row">
											<button type="submit" class="btn-save" disabled={busy}>{busy ? 'Speichern ...' : 'Speichern'}</button>
											<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
										</div>
									</form>
								{:else}
									<span class="val-row">{session.displayName}<button class="btn-action" onclick={() => startEdit('name')}>Ändern</button></span>
								{/if}
							</dd>
							<dt>Passwort</dt>
							<dd>
								{#if editing === 'password'}
									<form class="inline-form" onsubmit={saveStudentPassword}>
										<input type="password" autocomplete="current-password" placeholder="Aktuelles Passwort" disabled={busy} bind:value={curPw} />
										<input type="password" autocomplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)" disabled={busy} bind:value={newPw} />
										<input type="password" autocomplete="new-password" placeholder="Neues Passwort wiederholen" disabled={busy} bind:value={newPw2} />
										{#if err}<span class="field-err">{err}</span>{/if}
										<div class="btn-row">
											<button type="submit" class="btn-save" disabled={busy}>{busy ? 'Speichern ...' : 'Speichern'}</button>
											<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
										</div>
									</form>
								{:else}
									<span class="val-row">••••••••<button class="btn-action" onclick={() => startEdit('password')}>Ändern</button></span>
								{/if}
							</dd>
						</dl>
					</section>

					<!-- Meine Klasse -->
					<section class="section">
						<h2>Meine Klasse</h2>
						{#if session.student.class}
							<div class="class-row">
								<div>
									<p class="class-name">{session.student.class.name}</p>
									<p class="class-sub">bei {session.student.class.teacher_name}</p>
								</div>
								<button class="btn-danger-sm" onclick={() => (leaveAsk = true)}>Klasse verlassen</button>
							</div>
							{#if leaveAsk}
								<div class="leave-confirm" role="alertdialog" aria-label="Klasse verlassen?">
									<p>Wirklich verlassen? Deine Lehrkraft sieht deinen Fortschritt danach nicht mehr. Dein Fortschritt bleibt in diesem Browser.</p>
									<div class="btn-row">
										<button class="btn-cancel" onclick={() => (leaveAsk = false)}>Abbrechen</button>
										<button class="btn-danger-sm" onclick={() => { void confirmDanger(); }}>Verlassen</button>
									</div>
								</div>
							{/if}
						{:else}
							<p class="section-hint">Du bist in keiner Klasse. <a class="link" href="/beitreten">Klasse beitreten</a></p>
						{/if}
					</section>

					<!-- Darstellung -->
					<section class="section">
						<h2>Darstellung</h2>
						<div class="theme-pills" role="radiogroup" aria-label="Darstellung">
							<button type="button" role="radio" aria-checked={!dark} class="theme-pill" class:active={!dark} onclick={() => setTheme('hell')}>Hell</button>
							<button type="button" role="radio" aria-checked={dark} class="theme-pill" class:active={dark} onclick={() => setTheme('dunkel')}>Dunkel</button>
						</div>
					</section>
				{/if}

			{/if}
		</div>
	</main>

	<!-- Löschen-Dialog (Lehrkraft) -->
	{#if dangerOpen && session.teacher}
		<div class="overlay" role="presentation">
			<div role="dialog" aria-modal="true" aria-label="Konto löschen" class="dialog">
				<h2>Konto wirklich löschen?</h2>
				<p class="dialog-body">Das lässt sich nicht rückgängig machen. Geben Sie zur Bestätigung Ihr Passwort ein.</p>
				<input type="password" class="dialog-input" autocomplete="current-password" placeholder="Ihr Passwort" disabled={dangerBusy} bind:value={dangerPw} />
				{#if dangerErr}<span class="field-err">{dangerErr}</span>{/if}
				<div class="dialog-btns">
					<button class="btn-dialog-cancel" onclick={() => { dangerOpen = false; dangerPw = ''; dangerErr = null; }} disabled={dangerBusy}>Abbrechen</button>
					<button class="btn-dialog-delete" onclick={confirmDanger} disabled={dangerBusy || !dangerPw}>
						{dangerBusy ? 'Bitte warten ...' : 'Endgültig löschen'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; position: relative; }

	.main {
		flex: 1;
		display: flex;
		justify-content: center;
		padding: clamp(24px, 5vh, 56px) 20px 80px;
	}

	.content {
		width: 100%;
		max-width: 600px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Toast */
	.toast {
		position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
		z-index: 50; height: 44px; padding: 0 18px; border-radius: 10px;
		background: #0f172a; color: #fff; font-size: 14px; font-weight: 500;
		display: flex; align-items: center;
		box-shadow: 0 12px 32px -12px rgb(15 23 42 / .28); white-space: nowrap;
	}

	/* Seiten-Kopf */
	.page-head {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 4px 0 8px;
	}
	.avatar {
		width: 48px; height: 48px; border-radius: 999px;
		background: var(--accent-soft); color: var(--accent-ink);
		display: grid; place-items: center; font-weight: 600; font-size: 16px; flex: none;
	}
	.head-name { margin: 0; font-size: 18px; font-weight: 600; }
	.head-sub { margin: 2px 0 0; font-size: 14px; color: var(--ink-2); }
	.btn-logout {
		margin-left: auto;
		height: 38px; padding: 0 14px; border-radius: 7px;
		border: 1px solid var(--line-strong);
		font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
		color: var(--ink);
	}
	.btn-logout:hover { background: var(--subtle); }

	/* Sektions-Karten */
	.section {
		padding: 22px 24px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}
	.section-hint { margin: 0; font-size: 14px; line-height: 1.55; color: var(--ink-2); }
	.field-hint { font-size: 13px; color: var(--ink-3); line-height: 1.4; }
	.field-err { font-size: 13px; color: var(--danger-ink); }

	/* Warn-Sektion (Schlüssel-Wiederherstellung) */
	.warn-section {
		border-color: #fcd34d;
		background: #fef3c7;
	}
	:global(html:not(.light)) .warn-section {
		border-color: #78350f;
		background: #451a03;
	}

	/* Code-Sektion */
	.code-section { border-color: var(--accent-line); background: var(--accent-soft); }
	.code-val {
		padding: 14px 16px; border-radius: 8px;
		border: 1.5px dashed var(--line-strong); background: var(--surface);
		font-family: 'IBM Plex Mono', monospace; font-size: 16px; line-height: 1.5;
		word-break: break-word; user-select: all; color: var(--ink);
	}

	/* Danger-Sektion */
	.danger-section { border-color: var(--danger-line); }
	.danger-title { color: var(--danger-ink); }

	/* DL-Grid */
	.dl-grid {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 10px 24px;
		font-size: 15px;
		align-items: start;
	}
	dt { color: var(--ink-3); font-size: 14px; padding-top: 2px; }
	dd { margin: 0; }
	.val-row { display: flex; align-items: center; gap: 12px; }

	/* Inline-Formulare */
	.inline-form { display: flex; flex-direction: column; gap: 8px; }
	.edit-form { display: flex; flex-direction: column; gap: 8px; }

	input[type="text"], input[type="email"], input[type="password"] {
		height: 44px; padding: 0 12px; border-radius: 8px;
		border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 15px; font-family: inherit; color: var(--ink);
		outline: none; width: 100%; box-sizing: border-box;
	}
	input::placeholder { color: var(--ink-3); }
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input:disabled { opacity: 0.6; cursor: not-allowed; }

	/* Buttons */
	.btn-row { display: flex; gap: 10px; flex-wrap: wrap; }
	.btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
	.btn-save {
		height: 36px; padding: 0 14px; border-radius: 7px;
		background: var(--accent); color: #fff;
		font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
	}
	.btn-save:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-cancel {
		height: 36px; padding: 0 14px; border-radius: 7px;
		border: 1px solid var(--line-strong);
		font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
		color: var(--ink);
	}
	.btn-cancel:hover { background: var(--subtle); }
	.btn-secondary {
		height: 38px; padding: 0 14px; border-radius: 7px;
		border: 1px solid var(--line); background: var(--surface);
		font-size: 14px; cursor: pointer; font-family: inherit;
		color: var(--ink); align-self: flex-start;
	}
	.btn-secondary:hover { background: var(--subtle); }
	.btn-action {
		font-size: 14px; font-weight: 500; color: var(--accent-ink);
		cursor: pointer; font-family: inherit;
		text-underline-offset: 3px;
	}
	.btn-action:hover { text-decoration: underline; }
	.btn-danger-sm {
		height: 38px; padding: 0 14px; border-radius: 7px;
		border: 1px solid var(--danger-line);
		background: var(--surface); color: var(--danger-ink);
		font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
		align-self: flex-start;
		white-space: nowrap;
	}
	.btn-danger-sm:hover:not(:disabled) { background: var(--danger-soft); }
	.btn-danger-sm:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Thema-Pills */
	.theme-pills {
		display: flex; gap: 4px; padding: 3px;
		border-radius: 9px; background: var(--subtle); align-self: flex-start;
	}
	.theme-pill {
		height: 32px; padding: 0 14px; border-radius: 7px;
		border: none; font-size: 14px; cursor: pointer; font-family: inherit;
		color: var(--ink-2);
	}
	.theme-pill.active {
		background: var(--surface); color: var(--ink);
		box-shadow: 0 1px 3px rgb(15 23 42 / .1);
	}

	/* Klassen-Info */
	.class-row {
		display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
	}
	.class-name { margin: 0; font-weight: 600; font-size: 15px; }
	.class-sub { margin: 2px 0 0; font-size: 13px; color: var(--ink-3); }
	.leave-confirm {
		padding: 14px 16px; border-radius: 10px;
		background: var(--danger-soft);
		display: flex; flex-direction: column; gap: 10px;
		font-size: 14px; line-height: 1.5; color: var(--danger-ink);
	}
	.leave-confirm p { margin: 0; }
	.link { color: var(--accent-ink); font-weight: 500; }

	/* Dialog */
	.overlay {
		position: fixed; inset: 0;
		background: rgb(15 23 42 / .5);
		display: grid; place-items: center; z-index: 40;
	}
	.dialog {
		width: 460px; max-width: calc(100vw - 32px);
		display: flex; flex-direction: column; gap: 12px;
		padding: 24px; border-radius: 14px;
		background: var(--surface);
		box-shadow: 0 12px 32px -12px rgb(15 23 42 / .28);
	}
	.dialog h2 { font-size: 18px; line-height: 1.4; font-weight: 600; margin: 0; }
	.dialog-body { font-size: 15px; line-height: 1.55; color: var(--ink-2); margin: 0; }
	.dialog-input {
		height: 44px; padding: 0 12px; border-radius: 8px;
		border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 15px; font-family: inherit; color: var(--ink);
		outline: none; width: 100%; box-sizing: border-box;
	}
	.dialog-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	.dialog-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
	.btn-dialog-cancel {
		height: 40px; padding: 0 16px; border-radius: 7px;
		border: 1px solid var(--line-strong);
		font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit;
	}
	.btn-dialog-cancel:hover { background: var(--subtle); }
	.btn-dialog-delete {
		height: 40px; padding: 0 16px; border-radius: 7px;
		background: var(--danger); color: #fff;
		font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit;
	}
	.btn-dialog-delete:hover:not(:disabled) { opacity: 0.85; }
	.btn-dialog-delete:disabled { opacity: 0.5; cursor: not-allowed; }

	@media print {
		:global(body *) { visibility: hidden; }
		.code-val { visibility: visible; position: absolute; top: 40px; left: 40px; right: 40px; }
	}

	@media (max-width: 640px) {
		.main { padding: 16px 12px 48px; }
		.section { padding: 16px; }
		.dl-grid { grid-template-columns: 1fr; gap: 6px; }
		dt { color: var(--ink-3); font-size: 13px; }
		.val-row { flex-direction: column; align-items: flex-start; gap: 6px; }
	}
</style>
