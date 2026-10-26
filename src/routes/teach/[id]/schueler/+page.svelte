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

	type Dialog =
		| { type: 'remove'; student: TeacherStudent }
		| { type: 'reset'; student: TeacherStudent; code: string | null; expires: number };

	let dialog = $state<Dialog | null>(null);
	let dialogBusy = $state(false);
	let dialogError = $state<string | null>(null);
	let now = $state(Math.floor(Date.now() / 1000));

	onMount(() => {
		loadStudents();
		document.addEventListener('click', closeMenuOnOutside);
		const t = setInterval(() => (now = Math.floor(Date.now() / 1000)), 1000);
		return () => { document.removeEventListener('click', closeMenuOnOutside); clearInterval(t); };
	});

	function closeMenuOnOutside(e: MouseEvent) {
		if (!(e.target as Element).closest('.student-menu-wrap')) openMenuId = null;
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

	function openRemove(s: TeacherStudent) {
		openMenuId = null;
		dialog = { type: 'remove', student: s };
		dialogError = null;
	}

	async function openReset(s: TeacherStudent) {
		openMenuId = null;
		dialog = { type: 'reset', student: s, code: null, expires: 0 };
		dialogError = null;
		dialogBusy = true;
		try {
			const r = await apiTeacherResetCode(classId, s.id);
			if (dialog?.type === 'reset') dialog = { ...dialog, code: r.code, expires: r.expires_at };
		} catch (err) {
			dialogError = err instanceof Error ? err.message : 'Fehler.';
		} finally {
			dialogBusy = false;
		}
	}

	function closeDialog() {
		dialog = null;
		dialogError = null;
		dialogBusy = false;
	}

	async function confirmRemove() {
		if (dialog?.type !== 'remove') return;
		dialogBusy = true;
		dialogError = null;
		try {
			await apiTeacherRemoveStudent(classId, dialog.student.id);
			const id = dialog.student.id;
			students = students.filter((s) => s.id !== id);
			ctx?.reload();
			closeDialog();
		} catch (err) {
			dialogError = err instanceof Error ? err.message : 'Fehler.';
		} finally {
			dialogBusy = false;
		}
	}

	const remaining = $derived(dialog?.type === 'reset' && dialog.code ? Math.max(0, dialog.expires - now) : 0);
	const remainingText = $derived(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`);
</script>

<div class="schueler-wrap">
	{#if session.needsKeyRecovery}
		<div class="key-hint" role="status">
			Die Namen sind gerade nicht lesbar. Stellen Sie im <a href="/profil">Profil</a> Ihren Schlüssel mit dem Wiederherstellungscode wieder her.
		</div>
	{/if}

	<div class="toolbar">
		<div class="search-field">
			<span class="search-ico" aria-hidden="true">⌕</span>
			<input type="search" placeholder="Name suchen" bind:value={searchQuery} />
		</div>
		<span class="flex-1"></span>
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
		<div class="students-table">
			<div class="table-header">
				<span>NAME</span>
				<span>BEIGETRETEN</span>
				<span>ZULETZT ANGEMELDET</span>
				<span></span>
				<span></span>
			</div>
			{#each filteredStudents as s (s.id)}
				<div class="table-row">
					<span class="row-name">{s.display_name}</span>
					<span class="row-joined">{fmtDate(s.joined_at)}</span>
					<span class="row-joined">{fmtDate(s.last_login_at)}</span>
					<span class="row-progress"></span>
					<span class="student-menu-wrap">
						<button
							class="menu-btn"
							aria-label="Aktionen für {s.display_name}"
							onclick={(e) => { e.stopPropagation(); openMenuId = openMenuId === s.id ? null : s.id; }}
						>⋯</button>
						{#if openMenuId === s.id}
							<div class="student-menu" role="menu">
								<button onclick={() => openReset(s)}>Passwort vergessen: Code erzeugen</button>
								<button class="danger" onclick={() => openRemove(s)}>Aus Klasse entfernen</button>
							</div>
						{/if}
					</span>
				</div>
			{/each}
		</div>
		<p class="privacy-note">Die Namen entschlüsselt nur Ihr Browser. Schüler ändern ihren Namen selbst im Profil.</p>
	{/if}
</div>

{#if dialog}
	<div class="dialog-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
		<div role="dialog" aria-modal="true" class="dialog-box">
			{#if dialog.type === 'remove'}
				<h2 class="dialog-title">Schüler entfernen?</h2>
				<p class="dialog-body">
					<strong>{dialog.student.display_name}</strong> wird aus der Klasse entfernt. Der Fortschritt wird sofort gelöscht.
					Zum Wiedereinsteigen müsste neu beigetreten werden.
				</p>
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					<button class="btn-secondary" onclick={closeDialog} disabled={dialogBusy}>Abbrechen</button>
					<button class="btn-danger" onclick={confirmRemove} disabled={dialogBusy}>{dialogBusy ? 'Wird entfernt …' : 'Entfernen'}</button>
				</div>

			{:else if dialog.type === 'reset'}
				<h2 class="dialog-title">Einmal-Code für {dialog.student.display_name}</h2>
				<p class="dialog-body">
					{dialog.student.display_name} geht auf „Anmelden“ → „Passwort vergessen?“ und gibt Klassencode, Namen und diesen Code ein.
					Danach legt {dialog.student.display_name} selbst ein neues Passwort fest. Der Fortschritt bleibt erhalten.
				</p>
				{#if dialog.code}
					<div class="pw-display">
						<span class="pw-text mono">{dialog.code}</span>
					</div>
					<p class="pw-hint">{remaining > 0 ? `Gültig noch ${remainingText} Minuten, nur einmal.` : 'Abgelaufen. Bitte neuen Code erzeugen.'}</p>
				{:else if dialogBusy}
					<div class="spinner-wrap"><span class="spinner"></span></div>
				{/if}
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					{#if remaining === 0 && dialog.code}
						<button class="btn-secondary" onclick={() => dialog?.type === 'reset' && openReset(dialog.student)} disabled={dialogBusy}>Neuer Code</button>
					{/if}
					<button class="btn-primary" onclick={closeDialog}>Fertig</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.key-hint { padding: 12px 16px; border-radius: 10px; background: var(--warn-bg, #fef3c7); color: var(--warn-ink, #92400e); font-size: 14px; line-height: 20px; }
	.key-hint a { color: inherit; text-decoration: underline; font-weight: 500; }
	.privacy-note { font-size: 13px; color: var(--ink-3); margin: 0; }

	.schueler-wrap { padding: 24px 40px; display: flex; flex-direction: column; gap: 16px; }
	@media (max-width: 767px) { .schueler-wrap { padding: 16px; } }

	.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.search-field { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; color: var(--ink-3); max-width: 320px; flex: 1; }
	.search-field input { background: none; border: none; outline: none; font: inherit; color: var(--ink); flex: 1; }
	.flex-1 { flex: 1; }

	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	.empty-state { padding: 40px; text-align: center; color: var(--ink-2); font-size: 15px; }

	.students-table { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.table-header { border-radius: 10px 10px 0 0; }
	.table-row:last-child { border-radius: 0 0 10px 10px; }
	/* Menü der letzten Zeilen nach oben öffnen, damit es nicht über den Rand läuft */
	.table-row:nth-last-child(-n+2):not(:nth-child(-n+3)) .student-menu { top: auto; bottom: calc(100% + 4px); }
	.table-header { display: grid; grid-template-columns: minmax(0,1fr) 180px 160px 200px 48px; padding: 0 16px; background: var(--subtle); border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3); }
	@media (max-width: 900px) { .table-header { display: none; } }
	.table-header span { padding: 9px 0; }
	.table-row { display: grid; grid-template-columns: minmax(0,1fr) 180px 160px 200px 48px; align-items: center; padding: 0 16px; min-height: 48px; border-bottom: 1px solid var(--line); font-size: 14px; }
	@media (max-width: 900px) { .table-row { grid-template-columns: minmax(0,1fr) 48px; gap: 8px; min-height: 56px; } }
	.table-row:last-child { border-bottom: none; }

	.row-name { font-weight: 500; }
	.row-joined { color: var(--ink-2); }

	.student-menu-wrap { position: relative; display: flex; justify-content: center; }
	.menu-btn { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 6px; color: var(--ink-3); cursor: pointer; font-size: 16px; }
	.menu-btn:hover { background: var(--subtle); color: var(--ink); }
	.student-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 10; width: 240px; display: flex; flex-direction: column; padding: 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-pop); font-size: 14px; }
	.student-menu button { padding: 8px 10px; border-radius: 6px; text-align: left; cursor: pointer; }
	.student-menu button:hover { background: var(--subtle); }
	.student-menu button.danger { color: var(--danger-ink); }
	.mono { font-family: var(--mono); }

	/* Dialog */
	.dialog-overlay { position: fixed; inset: 0; background: rgb(15 23 42 / 0.5); z-index: 50; display: grid; place-items: center; padding: 20px; }
	.dialog-box { background: var(--surface); border-radius: 10px; box-shadow: var(--shadow-pop); padding: 24px; display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 460px; }
	.dialog-title { font-size: 18px; font-weight: 600; }
	.dialog-body { font-size: 15px; line-height: 23px; color: var(--ink-2); }
	.dialog-error { padding: 10px 12px; border-radius: 6px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

	.pw-display { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; background: var(--subtle); }
	.pw-text { font-family: var(--mono); font-size: 24px; font-weight: 500; letter-spacing: 3px; flex: 1; }
	.pw-hint { font-size: 13px; color: var(--ink-3); }

	.btn-primary { display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 16px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.6; cursor: default; }
	.btn-secondary { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-secondary:hover:not(:disabled) { background: var(--subtle); }
	.btn-danger { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 6px; background: var(--danger); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-danger:hover:not(:disabled) { background: var(--danger-ink); }
	.btn-danger:disabled { opacity: 0.6; cursor: default; }
</style>
