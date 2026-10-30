<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { page } from '$app/state';
	import {
		apiTeacherGetLessons,
		apiTeacherPutLessons,
		type LessonSetting,
	} from '$lib/tabula/api.js';
	import { CATALOG, TRACK_INFO } from '$lib/tabula/lessons.js';

	const ctx = getContext<{ cls: any; setFocus: (l: string | null) => void; reload: () => void }>('teachClass');
	let classId = $derived(Number(page.params.id));

	let settings = $state<LessonSetting[]>([]);
	let loading = $state(true);
	let saveBusy = $state(false);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let searchQuery = $state('');

	onMount(async () => {
		await loadLessons();
	});

	async function loadLessons() {
		loading = true;
		try {
			const res = await apiTeacherGetLessons(classId);
			// Merge with CATALOG to ensure all lessons are represented
			settings = CATALOG.map((c, i) => {
				const existing = res.lessons.find(l => l.lesson_id === c.id);
				return existing ?? {
					lesson_id: c.id,
					unlocked: c.track === 1, // default: SQL-Grundlagen freigeschaltet
					sort_order: i,
					is_focus: false,
				};
			});
		} catch {
			// If endpoint fails, use defaults
			settings = CATALOG.map((c, i) => ({
				lesson_id: c.id,
				unlocked: c.track === 1,
				sort_order: i,
				is_focus: false,
			}));
		} finally {
			loading = false;
		}
	}

	function showToast(msg: string) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3000);
	}

	async function save(updatedSettings: LessonSetting[]) {
		if (saveBusy) return;
		saveBusy = true;
		try {
			await apiTeacherPutLessons(classId, updatedSettings);
			settings = updatedSettings;
			// Update focus in layout context
			const focusLesson = updatedSettings.find(s => s.is_focus);
			ctx?.setFocus(focusLesson?.lesson_id ?? null);
			showToast('Gespeichert');
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Fehler beim Speichern.');
		} finally {
			saveBusy = false;
		}
	}

	function toggleUnlocked(lessonId: string) {
		const updated = settings.map(s =>
			s.lesson_id === lessonId ? { ...s, unlocked: !s.unlocked } : s
		);
		save(updated);
	}

	function setFocus(lessonId: string) {
		const updated = settings.map(s => ({
			...s,
			is_focus: s.lesson_id === lessonId,
			// focus lesson is always unlocked
			unlocked: s.lesson_id === lessonId ? true : s.unlocked,
		}));
		save(updated);
	}

	function unlockAll() {
		const updated = settings.map(s => ({ ...s, unlocked: true }));
		save(updated);
	}

	function unlockTrack(trackNum: 1 | 2 | 3) {
		const updated = settings.map(s => {
			const cat = CATALOG.find(c => c.id === s.lesson_id);
			if (cat && cat.track === trackNum) return { ...s, unlocked: true };
			return s;
		});
		save(updated);
	}

	// Group settings by track
	const trackGroups = $derived(TRACK_INFO.map(track => {
		const trackNum = parseInt(track.num) as 1 | 2 | 3;
		const lessons = CATALOG.filter(c => c.track === trackNum);
		const lessonSettings = lessons.map(c => ({
			catalog: c,
			setting: settings.find(s => s.lesson_id === c.id),
		}));
		const unlockedCount = lessonSettings.filter(l => l.setting?.unlocked).length;
		return { track, trackNum, lessons: lessonSettings, unlockedCount };
	}));

	const filtered = $derived(searchQuery.trim()
		? trackGroups.map(g => ({
			...g,
			lessons: g.lessons.filter(l =>
				l.catalog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				l.catalog.n.toLowerCase().includes(searchQuery.toLowerCase())
			)
		})).filter(g => g.lessons.length > 0)
		: trackGroups
	);
</script>

