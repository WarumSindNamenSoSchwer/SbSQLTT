<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		apiTeacherPatchClass,
		apiTeacherNewCode,
		apiTeacherDeleteClass,
		type TeacherClass,
	} from '$lib/tabula/api.js';

	const ctx = getContext<{ cls: any; reload: () => void }>('teachClass');
	let classId = $derived(Number(page.params.id));
	let cls = $derived<TeacherClass | null>(ctx?.cls ?? null);

	// Dialoge
	type Dialog =
		| { type: 'rename'; newName: string }
		| { type: 'newcode' }
		| { type: 'delete'; confirmName: string };

	let dialog = $state<Dialog | null>(null);
	let dialogBusy = $state(false);
	let dialogError = $state<string | null>(null);
	let archiveBusy = $state(false);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(msg: string) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3000);
	}

	function closeDialog() {
		dialog = null;
		dialogError = null;
		dialogBusy = false;
	}

	async function handleArchive() {
		if (!cls) return;
		archiveBusy = true;
		try {
			const newArchived = !cls.archived;
			await apiTeacherPatchClass(classId, { archived: newArchived });
			await ctx?.reload();
			showToast(newArchived ? 'Klasse archiviert.' : 'Klasse wiederhergestellt.');
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Fehler.');
		} finally {
			archiveBusy = false;
		}
	}

	async function submitDialog() {
		if (!dialog || !cls) return;
		dialogBusy = true;
		dialogError = null;

		try {
			if (dialog.type === 'rename') {
				const n = dialog.newName.trim();
				if (!n) { dialogError = 'Name darf nicht leer sein.'; dialogBusy = false; return; }
				await apiTeacherPatchClass(classId, { name: n });
				await ctx?.reload();
				showToast('Name geändert.');
				closeDialog();
			} else if (dialog.type === 'newcode') {
				await apiTeacherNewCode(classId);
				await ctx?.reload();
				showToast('Neuer Code erzeugt.');
				closeDialog();
			} else if (dialog.type === 'delete') {
				if (dialog.confirmName.trim() !== cls.name) {
					dialogError = 'Name stimmt nicht überein.';
					dialogBusy = false;
					return;
				}
				await apiTeacherDeleteClass(classId);
				goto('/teach');
			}
		} catch (err) {
			dialogError = err instanceof Error ? err.message : 'Fehler.';
		} finally {
			dialogBusy = false;
		}
	}

	const settings = $derived(cls ? [
		{ label: 'Name', value: cls.name, action: 'Ändern', key: 'name' as const },
		{ label: 'Beitrittscode', value: cls.join_code, action: 'Neu erzeugen', key: 'code' as const },
	] : []);
</script>

