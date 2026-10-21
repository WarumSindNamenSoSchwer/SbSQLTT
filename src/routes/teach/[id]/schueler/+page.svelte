<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { page } from '$app/state';
	import {
		apiTeacherGetStudents,
		apiTeacherRenameStudent,
		apiTeacherRemoveStudent,
		apiTeacherPasswordReset,
		type TeacherStudent,
	} from '$lib/tabula/api.js';

	const ctx = getContext<{ cls: any; reload: () => void }>('teachClass');
	let classId = $derived(Number(page.params.id));

	let students = $state<TeacherStudent[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let openMenuId = $state<number | null>(null);

	// Dialogs
	type Dialog =
		| { type: 'rename'; student: TeacherStudent; newName: string }
		| { type: 'remove'; student: TeacherStudent }
		| { type: 'reset'; student: TeacherStudent; generatedPw: string; confirmed: boolean };

	let dialog = $state<Dialog | null>(null);
	let dialogBusy = $state(false);
	let dialogError = $state<string | null>(null);
	let pwCopied = $state(false);

	onMount(() => {
		loadStudents();
		document.addEventListener('click', closeMenuOnOutside);
		return () => document.removeEventListener('click', closeMenuOnOutside);
	});

	function closeMenuOnOutside(e: MouseEvent) {
		if (!(e.target as Element).closest('.student-menu-wrap')) {
			openMenuId = null;
		}
	}

	async function loadStudents() {
		loading = true;
		try {
			const res = await apiTeacherGetStudents(classId);
			students = res.students;
		} catch {
			students = [];
		} finally {
			loading = false;
		}
	}

	const filteredStudents = $derived(
		searchQuery.trim()
			? students.filter(s =>
				s.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				s.username.toLowerCase().includes(searchQuery.toLowerCase())
			)
			: students
	);

	function relTime(ts: number): string {
		if (!ts) return '–';
		return new Date(ts * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
	}

	function openRename(s: TeacherStudent) {
		openMenuId = null;
		dialog = { type: 'rename', student: s, newName: s.display_name };
		dialogError = null;
	}

	function openRemove(s: TeacherStudent) {
		openMenuId = null;
		dialog = { type: 'remove', student: s };
		dialogError = null;
	}

	function openReset(s: TeacherStudent) {
		openMenuId = null;
		dialog = { type: 'reset', student: s, generatedPw: generatePassword(), confirmed: false };
		dialogError = null;
		pwCopied = false;
	}

	/** Gut lesbares Passwort ohne 0/O/1/l/I - ähnlich Beitrittscode-Alphabet */
	function generatePassword(): string {
		const words = ['tafel', 'kreide', 'lineal', 'heft', 'karte', 'netz', 'tisch', 'buch'];
		const w1 = words[Math.floor(Math.random() * words.length)];
		const w2 = words.filter(w => w !== w1)[Math.floor(Math.random() * (words.length - 1))];
		const n = String(Math.floor(Math.random() * 90) + 10);
		return `${w1}-${n}-${w2}`;
	}

	async function copyPw() {
		if (dialog?.type !== 'reset') return;
		await navigator.clipboard.writeText(dialog.generatedPw);
		pwCopied = true;
		setTimeout(() => (pwCopied = false), 2000);
	}

	function closeDialog() {
		dialog = null;
		dialogError = null;
		dialogBusy = false;
	}

	async function submitDialog() {
		if (!dialog) return;
		dialogBusy = true;
		dialogError = null;

		try {
			if (dialog.type === 'rename') {
				const newName = dialog.newName.trim();
				if (!newName) { dialogError = 'Name darf nicht leer sein.'; dialogBusy = false; return; }
				await apiTeacherRenameStudent(classId, dialog.student.id, newName);
				students = students.map(s => s.id === dialog!.student.id ? { ...s, display_name: newName } : s);
				ctx?.reload();
				closeDialog();
			} else if (dialog.type === 'remove') {
				await apiTeacherRemoveStudent(classId, dialog.student.id);
				students = students.filter(s => s.id !== dialog!.student.id);
				ctx?.reload();
				closeDialog();
			} else if (dialog.type === 'reset') {
				await apiTeacherPasswordReset(classId, dialog.student.id, dialog.generatedPw);
				closeDialog();
			}
		} catch (err) {
			dialogError = err instanceof Error ? err.message : 'Fehler.';
		} finally {
			dialogBusy = false;
		}
	}
</script>

<div class="schueler-wrap">
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
				<span>Noch niemand beigetreten. Teilen Sie den Beitrittscode.</span>
			{/if}
		</div>
	{:else}
		<div class="students-table">
			<div class="table-header">
				<span>ANZEIGENAME</span>
				<span>BENUTZERNAME</span>
				<span>BEIGETRETEN</span>
				<span>FORTSCHRITT</span>
				<span></span>
			</div>
			{#each filteredStudents as s (s.id)}
				<div class="table-row">
					<span class="row-name">{s.display_name}</span>
					<span class="row-username mono">{s.username}</span>
					<span class="row-joined">{relTime(s.joined_at)}</span>
					<span class="row-progress"></span>
					<span class="student-menu-wrap">
						<button
							class="menu-btn"
							aria-label="Aktionen für {s.display_name}"
							onclick={(e) => { e.stopPropagation(); openMenuId = openMenuId === s.id ? null : s.id; }}
						>⋯</button>
						{#if openMenuId === s.id}
							<div class="student-menu" role="menu">
								<button onclick={() => openRename(s)}>Umbenennen</button>
								<button onclick={() => openReset(s)}>Passwort zurücksetzen</button>
								<button class="danger" onclick={() => openRemove(s)}>Aus Klasse entfernen</button>
							</div>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if dialog}
	<div class="dialog-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
		<div role="dialog" aria-modal="true" class="dialog-box">
			{#if dialog.type === 'rename'}
				<h2 class="dialog-title">Schüler umbenennen</h2>
				<p class="dialog-body">Neuer Anzeigename für {dialog.student.display_name}:</p>
				<input
					type="text"
					class="dialog-input"
					bind:value={dialog.newName}
					placeholder="Anzeigename"
					onkeydown={(e) => e.key === 'Enter' && submitDialog()}
				/>
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					<button class="btn-secondary" onclick={closeDialog} disabled={dialogBusy}>Abbrechen</button>
					<button class="btn-primary" onclick={submitDialog} disabled={dialogBusy}>
						{dialogBusy ? 'Wird gespeichert …' : 'Speichern'}
					</button>
				</div>

			{:else if dialog.type === 'remove'}
				<h2 class="dialog-title">Schüler entfernen?</h2>
				<p class="dialog-body">
					<strong>{dialog.student.display_name}</strong> wird aus der Klasse entfernt.
					Der Fortschritt dieser Person in der Klasse wird gelöscht. Das Konto bleibt erhalten.
				</p>
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					<button class="btn-secondary" onclick={closeDialog} disabled={dialogBusy}>Abbrechen</button>
					<button class="btn-danger" onclick={submitDialog} disabled={dialogBusy}>
						{dialogBusy ? 'Wird entfernt …' : 'Entfernen'}
					</button>
				</div>

			{:else if dialog.type === 'reset'}
				<h2 class="dialog-title">Neues Passwort für {dialog.student.display_name}</h2>
				<p class="dialog-body">
					Geben Sie {dialog.student.display_name} dieses Einmal-Passwort.
					Beim nächsten Anmelden muss ein eigenes Passwort festgelegt werden.
				</p>
				<div class="pw-display">
					<span class="pw-text mono">{dialog.generatedPw}</span>
					<button class="pw-copy-btn" onclick={copyPw}>{pwCopied ? '✓ Kopiert' : 'Kopieren'}</button>
				</div>
				<p class="pw-hint">Gut lesbar. Kein 0/O, kein 1/l.</p>
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					<button class="btn-secondary" onclick={closeDialog} disabled={dialogBusy}>Abbrechen</button>
					<button class="btn-primary" onclick={submitDialog} disabled={dialogBusy}>
						{dialogBusy ? 'Wird gesetzt …' : 'Fertig'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.schueler-wrap { padding: 24px 40px; display: flex; flex-direction: column; gap: 16px; }
	@media (max-width: 767px) { .schueler-wrap { padding: 16px; } }

	.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.search-field { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; color: var(--ink-3); max-width: 320px; flex: 1; }
	.search-field input { background: none; border: none; outline: none; font: inherit; color: var(--ink); flex: 1; }
	.flex-1 { flex: 1; }

	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	.empty-state { padding: 40px; text-align: center; color: var(--ink-2); font-size: 15px; }

	.students-table { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; }
	.table-header { display: grid; grid-template-columns: minmax(0,1fr) 180px 160px 200px 48px; padding: 0 16px; background: var(--subtle); border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3); }
	@media (max-width: 900px) { .table-header { display: none; } }
	.table-header span { padding: 9px 0; }
	.table-row { display: grid; grid-template-columns: minmax(0,1fr) 180px 160px 200px 48px; align-items: center; padding: 0 16px; min-height: 48px; border-bottom: 1px solid var(--line); font-size: 14px; }
	@media (max-width: 900px) { .table-row { grid-template-columns: minmax(0,1fr) 48px; gap: 8px; min-height: 56px; } }
	.table-row:last-child { border-bottom: none; }

	.row-name { font-weight: 500; }
	.row-username { font-family: var(--mono); font-size: 13px; color: var(--ink-2); }
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
	.dialog-input { height: 44px; padding: 0 12px; border-radius: 6px; border: 1.5px solid var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--surface); font: inherit; font-size: 15px; outline: none; }
	.dialog-error { padding: 10px 12px; border-radius: 6px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

	.pw-display { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; background: var(--subtle); }
	.pw-text { font-family: var(--mono); font-size: 24px; font-weight: 500; letter-spacing: 3px; flex: 1; }
	.pw-copy-btn { font-size: 14px; font-weight: 500; color: var(--accent-strong); cursor: pointer; white-space: nowrap; }
	.pw-copy-btn:hover { text-decoration: underline; }
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