<div class="lektionen-wrap">
	<div class="toolbar">
		<div class="search-field">
			<span class="search-ico" aria-hidden="true">⌕</span>
			<input
				type="search"
				placeholder="Lektion suchen"
				bind:value={searchQuery}
			/>
		</div>
		<span class="toolbar-hint">Die Fokus-Lektion ist immer freigeschaltet.</span>
		<button class="btn-secondary" onclick={unlockAll}>Alle freischalten</button>
	</div>

	{#if loading}
		<div class="spinner-wrap"><span class="spinner"></span></div>
	{:else}
		{#each filtered as group}
			<div class="track-section">
				<div class="track-header">
					<span class="track-num mono">{group.track.num}</span>
					<h2 class="track-name">{group.track.name}</h2>
					<span class="track-status">{group.unlockedCount} von {group.lessons.length} freigeschaltet</span>
					<span class="flex-1"></span>
					<button class="track-unlock-all" onclick={() => unlockTrack(group.trackNum)}>Track freischalten</button>
				</div>

				<div class="lessons-table">
					{#each group.lessons as { catalog, setting }}
						{@const isFocus = setting?.is_focus ?? false}
						{@const isUnlocked = setting?.unlocked ?? false}
						<div class="lesson-row">
							<span class="drag-handle" aria-hidden="true" title="Ziehen zum Sortieren">⋮⋮</span>
							<span class="lesson-num mono">{catalog.n}</span>
							<span class="lesson-title">{catalog.title}</span>
							<span class="lesson-dur">{catalog.dur}</span>
							<span class="lesson-prog"></span>
							<span class="focus-cell">
								{#if isFocus}
									<span class="badge-focus">★ Fokus</span>
								{:else}
									<button
										class="focus-set-btn"
										title="Als Fokus setzen"
										onclick={() => setFocus(catalog.id)}
									>☆</button>
								{/if}
							</span>
							<span class="toggle-cell">
								<span class="toggle-label">{isUnlocked ? 'Frei' : 'Gesperrt'}</span>
								<button
									class="toggle-switch"
									class:on={isUnlocked}
									role="switch"
									aria-checked={isUnlocked}
									aria-label="{catalog.title} {isUnlocked ? 'sperren' : 'freischalten'}"
									onclick={() => toggleUnlocked(catalog.id)}
									disabled={isFocus}
									title={isFocus ? 'Fokus-Lektion ist immer freigeschaltet' : undefined}
								>
									<span class="toggle-knob"></span>
								</button>
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

{#if toast}
	<div class="toast" role="status">
		<span class="toast-icon" class:ok={toast === 'Gespeichert'} class:err={toast !== 'Gespeichert'}>
			{toast === 'Gespeichert' ? '✓' : '!'}
		</span>
		{toast}
	</div>
{/if}

<style>
	.lektionen-wrap { padding: 20px clamp(16px,3vw,40px) 80px; display: flex; flex-direction: column; gap: 20px; }

	.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.search-field { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; color: var(--ink-3); max-width: 320px; flex: 1; }
	.search-field input { background: none; border: none; outline: none; font: inherit; color: var(--ink); flex: 1; }
	.search-ico { flex: none; }
	.toolbar-hint { flex: 1; font-size: 13px; color: var(--ink-3); }
	.btn-secondary { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
	.btn-secondary:hover { background: var(--subtle); }

	.track-section { display: flex; flex-direction: column; gap: 8px; }
	.track-header { display: flex; align-items: center; gap: 12px; padding: 0 0 8px; border-bottom: 1px solid var(--line-strong); flex-wrap: wrap; }
	.track-num { font-family: var(--mono); font-size: 13px; color: var(--accent-ink); }
	.track-name { font-size: 17px; font-weight: 600; flex: 1; }
	.track-status { font-size: 13px; color: var(--ink-3); }
	.flex-1 { flex: 1; }
	.track-unlock-all { font-size: 13px; font-weight: 500; color: var(--accent-ink); cursor: pointer; background: none; border: none; padding: 0; }
	.track-unlock-all:hover { text-decoration: underline; }

	.lessons-table { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden; }
	.lesson-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; min-height: 52px; padding: 8px 16px; border-bottom: 1px solid var(--line); }
	.lesson-row:last-child { border-bottom: none; }

	.drag-handle { color: var(--ink-3); font-size: 14px; letter-spacing: -2px; cursor: grab; flex: none; }
	.lesson-num { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line-strong); font: 600 12px/1 var(--mono); color: var(--ink-2); flex: none; }
	.lesson-title { flex: 1; min-width: 160px; font-size: 15px; font-weight: 500; }
	.lesson-dur { font-size: 13px; color: var(--ink-3); white-space: nowrap; }
	.lesson-prog { flex: 1; }
	.focus-cell { display: flex; justify-content: center; flex: none; }
	.badge-focus { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 1px solid var(--accent); border-radius: 7px; background: var(--accent-soft); color: var(--accent-ink); font-size: 13px; cursor: pointer; }
	.focus-set-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 1px solid var(--line); border-radius: 7px; color: var(--ink-3); font-size: 13px; cursor: pointer; }
	.focus-set-btn:hover { background: var(--subtle); color: var(--ink); border-color: var(--accent); }

	.toggle-cell { display: flex; align-items: center; gap: 8px; flex: none; }
	.toggle-label { font-size: 13px; color: var(--ink-2); min-width: 44px; text-align: right; }
	.toggle-switch { width: 38px; height: 22px; border-radius: 999px; background: var(--line-strong); position: relative; cursor: pointer; flex: none; transition: background 0.2s; }
	.toggle-switch.on { background: var(--accent); }
	.toggle-switch:disabled { opacity: 0.5; cursor: default; }
	.toggle-knob { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff; transition: left 0.2s; }
	.toggle-switch.on .toggle-knob { left: 19px; }
	@media (prefers-reduced-motion: reduce) { .toggle-switch, .toggle-knob { transition: none; } }

	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	.mono { font-family: var(--mono); }

	.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 18px; border-radius: 10px; background: #0f172a; color: #fff; font-size: 14px; font-weight: 500; box-shadow: var(--shadow-pop); z-index: 30; white-space: nowrap; }
	.toast-icon { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex: none; }
	.toast-icon.ok { background: var(--ok); color: #fff; }
	.toast-icon.err { background: var(--danger); color: #fff; }
</style>
