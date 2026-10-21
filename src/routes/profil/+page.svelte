<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { session, sessionLogout } from '$lib/tabula/session.svelte.js';
	import { apiPatchMe, apiDeleteMe, apiChangePassword, ApiError } from '$lib/tabula/api.js';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';

	let dark = $state(false);

	// ---- Felder bearbeiten ---------------------------------------------------
	type EditField = 'display_name' | 'username' | 'password' | null;
	let editing = $state<EditField>(null);

	// Anzeigename
	let newDisplayName = $state('');
	let displayNameErr = $state<string | null>(null);
	let displayNameBusy = $state(false);

	// Benutzername
	let newUsername = $state('');
	let usernamePassword = $state('');
	let usernameErr = $state<string | null>(null);
	let usernameBusy = $state(false);

	// Passwort
	let currentPw = $state('');
	let newPw = $state('');
	let newPwRepeat = $state('');
	let passwordErr = $state<string | null>(null);
	let passwordBusy = $state(false);
	/** Nach Passwort-Reset durch Lehrkraft: Änderung erzwingen */
	let mustChange = $state(false);

	// Konto löschen
	let deleteOpen = $state(false);
	let deleteConfirmUsername = $state('');
	let deleteBusy = $state(false);
	let deleteErr = $state<string | null>(null);

	// Toast
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

		// Warten bis Session geladen, dann prüfen ob angemeldet
		const checkAuth = () => {
			if (!ACCOUNTS_LIVE) { goto('/'); return; }
			if (session.loading) {
				// Noch am Laden: kurz warten und erneut prüfen
				setTimeout(checkAuth, 50);
				return;
			}
			if (!session.user) {
				goto('/login?redirect=/profil');
				return;
			}
			if (session.user.must_change_password || new URLSearchParams(location.search).has('pw')) {
				mustChange = !!session.user.must_change_password;
				startEdit('password');
			}
		};
		checkAuth();

		return () => mo.disconnect();
	});

	function startEdit(field: EditField) {
		editing = field;
		displayNameErr = null;
		usernameErr = null;
		passwordErr = null;
		if (field === 'display_name') newDisplayName = session.user?.display_name ?? '';
		if (field === 'username') { newUsername = session.user?.username ?? ''; usernamePassword = ''; }
		if (field === 'password') { currentPw = ''; newPw = ''; newPwRepeat = ''; }
	}

	function cancelEdit() {
		editing = null;
	}

	// ---- Anzeigename speichern -----------------------------------------------
	async function saveDisplayName(e: Event) {
		e.preventDefault();
		if (!newDisplayName.trim()) {
			displayNameErr = 'Bitte gib einen Anzeigenamen ein.';
			return;
		}
		displayNameBusy = true;
		displayNameErr = null;
		try {
			await apiPatchMe({ display_name: newDisplayName.trim() });
			// Session-User aktualisieren
			if (session.user) {
				(session.user as { display_name: string }).display_name = newDisplayName.trim();
			}
			editing = null;
			showToast('Anzeigename gespeichert.');
		} catch (err) {
			displayNameErr = err instanceof Error ? err.message : 'Fehler beim Speichern.';
		} finally {
			displayNameBusy = false;
		}
	}

	// ---- Benutzername speichern ----------------------------------------------
	async function saveUsername(e: Event) {
		e.preventDefault();
		if (!newUsername.trim()) {
			usernameErr = 'Bitte gib einen Benutzernamen ein.';
			return;
		}
		if (!usernamePassword) {
			usernameErr = 'Aktuelles Passwort erforderlich.';
			return;
		}
		usernameBusy = true;
		usernameErr = null;
		try {
			await apiPatchMe({ username: newUsername.trim(), current_password: usernamePassword });
			if (session.user) {
				(session.user as { username: string }).username = newUsername.trim();
			}
			editing = null;
			showToast('Benutzername gespeichert.');
		} catch (err) {
			usernameErr = err instanceof Error ? err.message : 'Fehler beim Speichern.';
		} finally {
			usernameBusy = false;
		}
	}

	// ---- Passwort ändern -----------------------------------------------------
	async function savePassword(e: Event) {
		e.preventDefault();
		if (!currentPw) { passwordErr = 'Bitte gib dein aktuelles Passwort ein.'; return; }
		if (newPw.length < 8) { passwordErr = 'Neues Passwort muss mindestens 8 Zeichen haben.'; return; }
		if (newPw !== newPwRepeat) { passwordErr = 'Passwörter stimmen nicht überein.'; return; }
		passwordBusy = true;
		passwordErr = null;
		try {
			await apiChangePassword(currentPw, newPw);
			if (session.user) (session.user as { must_change_password?: number }).must_change_password = 0;
			mustChange = false;
			editing = null;
			showToast('Passwort geändert. Andere Geräte wurden abgemeldet.');
		} catch (err) {
			passwordErr = err instanceof Error ? err.message : 'Fehler.';
		} finally {
			passwordBusy = false;
		}
	}

	// ---- Konto löschen -------------------------------------------------------
	async function confirmDelete() {
		if (deleteConfirmUsername !== session.user?.username) {
			deleteErr = 'Benutzername stimmt nicht überein.';
			return;
		}
		deleteBusy = true;
		deleteErr = null;
		try {
			await apiDeleteMe();
			await sessionLogout().catch(() => {});
			goto('/login');
		} catch (err) {
			deleteErr = err instanceof Error ? err.message : 'Fehler beim Löschen.';
		} finally {
			deleteBusy = false;
		}
	}

	// Avatar-Initialen
	const initials = $derived(() => {
		const u = session.user;
		if (!u) return '';
		const parts = u.display_name.trim().split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		return parts[0].slice(0, 2).toUpperCase();
	});
