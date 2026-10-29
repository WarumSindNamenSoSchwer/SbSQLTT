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
		if (dangerConfirm.trim().toUpperCase() !== dangerWord) { dangerErr = `Bitte tippe ${dangerWord}.`; return; }
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
</script>

<svelte:head><title>Profil · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if toast}
		<div class="toast" role="status"><span class="toast-ok">✓</span>{toast}</div>
	{/if}

	<main class="main">
		<div class="content">
			<h1>Profil</h1>

			{#if shownCode}
				<div class="code-box" role="status">
					<span class="code-title">Ihr neuer Wiederherstellungscode</span>
					<span class="code-val mono">{shownCode}</span>
					<span class="code-hint">Bitte notieren oder ausdrucken. Tabula kennt diesen Code nicht und kann ihn nicht wiederherstellen.</span>
					<div class="edit-btns">
						<button class="btn-cancel" onclick={() => window.print()}>Drucken</button>
						<button class="btn-save" onclick={() => (shownCode = null)}>Notiert</button>
					</div>
				</div>
			{/if}

			{#if session.teacher && session.needsKeyRecovery}
				<div class="recover-box" role="alert">
					<span class="code-title">Namen Ihrer Schüler wiederherstellen</span>
					<p class="code-hint">Ihr Passwort wurde zurückgesetzt. Die Namen Ihrer Schüler sind verschlüsselt und nur mit Ihrem Wiederherstellungscode wieder lesbar.</p>
					<form class="profile-edit-form full" onsubmit={recoverWithCode}>
						<input type="text" autocomplete="off" spellcheck="false" placeholder="Wiederherstellungscode (8 Wörter)" disabled={recBusy} bind:value={recCode} />
						<input type="password" autocomplete="current-password" placeholder="Ihr neues Passwort" disabled={recBusy} bind:value={recPw} />
						{#if recErr}<span class="field-err">{recErr}</span>{/if}
						<div class="edit-btns">
							<button type="submit" class="btn-save" disabled={recBusy}>{recBusy ? 'Wird geprüft …' : 'Wiederherstellen'}</button>
							<button type="button" class="btn-cancel" disabled={recBusy} onclick={startFresh}>Ich habe keinen Code</button>
						</div>
						<span class="code-hint">Ohne Code: Sie bekommen einen neuen Schlüssel. Fortschritt und Klassen bleiben, die Namen erscheinen wieder, sobald sich Ihre Schüler das nächste Mal anmelden.</span>
					</form>
				</div>
			{/if}

			{#if session.user}
				<div class="profile-head">
					<span class="avatar">{initials()}</span>
					<div class="head-text">
						<span class="head-name">{session.displayName}</span>
						<span class="head-sub">{session.teacher ? 'Lehrkraft' : `Schüler in ${session.student?.class?.name ?? ''}`}</span>
					</div>
				</div>

				<div class="profile-table">
					<!-- Name -->
					<div class="profile-row">
						<span class="profile-key">Name</span>
						{#if editing === 'name'}
							<form class="profile-edit-form" onsubmit={session.teacher ? saveTeacherName : saveStudentName}>
								<input type="text" autocomplete="off" disabled={busy} bind:value={fName} />
								{#if session.student}
									<input type="password" autocomplete="current-password" placeholder="Dein Passwort" disabled={busy} bind:value={curPw} />
									<span class="code-hint">Du meldest dich danach mit dem neuen Namen an. Deine Lehrkraft sieht ihn sofort.</span>
								{/if}
								{#if err}<span class="field-err">{err}</span>{/if}
								<div class="edit-btns">
									<button type="submit" class="btn-save" disabled={busy}>{busy ? 'Speichern …' : 'Speichern'}</button>
									<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
								</div>
							</form>
						{:else}
							<span class="profile-val">{session.displayName}</span>
							<button class="profile-action" onclick={() => startEdit('name')}>Ändern</button>
						{/if}
					</div>

					{#if session.teacher}
						<div class="profile-row">
							<span class="profile-key">E-Mail</span>
							<span class="profile-val">{session.teacher.email}</span>
							<span class="profile-action-placeholder"></span>
						</div>
						<div class="profile-row">
							<span class="profile-key">Schule</span>
							{#if editing === 'school'}
								<form class="profile-edit-form" onsubmit={saveSchool}>
									<input type="text" autocomplete="organization" disabled={busy} bind:value={fSchool} />
									{#if err}<span class="field-err">{err}</span>{/if}
									<div class="edit-btns">
										<button type="submit" class="btn-save" disabled={busy}>Speichern</button>
										<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
									</div>
								</form>
							{:else}
								<span class="profile-val">{session.teacher.school ?? 'Nicht angegeben'}</span>
								<button class="profile-action" onclick={() => startEdit('school')}>Ändern</button>
							{/if}
						</div>
					{:else if session.student?.class}
						<div class="profile-row">
							<span class="profile-key">Klasse</span>
							<span class="profile-val">{session.student.class.name} · {session.student.class.teacher_name}</span>
							<span class="profile-action-placeholder"></span>
						</div>
						<div class="profile-row">
							<span class="profile-key">Klassencode</span>
							<span class="profile-val mono">{session.student.class.code}</span>
							<span class="profile-action-placeholder"></span>
						</div>
					{/if}

					<!-- Passwort -->
					<div class="profile-row" class:no-border={!session.teacher}>
						<span class="profile-key">Passwort</span>
						{#if editing === 'password'}
							<form class="profile-edit-form" onsubmit={session.teacher ? saveTeacherPassword : saveStudentPassword}>
								<input type="password" autocomplete="current-password" placeholder="Aktuelles Passwort" disabled={busy} bind:value={curPw} />
								<input type="password" autocomplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)" disabled={busy} bind:value={newPw} />
								<input type="password" autocomplete="new-password" placeholder="Neues Passwort wiederholen" disabled={busy} bind:value={newPw2} />
								{#if err}<span class="field-err">{err}</span>{/if}
								<div class="edit-btns">
									<button type="submit" class="btn-save" disabled={busy}>{busy ? 'Speichern …' : 'Speichern'}</button>
									<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
								</div>
							</form>
						{:else}
							<span class="profile-val">••••••••</span>
							<button class="profile-action" onclick={() => startEdit('password')}>Ändern</button>
						{/if}
					</div>

					{#if session.teacher}
						<div class="profile-row no-border">
							<span class="profile-key">Wiederherstellungscode</span>
							{#if editing === 'recovery'}
								<form class="profile-edit-form" onsubmit={newRecovery}>
									<input type="password" autocomplete="current-password" placeholder="Ihr Passwort" disabled={busy} bind:value={curPw} />
									<span class="code-hint">Erzeugt einen neuen Code. Der alte gilt danach nicht mehr.</span>
									{#if err}<span class="field-err">{err}</span>{/if}
									<div class="edit-btns">
										<button type="submit" class="btn-save" disabled={busy}>Neuen Code erzeugen</button>
										<button type="button" class="btn-cancel" onclick={() => (editing = null)}>Abbrechen</button>
									</div>
								</form>
							{:else}
								<span class="profile-val">Nur bei Ihnen</span>
								<button class="profile-action" onclick={() => startEdit('recovery')}>Neu erzeugen</button>
							{/if}
						</div>
					{/if}
				</div>

				<p class="privacy">
					{#if session.teacher}
						Die Namen Ihrer Schüler entschlüsselt nur Ihr Browser. Tabula selbst kennt sie nicht.
					{:else}
						Dein Name und dein Passwort sind nur auf diesem Gerät. Tabula speichert eine Nummer und deinen Fortschritt, deinen Namen kann nur deine Lehrkraft lesen.
					{/if}
				</p>

				<div class="section-gap">
					<button class="btn-logout" onclick={async () => { await sessionLogout(); goto('/login'); }}>Abmelden</button>
				</div>

				<div class="danger-box">
					<div class="danger-text">
						<span class="danger-title">{session.teacher ? 'Konto löschen' : 'Aus der Klasse austreten'}</span>
						<span class="danger-sub">{session.teacher ? 'Konto, alle Klassen und alle Daten Ihrer Schüler werden sofort gelöscht.' : 'Dein Fortschritt in der Klasse wird sofort gelöscht.'}</span>
					</div>
					<button class="btn-danger" onclick={() => (dangerOpen = true)}>{session.teacher ? 'Konto löschen' : 'Austreten'}</button>
				</div>
			{/if}
		</div>
	</main>

	{#if dangerOpen}
		<div class="overlay" role="presentation">
			<div role="dialog" aria-modal="true" aria-label={session.teacher ? 'Konto löschen' : 'Austreten'} class="dialog">
				<h2>{session.teacher ? 'Konto wirklich löschen?' : 'Wirklich austreten?'}</h2>
				<p class="dialog-body">Das lässt sich nicht rückgängig machen. Tippe zur Bestätigung <strong>{dangerWord}</strong>.</p>
				<input type="text" class="dialog-input" autocomplete="off" placeholder={dangerWord} disabled={dangerBusy} bind:value={dangerConfirm} />
				{#if session.teacher}
					<label class="dialog-body" for="danger-pw">Ihr Passwort</label>
					<input id="danger-pw" type="password" class="dialog-input" autocomplete="current-password" disabled={dangerBusy} bind:value={dangerPw} />
				{/if}
				{#if dangerErr}<span class="field-err">{dangerErr}</span>{/if}
				<div class="dialog-btns">
					<button class="btn-dialog-cancel" onclick={() => { dangerOpen = false; dangerConfirm = ''; dangerPw = ''; dangerErr = null; }} disabled={dangerBusy}>Abbrechen</button>
					<button class="btn-dialog-delete" onclick={confirmDanger} disabled={dangerBusy || dangerConfirm.trim().toUpperCase() !== dangerWord || (!!session.teacher && !dangerPw)}>
						{dangerBusy ? 'Bitte warten …' : session.teacher ? 'Endgültig löschen' : 'Austreten'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; position: relative; }
	.main { flex: 1; display: flex; justify-content: center; padding: 44px 40px 80px; }
	.content { width: 100%; max-width: 720px; display: flex; flex-direction: column; gap: 24px; }
	h1 { font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; margin: 0; }

	/* Toast */
	.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 50; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 18px; border-radius: 10px; background: #0f172a; color: #fff; font-size: 14px; font-weight: 500; box-shadow: 0 12px 32px -12px rgb(15 23 42 / .28); white-space: nowrap; }
	.toast-ok { color: #4ade80; }

	/* Profil-Tabelle */
	.profile-table { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.profile-row { display: grid; grid-template-columns: 200px minmax(0, 1fr) auto; align-items: center; gap: 16px; min-height: 56px; padding: 0 20px; border-bottom: 1px solid var(--line); }
	.profile-row.no-border { border-bottom: none; }
	.profile-key { font-size: 14px; color: var(--ink-2); }
	.profile-val { font-size: 15px; }
	.profile-action { font-size: 14px; font-weight: 500; color: var(--accent-strong); cursor: pointer; font-family: inherit; text-align: right; white-space: nowrap; }
	.profile-action:hover { text-decoration: underline; }
	.profile-action-placeholder { width: 44px; }
	.mono { font-family: var(--mono, 'IBM Plex Mono', monospace); }

	.profile-edit-form { grid-column: 2 / 4; display: flex; flex-direction: column; gap: 8px; padding: 12px 0; }
	input { height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 15px; font-family: inherit; color: var(--ink); outline: none; width: 100%; box-sizing: border-box; }
	input::placeholder { color: var(--ink-3); }
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input:disabled { opacity: 0.6; cursor: not-allowed; }
	.field-err { font-size: 13px; color: var(--danger-ink); }
	.edit-btns { display: flex; gap: 10px; }
	.btn-save { height: 36px; padding: 0 14px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-save:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-cancel { height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line-strong); font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-cancel:hover { background: var(--subtle) !important; }

	/* Sonstiges */
	.section-gap { display: flex; flex-direction: column; gap: 6px; }
	.btn-logout { height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--line-strong); font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; align-self: flex-start; }
	.btn-logout:hover { background: var(--subtle) !important; }

	/* Danger */
	.danger-box { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border: 1px solid var(--danger-line); border-radius: 10px; }
	.danger-text { flex: 1; display: flex; flex-direction: column; }
	.danger-title { font-size: 15px; font-weight: 600; color: var(--danger-ink); }
	.danger-sub { font-size: 14px; color: var(--ink-2); }
	.btn-danger { height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--danger); color: var(--danger-ink); font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; white-space: nowrap; }
	.btn-danger:hover { background: var(--danger-soft) !important; }

	/* Dialog */
	.overlay { position: fixed; inset: 0; background: rgb(15 23 42 / .5); display: grid; place-items: center; z-index: 40; }
	.dialog { width: 460px; max-width: calc(100vw - 32px); display: flex; flex-direction: column; gap: 12px; padding: 24px; border-radius: 10px; background: var(--surface); box-shadow: 0 12px 32px -12px rgb(15 23 42 / .28); }
	h2 { font-size: 18px; line-height: 26px; font-weight: 600; margin: 0; }
	.dialog-body { font-size: 15px; line-height: 23px; color: var(--ink-2); margin: 0; }
	.dialog-input { height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 15px; font-family: monospace; color: var(--ink); outline: none; width: 100%; box-sizing: border-box; }
	.dialog-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	.dialog-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
	.btn-dialog-cancel { height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--line-strong); font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-dialog-cancel:hover { background: var(--subtle) !important; }
	.btn-dialog-delete { height: 40px; padding: 0 16px; border-radius: 6px; background: var(--danger); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-dialog-delete:hover:not(:disabled) { opacity: 0.85; }
	.btn-dialog-delete:disabled { opacity: 0.5; cursor: not-allowed; }


	/* Kopf, Codes, Wiederherstellung */
	.profile-head { display: flex; align-items: center; gap: 14px; }
	.avatar { width: 48px; height: 48px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink); display: grid; place-items: center; font-weight: 600; }
	.head-text { display: flex; flex-direction: column; }
	.head-name { font-size: 18px; font-weight: 600; }
	.head-sub { font-size: 14px; color: var(--ink-2); }
	.code-box, .recover-box { display: flex; flex-direction: column; gap: 8px; padding: 16px 20px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--accent-soft); }
	.recover-box { border-color: var(--warn-line, #fcd34d); background: var(--warn-bg, #fef3c7); }
	.code-title { font-size: 15px; font-weight: 600; }
	.code-val { font-size: 17px; padding: 10px 12px; border-radius: 6px; background: var(--surface); user-select: all; word-break: break-word; }
	.code-hint { font-size: 13px; line-height: 18px; color: var(--ink-2); margin: 0; }
	.profile-edit-form.full { grid-column: auto; padding: 0; }
	.privacy { font-size: 13px; line-height: 18px; color: var(--ink-3); margin: 0; }
	@media print {
		:global(body *) { visibility: hidden; }
		.code-val { visibility: visible; }
		.code-val { position: absolute; top: 40px; left: 40px; right: 40px; }
	}

	@media (max-width: 767px) {
		.main { padding: 24px 16px 48px; }
		.profile-row { grid-template-columns: 1fr auto; gap: 8px; }
		.profile-key { grid-column: 1; font-size: 13px; }
		.profile-val { grid-column: 1; }
		.profile-action { grid-row: 1; grid-column: 2; }
		.profile-edit-form { grid-column: 1 / 3; }
	}
</style>
