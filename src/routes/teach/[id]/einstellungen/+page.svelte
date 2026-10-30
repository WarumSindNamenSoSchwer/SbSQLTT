<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { apiTeacherGetClass, apiTeacherPatchClass, apiTeacherDeleteClass } from '$lib/tabula/api.js';

	const ctx = getContext<{ cls: any; reload: () => void }>('teachClass');
	let classId = $derived(Number(page.params.id));

	let className = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let saveSuccess = $state(false);
	let saveError = $state<string | null>(null);

	// Klasse löschen
	let deleteConfirmText = $state('');
	let deleteBusy = $state(false);
	let deleteError = $state<string | null>(null);
	let showDeleteConfirm = $state(false);

	onMount(async () => {
		try {
			const c = ctx?.cls ?? (await apiTeacherGetClass(classId)).class;
			className = c.name ?? '';
		} catch {
			// ignore
		} finally {
			loading = false;
		}
	});

	async function save() {
		if (!className.trim()) return;
		saving = true;
		saveError = null;
		saveSuccess = false;
		try {
			await apiTeacherPatchClass(classId, { name: className.trim() });
			saveSuccess = true;
			ctx?.reload();
			setTimeout(() => (saveSuccess = false), 3000);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Fehler beim Speichern.';
		} finally {
			saving = false;
		}
	}

	async function deleteClass() {
		if (deleteConfirmText.trim() !== className.trim()) return;
		deleteBusy = true;
		deleteError = null;
		try {
			await apiTeacherDeleteClass(classId);
			goto('/teach');
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Fehler beim Löschen.';
			deleteBusy = false;
		}
	}

	const deleteReady = $derived(deleteConfirmText.trim() === className.trim() && className.trim().length > 0);
</script>

<div class="settings-wrap">
	{#if loading}
		<div class="spinner-wrap"><span class="spinner"></span></div>
	{:else}
		<!-- Allgemein -->
		<section class="settings-section">
			<h2 class="section-title">Allgemein</h2>
			<form class="settings-form" onsubmit={(e) => { e.preventDefault(); save(); }}>
				<div class="field-group">
					<label class="field-label" for="class-name">Name der Klasse</label>
					<input
						id="class-name"
						class="field-input"
						type="text"
						bind:value={className}
						maxlength="80"
						required
						placeholder="z.B. 4b Informatik"
					/>
				</div>

				{#if saveError}
					<div class="field-error">{saveError}</div>
				{/if}
				{#if saveSuccess}
					<div class="field-success">Gespeichert.</div>
				{/if}
				<div class="form-actions">
					<button class="btn-primary" type="submit" disabled={saving || !className.trim()}>
						{saving ? 'Wird gespeichert …' : 'Speichern'}
					</button>
				</div>
			</form>
		</section>

		<!-- Klasse löschen -->
		<section class="settings-section danger-section">
			<h2 class="section-title danger-title">Klasse löschen</h2>
			<p class="section-body">
				Alle Schüler, Lernfortschritte und Einstellungen dieser Klasse werden unwiderruflich gelöscht.
				Dieser Vorgang kann nicht rückgängig gemacht werden.
			</p>
			{#if !showDeleteConfirm}
				<button class="btn-danger-outline" onclick={() => (showDeleteConfirm = true)}>
					Klasse löschen …
				</button>
			{:else}
				<div class="delete-confirm-box">
					<p class="delete-confirm-text">
						Geben Sie zur Bestätigung den Namen der Klasse ein:
						<strong>{className}</strong>
					</p>
					<input
						class="field-input"
						type="text"
						bind:value={deleteConfirmText}
						placeholder={className}
						aria-label="Klassenname zur Bestätigung eingeben"
					/>
					{#if deleteError}
						<div class="field-error">{deleteError}</div>
					{/if}
					<div class="delete-actions">
						<button
							class="btn-cancel-delete"
							onclick={() => { showDeleteConfirm = false; deleteConfirmText = ''; deleteError = null; }}
							disabled={deleteBusy}
						>Abbrechen</button>
						<button
							class="btn-danger"
							onclick={deleteClass}
							disabled={!deleteReady || deleteBusy}
						>
							{deleteBusy ? 'Wird gelöscht …' : 'Unwiderruflich löschen'}
						</button>
					</div>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.settings-wrap { padding: 20px clamp(16px,3vw,40px); display: flex; flex-direction: column; gap: 24px; max-width: 680px; }

	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	.settings-section { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; gap: 16px; }
	.danger-section { border-color: var(--danger-line); }
	.section-title { font-size: 16px; font-weight: 600; margin: 0; }
	.danger-title { color: var(--danger-ink); }
	.section-body { font-size: 14px; line-height: 21px; color: var(--ink-2); margin: 0; }

	.settings-form { display: flex; flex-direction: column; gap: 14px; }
	.field-group { display: flex; flex-direction: column; gap: 6px; }
	.field-label { font-size: 14px; font-weight: 500; }
	.optional-hint { color: var(--ink-3); font-weight: 400; }
	.field-input { height: 40px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--surface); font: 14px/1 inherit; color: var(--ink); }
	.field-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }

	.field-error { padding: 10px 12px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.field-success { padding: 10px 12px; border-radius: 8px; background: var(--ok-soft); border: 1px solid var(--ok-line, var(--ok)); color: var(--ok-ink); font-size: 14px; }

	.form-actions { display: flex; gap: 10px; }
	.btn-primary { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.6; cursor: default; }

	.btn-danger-outline { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border: 1px solid var(--danger-line); border-radius: 8px; color: var(--danger-ink); background: var(--surface); font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.btn-danger-outline:hover { background: var(--danger-soft); }

	.delete-confirm-box { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 10px; background: var(--danger-soft); border: 1px solid var(--danger-line); }
	.delete-confirm-text { font-size: 14px; color: var(--ink-2); margin: 0; }

	.delete-actions { display: flex; gap: 10px; flex-wrap: wrap; }
	.btn-cancel-delete { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); font-size: 14px; cursor: pointer; font-family: inherit; }
	.btn-cancel-delete:hover:not(:disabled) { background: var(--subtle); }
	.btn-danger { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 8px; background: var(--danger); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
	.btn-danger:hover:not(:disabled) { filter: brightness(1.1); }
	.btn-danger:disabled { opacity: 0.5; cursor: default; }
</style>
