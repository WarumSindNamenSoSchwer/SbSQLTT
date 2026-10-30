<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { page } from '$app/state';
	import {
		apiTeacherGetStudents,
		apiTeacherRemoveStudent,
		apiTeacherResetCode,
		type TeacherStudent,
	} from '$lib/tabula/api.js';
	import { session } from '$lib/tabula/session.svelte.js';

	const ctx = getContext<{ cls: any; reload: () => void }>('teachClass');
	let classId = $derived(Number(page.params.id));

	let students = $state<TeacherStudent[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let openMenuId = $state<number | null>(null);

	// Inline-Bestätigung "Entfernen"
	let askRemoveId = $state<number | null>(null);
	let removeBusy = $state(false);
	let removeErr = $state<string | null>(null);

	// Einmal-Code Dialog
	type ResetDialog = { student: TeacherStudent; code: string | null; expires: number; busy: boolean; err: string | null };
	let resetDialog = $state<ResetDialog | null>(null);
	let now = $state(Math.floor(Date.now() / 1000));

	onMount(() => {
		loadStudents();
		document.addEventListener('click', closeMenuOnOutside);
		document.addEventListener('keydown', onKeydown);
		const t = setInterval(() => (now = Math.floor(Date.now() / 1000)), 1000);
		return () => {
			document.removeEventListener('click', closeMenuOnOutside);
			document.removeEventListener('keydown', onKeydown);
			clearInterval(t);
		};
	});

	function closeMenuOnOutside(e: MouseEvent) {
		if (!(e.target as Element).closest('.student-menu-wrap')) {
			openMenuId = null;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') openMenuId = null;
	}

	async function loadStudents() {
		loading = true;
		try {
			students = (await apiTeacherGetStudents(classId)).students;
		} catch {
			students = [];
		} finally {
			loading = false;
		}
	}

	const filteredStudents = $derived(
		searchQuery.trim()
			? students.filter((s) => s.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
			: students
	);

	function fmtDate(ts: number | null): string {
		if (!ts) return '–';
		return new Date(ts * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
	}

	function openMenu(e: MouseEvent, id: number) {
		e.stopPropagation();
		openMenuId = openMenuId === id ? null : id;
	}

	async function openResetCode(s: TeacherStudent) {
		openMenuId = null;
		resetDialog = { student: s, code: null, expires: 0, busy: true, err: null };
		try {
			const r = await apiTeacherResetCode(classId, s.id);
			if (resetDialog) resetDialog = { ...resetDialog, code: r.code, expires: r.expires_at, busy: false };
		} catch (err) {
			if (resetDialog) resetDialog = { ...resetDialog, err: err instanceof Error ? err.message : 'Fehler.', busy: false };
		}
	}

	function closeReset() { resetDialog = null; }

	function askRemove(s: TeacherStudent) {
		openMenuId = null;
		askRemoveId = s.id;
		removeErr = null;
	}

	async function confirmRemove(id: number) {
		removeBusy = true;
		removeErr = null;
		try {
			await apiTeacherRemoveStudent(classId, id);
			students = students.filter(s => s.id !== id);
			askRemoveId = null;
			ctx?.reload();
		} catch (err) {
			removeErr = err instanceof Error ? err.message : 'Fehler.';
		} finally {
			removeBusy = false;
		}
	}

	const remaining = $derived(resetDialog?.code ? Math.max(0, resetDialog.expires - now) : 0);
	const remainingText = $derived(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`);
</script>

<div class="schueler-wrap">
	{#if session.needsKeyRecovery}
		<div class="key-hint" role="status">
			Die Namen sind gerade nicht lesbar. Stellen Sie im <a href="/profil">Profil</a> Ihren Schlüssel mit dem Wiederherstellungscode wieder her.
		</div>
	{/if}

	<div class="toolbar">
		<p class="toolbar-note">Die Namen sind verschlüsselt gespeichert. Nur Ihr Browser kann sie lesen.</p>
		<div class="search-field">
			<span class="search-ico" aria-hidden="true">⌕</span>
			<input type="search" placeholder="Name suchen" bind:value={searchQuery} aria-label="Name suchen" />
		</div>
	</div>

	{#if loading}
		<div class="spinner-wrap"><span class="spinner"></span></div>
	{:else if filteredStudents.length === 0}
		<div class="empty-state">
			{#if searchQuery.trim()}
				<span>Keine Schüler gefunden für „{searchQuery}".</span>
			{:else}
				<span>Noch niemand beigetreten. Zeigen Sie den Klassencode oder den QR-Code.</span>
			{/if}
		</div>
	{:else}
		<div class="students-table-wrap">
			<table class="students-table">
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">Beigetreten</th>
						<th scope="col" class="th-right">Zuletzt angemeldet</th>
						<th scope="col" aria-label="Aktionen"></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredStudents as s (s.id)}
						<tr class="student-row">
							<td class="td-name">{s.display_name}</td>
							<td class="td-date">{fmtDate(s.joined_at)}</td>
							<td class="td-date td-right">{fmtDate(s.last_login_at)}</td>
							<td class="td-actions">
								{#if askRemoveId === s.id}
									<!-- Inline-Bestätigung -->
									<span class="confirm-text">Wirklich entfernen?</span>
									{#if removeErr}<span class="err-text">{removeErr}</span>{/if}
									<button class="btn-cancel" onclick={() => { askRemoveId = null; removeErr = null; }} disabled={removeBusy}>Nein</button>
									<button class="btn-remove-confirm" onclick={() => confirmRemove(s.id)} disabled={removeBusy}>
										{removeBusy ? '…' : 'Entfernen'}
									</button>
								{:else}
									<div class="student-menu-wrap">
										<button
											class="menu-btn"
											aria-label="Aktionen für {s.display_name}"
											aria-haspopup="menu"
											aria-expanded={openMenuId === s.id}
											onclick={(e) => openMenu(e, s.id)}
										>⋯</button>
										{#if openMenuId === s.id}
											<div class="student-menu" role="menu">
												<button role="menuitem" onclick={() => openResetCode(s)}>Passwort vergessen: Code erzeugen</button>
												<button role="menuitem" class="danger" onclick={() => askRemove(s)}>Aus Klasse entfernen</button>
											</div>
										{/if}
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="privacy-note">Die Namen entschlüsselt nur Ihr Browser. Schüler ändern ihren Namen selbst im Profil.</p>
	{/if}
</div>

<!-- Einmal-Code Dialog -->
{#if resetDialog}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="dialog-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeReset(); }}>
		<div role="dialog" aria-modal="true" class="dialog-box" aria-label="Einmal-Code">
			<h2 class="dialog-title">Einmal-Code für {resetDialog.student.display_name}</h2>
			<p class="dialog-body">
				{resetDialog.student.display_name} geht auf „Anmelden" → „Passwort vergessen?" und gibt Klassencode, Namen und diesen Code ein.
				Danach legt {resetDialog.student.display_name} selbst ein neues Passwort fest. Der Fortschritt bleibt erhalten.
			</p>
			{#if resetDialog.busy}
				<div class="spinner-wrap"><span class="spinner"></span></div>
			{:else if resetDialog.code}
				<div class="pw-display">
					<span class="pw-text mono">{resetDialog.code}</span>
				</div>
				<p class="pw-hint">{remaining > 0 ? `Gültig noch ${remainingText} Minuten, nur einmal.` : 'Abgelaufen. Bitte neuen Code erzeugen.'}</p>
			{/if}
			{#if resetDialog.err}<div class="dialog-error">{resetDialog.err}</div>{/if}
			<div class="dialog-actions">
				{#if remaining === 0 && resetDialog.code && !resetDialog.busy}
					<button class="btn-secondary" onclick={() => { if (resetDialog) openResetCode(resetDialog.student); }}>Neuer Code</button>
				{/if}
				<button class="btn-primary" onclick={closeReset}>Fertig</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.key-hint { padding: 12px 16px; border-radius: 10px; background: var(--warn-bg, #fef3c7); color: var(--warn-ink, #92400e); font-size: 14px; line-height: 20px; }
	.key-hint a { color: inherit; text-decoration: underline; font-weight: 500; }

	.schueler-wrap { padding: 20px clamp(16px,3vw,40px); display: flex; flex-direction: column; gap: 14px; }

	.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.toolbar-note { flex: 1; font-size: 14px; color: var(--ink-2); margin: 0; line-height: 1.5; min-width: 220px; }
	.search-field { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; color: var(--ink-3); max-width: 280px; flex: 1; }
	.search-field input { background: none; border: none; outline: none; font: inherit; color: var(--ink); flex: 1; }

	.spinner-wrap { display: grid; place-items: center; padding: 60px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	.empty-state { padding: 40px; text-align: center; color: var(--ink-2); font-size: 15px; border: 1px dashed var(--line-strong); border-radius: 14px; }

	/* Tabelle */
	.students-table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
	.students-table { width: 100%; min-width: 540px; border-collapse: collapse; font-size: 14px; }
	.students-table thead { background: var(--subtle); }
	.students-table th { text-align: left; padding: 10px 18px; font: 500 12px/1 var(--mono); letter-spacing: 0.06em; color: var(--ink-3); border-bottom: 1px solid var(--line); }
	.th-right { text-align: right; }
	.student-row td { padding: 10px 18px; border-bottom: 1px solid var(--line); vertical-align: middle; }
	.student-row:last-child td { border-bottom: none; }
	.td-name { font-weight: 500; }
	.td-date { color: var(--ink-2); }
	.td-right { text-align: right; }
	.td-actions { text-align: right; white-space: nowrap; padding: 6px 12px; }
	.privacy-note { font-size: 13px; color: var(--ink-3); margin: 0; }

	/* Inline-Bestätigung */
	.confirm-text { font-size: 13px; color: var(--danger-ink); margin-right: 6px; }
	.err-text { font-size: 13px; color: var(--danger-ink); margin-right: 6px; }
	.btn-cancel { height: 30px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font-size: 13px; cursor: pointer; margin-right: 4px; font-family: inherit; }
	.btn-cancel:hover:not(:disabled) { background: var(--subtle); }
	.btn-remove-confirm { height: 30px; padding: 0 10px; border: 0; border-radius: 6px; background: var(--danger); color: #fff; font-size: 13px; cursor: pointer; font-family: inherit; }
	.btn-remove-confirm:disabled { opacity: 0.6; cursor: default; }

	/* Menü – click-gesteuert */
	.student-menu-wrap { position: relative; display: inline-block; }
	.menu-btn { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 6px; color: var(--ink-3); cursor: pointer; font-size: 16px; font-family: inherit; }
	.menu-btn:hover { background: var(--subtle); color: var(--ink); }
	.student-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 10; width: 260px; display: flex; flex-direction: column; padding: 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-pop); font-size: 14px; }
	.student-menu button { padding: 8px 10px; border-radius: 6px; text-align: left; cursor: pointer; font-family: inherit; font-size: 14px; }
	.student-menu button:hover { background: var(--subtle); }
	.student-menu button.danger { color: var(--danger-ink); }

	/* Dialog */
	.dialog-overlay { position: fixed; inset: 0; background: rgb(15 23 42 / 0.5); z-index: 50; display: grid; place-items: center; padding: 20px; }
	.dialog-box { box-sizing: border-box; background: var(--surface); border-radius: 14px; box-shadow: var(--shadow-pop); padding: 28px; display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 480px; }
	.dialog-title { font-size: 18px; font-weight: 600; margin: 0; }
	.dialog-body { font-size: 15px; line-height: 23px; color: var(--ink-2); margin: 0; }
	.dialog-error { padding: 10px 12px; border-radius: 6px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

	.pw-display { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; background: var(--subtle); }
	.pw-text { font-family: var(--mono); font-size: 24px; font-weight: 500; letter-spacing: 3px; flex: 1; }
	.mono { font-family: var(--mono); }
	.pw-hint { font-size: 13px; color: var(--ink-3); margin: 0; }

	.btn-primary { display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 16px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-secondary { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-secondary:hover:not(:disabled) { background: var(--subtle); }
</style>