<div class="einstellungen-wrap">
	<div class="settings-section">
		{#each settings as s}
			<div class="setting-row">
				<div class="setting-info">
					<span class="setting-label">{s.label}</span>
					<span class="setting-value mono">{s.value}</span>
				</div>
				<button
					class="setting-action"
					onclick={() => {
						if (s.key === 'name') {
							dialog = { type: 'rename', newName: cls?.name ?? '' };
							dialogError = null;
						} else if (s.key === 'code') {
							dialog = { type: 'newcode' };
							dialogError = null;
						}
					}}
				>{s.action}</button>
			</div>
		{/each}
	</div>

	<div class="danger-section">
		<div class="danger-row">
			<div class="setting-info">
				<span class="setting-label">{cls?.archived ? 'Klasse wiederherstellen' : 'Klasse archivieren'}</span>
				<span class="setting-value">{cls?.archived ? 'Klasse ist archiviert.' : 'Ausgeblendet, Daten bleiben erhalten. Schüler können sich so lange nicht anmelden. Jederzeit wiederherstellbar.'}</span>
			</div>
			<button class="btn-secondary" onclick={handleArchive} disabled={archiveBusy}>
				{archiveBusy ? '…' : cls?.archived ? 'Wiederherstellen' : 'Archivieren'}
			</button>
		</div>
		<div class="danger-row delete-row">
			<div class="setting-info">
				<span class="setting-label danger-label">Klasse löschen</span>
				<span class="setting-value">Klasse, Schüler und ihr Fortschritt werden endgültig gelöscht.</span>
			</div>
			<button
				class="btn-danger-outline"
				onclick={() => {
					dialog = { type: 'delete', confirmName: '' };
					dialogError = null;
				}}
			>Löschen …</button>
		</div>
	</div>
</div>

{#if dialog}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="dialog-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
		<div role="dialog" aria-modal="true" class="dialog-box">
			{#if dialog.type === 'rename'}
				<h2 class="dialog-title">Name ändern</h2>
				<p class="dialog-body">Neuer Name für die Klasse:</p>
				<input
					type="text"
					class="dialog-input"
					bind:value={dialog.newName}
					placeholder="Klassenname"
					onkeydown={(e) => e.key === 'Enter' && submitDialog()}
				/>
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					<button class="btn-secondary" onclick={closeDialog} disabled={dialogBusy}>Abbrechen</button>
					<button class="btn-primary" onclick={submitDialog} disabled={dialogBusy}>
						{dialogBusy ? 'Wird gespeichert …' : 'Speichern'}
					</button>
				</div>

			{:else if dialog.type === 'newcode'}
				<h2 class="dialog-title">Neuen Beitrittscode erzeugen?</h2>
				<p class="dialog-body">
					Der alte Code <strong class="mono">{cls?.join_code}</strong> wird sofort ungültig.
					Wer bereits in der Klasse ist, bleibt drin und meldet sich künftig mit dem neuen Code an, Name und Passwort bleiben gleich.
				</p>
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					<button class="btn-secondary" onclick={closeDialog} disabled={dialogBusy}>Abbrechen</button>
					<button class="btn-primary" onclick={submitDialog} disabled={dialogBusy}>
						{dialogBusy ? 'Wird erzeugt …' : 'Neuen Code erzeugen'}
					</button>
				</div>

			{:else if dialog.type === 'delete'}
				<h2 class="dialog-title">Klasse wirklich löschen?</h2>
				<p class="dialog-body">
					Geben Sie zur Bestätigung den Namen der Klasse ein: <strong>{cls?.name}</strong>
				</p>
				<input
					type="text"
					class="dialog-input"
					bind:value={dialog.confirmName}
					placeholder={cls?.name}
					onkeydown={(e) => e.key === 'Enter' && submitDialog()}
				/>
				{#if dialogError}<div class="dialog-error">{dialogError}</div>{/if}
				<div class="dialog-actions">
					<button class="btn-secondary" onclick={closeDialog} disabled={dialogBusy}>Abbrechen</button>
					<button class="btn-danger" onclick={submitDialog} disabled={dialogBusy || dialog.confirmName.trim() !== cls?.name}>
						{dialogBusy ? 'Wird gelöscht …' : 'Endgültig löschen'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if toast}
	<div class="toast" role="status">{toast}</div>
{/if}

<style>
	.einstellungen-wrap { padding: 24px clamp(16px,3vw,40px); display: flex; flex-direction: column; gap: 20px; max-width: 800px; }

	.settings-section, .danger-section { border-radius: 12px; overflow: hidden; }
	.settings-section { border: 1px solid var(--line); }
	.danger-section { border: 1px solid var(--danger-line); }

	.setting-row, .danger-row { display: flex; align-items: center; gap: 16px; min-height: 64px; padding: 8px 20px; border-bottom: 1px solid var(--line); background: var(--surface); }
	.danger-row { border-bottom-color: var(--danger-line); }
	.setting-row:last-child, .danger-row:last-child { border-bottom: none; }
	.setting-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
	.setting-label { font-size: 15px; font-weight: 500; }
	.setting-label.danger-label { color: var(--danger-ink); font-weight: 600; }
	.setting-value { font-size: 13px; color: var(--ink-3); }
	.mono { font-family: var(--mono); }

	.setting-action { font-size: 14px; font-weight: 500; color: var(--accent-ink); cursor: pointer; white-space: nowrap; font-family: inherit; }
	.setting-action:hover { text-decoration: underline; }

	.btn-secondary { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; font-family: inherit; }
	.btn-secondary:hover:not(:disabled) { background: var(--subtle); }
	.btn-secondary:disabled { opacity: 0.6; cursor: default; }
	.btn-danger-outline { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 7px; border: 1px solid var(--danger-line); color: var(--danger-ink); background: var(--surface); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; font-family: inherit; }
	.btn-danger-outline:hover { background: var(--danger-soft); }

	/* Dialog */
	.dialog-overlay { position: fixed; inset: 0; background: rgb(15 23 42 / 0.5); z-index: 50; display: grid; place-items: center; padding: 20px; }
	.dialog-box { background: var(--surface); border-radius: 12px; box-shadow: var(--shadow-pop); padding: 26px; display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 480px; }
	.dialog-title { font-size: 18px; font-weight: 600; margin: 0; }
	.dialog-body { font-size: 15px; line-height: 23px; color: var(--ink-2); margin: 0; }
	.dialog-input { height: 44px; padding: 0 12px; border-radius: 7px; border: 1.5px solid var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--surface); font: inherit; font-size: 15px; outline: none; }
	.dialog-error { padding: 10px 12px; border-radius: 7px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
	.btn-primary { display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 16px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.6; cursor: default; }
	.btn-danger { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 8px; background: var(--danger); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-danger:hover:not(:disabled) { filter: brightness(1.1); }
	.btn-danger:disabled { opacity: 0.5; cursor: default; }

	.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 18px; border-radius: 10px; background: #0f172a; color: #fff; font-size: 14px; font-weight: 500; box-shadow: var(--shadow-pop); z-index: 30; white-space: nowrap; }
</style>