</script>

<svelte:head><title>Profil · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<!-- Toast -->
	{#if toast}
		<div class="toast" role="status">
			<span class="toast-ok">✓</span>{toast}
		</div>
	{/if}

	<main class="main">
		<div class="content">
			<h1>Profil</h1>

			{#if mustChange}
				<p class="must-change" role="alert">Deine Lehrkraft hat dein Passwort zurückgesetzt. Bitte wähle jetzt ein eigenes neues Passwort. Als aktuelles Passwort gibst du das Einmal-Passwort ein.</p>
			{/if}

			{#if session.user}
				<!-- Profil-Tabelle -->
				<div class="profile-table">
					<!-- Anzeigename -->
					<div class="profile-row">
						{#if editing === 'display_name'}
							<span class="profile-key">Anzeigename</span>
							<form class="profile-edit-form" onsubmit={saveDisplayName}>
								<input
									type="text"
									autocomplete="name"
									placeholder="Anzeigename"
									disabled={displayNameBusy}
									bind:value={newDisplayName}
								/>
								{#if displayNameErr}<span class="field-err">{displayNameErr}</span>{/if}
								<div class="edit-btns">
									<button type="submit" class="btn-save" disabled={displayNameBusy}>
										{displayNameBusy ? 'Speichern …' : 'Speichern'}
									</button>
									<button type="button" class="btn-cancel" onclick={cancelEdit}>Abbrechen</button>
								</div>
							</form>
						{:else}
							<span class="profile-key">Anzeigename</span>
							<span class="profile-val">{session.user.display_name}</span>
							<button class="profile-action" onclick={() => startEdit('display_name')}>Ändern</button>
						{/if}
					</div>

					<!-- Benutzername -->
					<div class="profile-row">
						{#if editing === 'username'}
							<span class="profile-key">Benutzername</span>
							<form class="profile-edit-form" onsubmit={saveUsername}>
								<input
									type="text"
									autocomplete="username"
									placeholder="Benutzername"
									disabled={usernameBusy}
									bind:value={newUsername}
								/>
								<input
									type="password"
									autocomplete="current-password"
									placeholder="Aktuelles Passwort erforderlich"
									disabled={usernameBusy}
									bind:value={usernamePassword}
								/>
								{#if usernameErr}<span class="field-err">{usernameErr}</span>{/if}
								<div class="edit-btns">
									<button type="submit" class="btn-save" disabled={usernameBusy}>
										{usernameBusy ? 'Speichern …' : 'Speichern'}
									</button>
									<button type="button" class="btn-cancel" onclick={cancelEdit}>Abbrechen</button>
								</div>
							</form>
						{:else}
							<span class="profile-key">Benutzername</span>
							<span class="profile-val mono">{session.user.username}</span>
							<button class="profile-action" onclick={() => startEdit('username')}>Ändern</button>
						{/if}
					</div>

					<!-- E-Mail -->
					<div class="profile-row">
						<span class="profile-key">E-Mail</span>
						<span class="profile-val">{session.user.email ?? 'Nicht hinterlegt'}</span>
						<span class="profile-action-placeholder"></span>
					</div>

					<!-- Passwort -->
					<div class="profile-row no-border">
						{#if editing === 'password'}
							<span class="profile-key">Passwort</span>
							<form class="profile-edit-form" onsubmit={savePassword}>
								<input
									type="password"
									autocomplete="current-password"
									placeholder="Aktuelles Passwort"
									disabled={passwordBusy}
									bind:value={currentPw}
								/>
								<input
									type="password"
									autocomplete="new-password"
									placeholder="Neues Passwort (mind. 8 Zeichen)"
									disabled={passwordBusy}
									bind:value={newPw}
								/>
								<input
									type="password"
									autocomplete="new-password"
									placeholder="Neues Passwort wiederholen"
									disabled={passwordBusy}
									bind:value={newPwRepeat}
								/>
								{#if passwordErr}<span class="field-err">{passwordErr}</span>{/if}
								<div class="edit-btns">
									<button type="submit" class="btn-save" disabled={passwordBusy}>
										{passwordBusy ? 'Speichern …' : 'Speichern'}
									</button>
									<button type="button" class="btn-cancel" onclick={cancelEdit}>Abbrechen</button>
								</div>
							</form>
						{:else}
							<span class="profile-key">Passwort</span>
							<span class="profile-val">••••••••</span>
							<button class="profile-action" onclick={() => startEdit('password')}>Ändern</button>
						{/if}
					</div>
				</div>

				<!-- Klasse beitreten Link -->
				<div class="section-gap">
					<a href="/beitreten" class="link-accent">+ Klasse beitreten</a>
				</div>

				<!-- Abmelden -->
				<div class="section-gap">
					<button class="btn-logout" onclick={async () => { await sessionLogout(); goto('/login'); }}>
						Abmelden
					</button>
				</div>

				<!-- Konto löschen -->
				<div class="danger-box">
					<div class="danger-text">
						<span class="danger-title">Konto löschen</span>
						<span class="danger-sub">Konto, Fortschritt und Klassenzugehörigkeit werden endgültig gelöscht.</span>
					</div>
					<button class="btn-danger" onclick={() => (deleteOpen = true)}>Konto löschen</button>
				</div>
			{/if}
		</div>
	</main>

	<!-- Dialog: Konto löschen -->
	{#if deleteOpen}
		<div class="overlay" role="presentation">
			<div role="dialog" aria-modal="true" aria-label="Konto löschen" class="dialog">
				<h2>Konto wirklich löschen?</h2>
				<p class="dialog-body">Das lässt sich nicht rückgängig machen. Gib zur Bestätigung deinen Benutzernamen ein.</p>
				<input
					type="text"
					class="dialog-input"
					autocomplete="off"
					placeholder={session.user?.username ?? ''}
					disabled={deleteBusy}
					bind:value={deleteConfirmUsername}
				/>
				{#if deleteErr}<span class="field-err">{deleteErr}</span>{/if}
				<div class="dialog-btns">
					<button class="btn-dialog-cancel" onclick={() => { deleteOpen = false; deleteConfirmUsername = ''; deleteErr = null; }} disabled={deleteBusy}>
						Abbrechen
					</button>
					<button
						class="btn-dialog-delete"
						onclick={confirmDelete}
						disabled={deleteBusy || deleteConfirmUsername !== session.user?.username}
					>
						{deleteBusy ? 'Wird gelöscht …' : 'Endgültig löschen'}
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
	.must-change { margin: 0 0 20px; padding: 12px 16px; border-radius: 10px; background: var(--warn-bg, #fef3c7); color: var(--warn-ink, #92400e); font-size: 14px; line-height: 1.5; }
	.edit-btns { display: flex; gap: 10px; }
	.btn-save { height: 36px; padding: 0 14px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-save:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-cancel { height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line-strong); font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-cancel:hover { background: var(--subtle) !important; }

	/* Sonstiges */
	.section-gap { display: flex; flex-direction: column; gap: 6px; }
	.link-accent { font-size: 14px; font-weight: 500; color: var(--accent-strong); text-decoration: none; }
	.link-accent:hover { text-decoration: underline; }
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

	@media (max-width: 767px) {
		.main { padding: 24px 16px 48px; }
		.profile-row { grid-template-columns: 1fr auto; gap: 8px; }
		.profile-key { grid-column: 1; font-size: 13px; }
		.profile-val { grid-column: 1; }
		.profile-action { grid-row: 1; grid-column: 2; }
		.profile-edit-form { grid-column: 1 / 3; }
	}
</style>
