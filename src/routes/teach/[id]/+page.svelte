<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { page } from '$app/state';
	import {
		apiTeacherDashboard,
		apiTeacherMatrix,
		apiTeacherLastAttempt,
		apiTeacherPatchClass,
		type DashboardStudent,
		type MatrixRow,
		type LastAttempt,
	} from '$lib/tabula/api.js';
	import { CATALOG } from '$lib/tabula/lessons.js';

	const ctx = getContext<{ cls: any; reload: () => void; setFocus: (l: string | null) => void }>('teachClass');

	let classId = $derived(Number(page.params.id));
	let viewMode = $state<'focus' | 'matrix'>('focus');
	let students = $state<DashboardStudent[]>([]);
	let matrixRows = $state<MatrixRow[]>([]);
	let matrixLessonIds = $state<string[]>([]);
	let lastUpdate = $state(0);
	let loading = $state(true);
	let selectedStudent = $state<DashboardStudent | null>(null);
	let selectedAttempt = $state<LastAttempt | null>(null);
	let panelLoading = $state(false);

	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let focusChangeOpen = $state(false);

	const focusLesson = $derived(ctx?.cls?.focus_lesson ?? null);
	const focusCatalogEntry = $derived(
		CATALOG.find(c => c.id === focusLesson) ?? null
	);

	// Counters
	const countDone = $derived(students.filter(s => s.status === 'done').length);
	const countWork = $derived(students.filter(s => s.status === 'in_progress').length);
	const countStuck = $derived(students.filter(s => s.status === 'stuck').length);
	const countNone = $derived(students.filter(s => s.status === 'not_started').length);
	// sorted: stuck first, then in_progress, then done, then not_started
	const sortedStudents = $derived([...students].sort((a, b) => {
		const order = { stuck: 0, in_progress: 1, done: 2, not_started: 3 };
		return order[a.status] - order[b.status];
	}));

	function relTime(ts: number | null): string {
		if (!ts) return '–';
		const s = Math.floor(Date.now() / 1000 - ts);
		if (s < 60) return 'gerade eben';
		if (s < 3600) return `vor ${Math.floor(s / 60)} min`;
		if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
		return `vor ${Math.floor(s / 86400)} Tagen`;
	}

	onMount(() => {
		loadData();
		startPolling();
		document.addEventListener('visibilitychange', handleVisibility);
		return () => {
			stopPolling();
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});

	function handleVisibility() {
		if (document.visibilityState === 'visible') {
			startPolling();
		} else {
			stopPolling();
		}
	}

	function startPolling() {
		stopPolling();
		pollInterval = setInterval(loadData, 10000);
	}

	function stopPolling() {
		if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
	}

	async function loadData() {
		try {
			if (viewMode === 'focus') {
				const res = await apiTeacherDashboard(classId);
				students = res.students;
				lastUpdate = Date.now();
			} else {
				const res = await apiTeacherMatrix(classId);
				matrixRows = res.rows;
				matrixLessonIds = res.lesson_ids;
				lastUpdate = Date.now();
			}
		} catch {
			// ignore
		} finally {
			loading = false;
		}
	}

	async function switchView(mode: 'focus' | 'matrix') {
		viewMode = mode;
		loading = true;
		await loadData();
	}

	async function selectStudent(s: DashboardStudent) {
		selectedStudent = s;
		selectedAttempt = null;
		panelLoading = true;
		try {
			const res = await apiTeacherLastAttempt(classId, s.user_id);
			selectedAttempt = res.last_attempt;
		} catch {
			selectedAttempt = null;
		} finally {
			panelLoading = false;
		}
	}

	function closePanel() {
		selectedStudent = null;
		selectedAttempt = null;
	}

	function getLessonLabel(id: string): string {
		const e = CATALOG.find(c => c.id === id);
		return e ? `Lektion ${e.n} · ${e.title}` : id;
	}

	function getMatrixLessonLabel(id: string): string {
		const e = CATALOG.find(c => c.id === id);
		return e ? e.n : id;
	}
</script>

{#if loading && students.length === 0 && matrixRows.length === 0}
	<div class="spinner-wrap"><span class="spinner"></span></div>
{:else if students.length === 0 && matrixRows.length === 0 && viewMode === 'focus'}
	<!-- Leerer Zustand: noch niemand beigetreten -->
	<div class="empty-dashboard">
		<div class="empty-qr-side">
			<div class="empty-qr-box" aria-hidden="true">
				<div class="qr-mock"></div>
			</div>
			<div class="empty-code mono">{ctx?.cls?.join_code ?? '------'}</div>
		</div>
		<div class="empty-text-side">
			<h2 class="empty-title">Noch niemand beigetreten</h2>
			<p class="empty-body">Zeigen Sie diesen Code oder QR-Code. Schüler öffnen tabulasql.de/beitreten und geben den Code ein.</p>
			<div class="empty-steps">
				{#each [['1', 'QR-Code scannen oder Code eingeben'], ['2', 'Anmelden oder Konto erstellen'], ['3', 'Fertig. Der Schüler erscheint hier.']] as [n, t]}
					<div class="empty-step">
						<span class="step-n mono">{n}</span>
						<span>{t}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="dashboard-inner" class:has-panel={selectedStudent !== null}>
		<div class="dashboard-content">
			<div class="dashboard-toolbar">
				<div class="focus-bar">
					<span class="focus-star mono">★ FOKUS</span>
					<span class="focus-title">{focusCatalogEntry ? getLessonLabel(focusCatalogEntry.id) : 'Kein Fokus gesetzt'}</span>
					<button class="focus-change-btn" onclick={() => (focusChangeOpen = !focusChangeOpen)}>
						Ändern ▾
					</button>
					{#if focusChangeOpen}
						<div class="focus-dropdown" role="listbox">
							{#each CATALOG as c}
								<button
									class="focus-option"
									class:current={c.id === focusLesson}
									onclick={async () => {
										focusChangeOpen = false;
										await apiTeacherPatchClass(classId, {});
										// Note: Focus is set via lesson settings; using a quick update here
										ctx?.setFocus(c.id);
									}}
								>{c.n}. {c.title}</button>
							{/each}
						</div>
					{/if}
				</div>
				<span class="update-hint">● Zuletzt aktualisiert {relTime(Math.floor(lastUpdate / 1000))}</span>
				<div class="view-seg">
					<button class:active={viewMode === 'focus'} onclick={() => switchView('focus')}>Fokus</button>
					<button class:active={viewMode === 'matrix'} onclick={() => switchView('matrix')}>Alle Lektionen</button>
				</div>
			</div>

			{#if viewMode === 'focus'}
				<div class="counters">
					<div class="counter-card plain">
						<span class="counter-val">{countDone}</span>
						<span class="counter-lbl">✓ Fertig</span>
					</div>
					<div class="counter-card plain">
						<span class="counter-val">{countWork}</span>
						<span class="counter-lbl">● In Arbeit</span>
					</div>
					<div class="counter-card" class:alert={countStuck > 0}>
						<span class="counter-val" class:danger={countStuck > 0}>{countStuck}</span>
						<span class="counter-lbl" class:danger={countStuck > 0}>! Hängen fest</span>
					</div>
					<div class="counter-card plain">
						<span class="counter-val">{countNone}</span>
						<span class="counter-lbl">○ Nicht begonnen</span>
					</div>
				</div>

				<div class="student-table">
					<div class="table-header">
						<span>NAME</span>
						<span>STATUS</span>
						<span>SCHRITT</span>
						<span>FEHLVERSUCHE</span>
						<span>ZULETZT AKTIV</span>
					</div>
					{#each sortedStudents as s (s.user_id)}
						<button
							class="table-row"
							class:selected={selectedStudent?.user_id === s.user_id}
							onclick={() => selectStudent(s)}
						>
							{#if selectedStudent?.user_id === s.user_id}
								<span class="row-selection-indicator" aria-hidden="true"></span>
							{/if}
							<span class="row-name">{s.display_name}</span>
							<span>
								{#if s.status === 'stuck'}
									<span class="badge danger">! Hängt fest</span>
								{:else if s.status === 'in_progress'}
									<span class="badge accent">● In Arbeit</span>
								{:else if s.status === 'done'}
									<span class="badge ok">✓ Fertig</span>
								{:else}
									<span class="badge neutral">○ Nicht begonnen</span>
								{/if}
							</span>
							<span class="mono dim">{s.step !== null ? `${s.step + 1} / ${s.total_steps ?? '?'}` : '–'}</span>
							<span class="mono dim">{s.attempts > 0 ? s.attempts : '–'}</span>
							<span class="dim">{relTime(s.last_active)}</span>
						</button>
					{/each}
				</div>
			{:else}
				<!-- Matrix -->
				<div class="matrix-legend">
					<span class="ml-item"><span class="ml-cell ok"></span>Fertig</span>
					<span class="ml-item"><span class="ml-cell started"></span>Begonnen</span>
					<span class="ml-item"><span class="ml-cell stuck"></span>Hängt fest</span>
					<span class="ml-item"><span class="ml-cell open"></span>Offen</span>
					<span class="ml-item"><span class="ml-cell locked"></span>Gesperrt</span>
				</div>
				<div class="matrix-table">
					<div class="matrix-header">
						<span class="m-name">NAME</span>
						{#each matrixLessonIds as lid}
							<span class="m-cell-hdr mono">{getMatrixLessonLabel(lid)}</span>
						{/each}
						<span class="m-prog">FORTSCHRITT</span>
					</div>
					{#each matrixRows as row (row.user_id)}
						<div class="matrix-row">
							<span class="m-name">{row.display_name}</span>
							{#each row.cells as cell}
								<span class="m-cell-val">
									{#if cell.status === 'done'}<span class="mc-done">✓</span>
									{:else if cell.status === 'started'}<span class="mc-started">●</span>
									{:else if cell.status === 'stuck'}<span class="mc-stuck">!</span>
									{:else if cell.status === 'locked'}<span class="mc-locked">–</span>
									{:else}<span class="mc-open"></span>
									{/if}
								</span>
							{/each}
							<span class="m-prog mono dim">{row.progress}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if selectedStudent}
			<!-- Side Panel -->
			<aside class="side-panel" aria-label="Schüler-Detail">
				<div class="panel-head">
					<div class="panel-student-info">
						<h2 class="panel-name">{selectedStudent.display_name}</h2>
						<div class="panel-badges">
							{#if selectedStudent.status === 'stuck'}
								<span class="badge danger">! Hängt fest</span>
							{:else if selectedStudent.status === 'in_progress'}
								<span class="badge accent">● In Arbeit</span>
							{:else if selectedStudent.status === 'done'}
								<span class="badge ok">✓ Fertig</span>
							{:else}
								<span class="badge neutral">○ Nicht begonnen</span>
							{/if}
							{#if selectedStudent.step !== null}
								<span class="panel-step-info">Schritt {selectedStudent.step + 1} von {selectedStudent.total_steps ?? '?'} · {selectedStudent.attempts} Fehlversuche</span>
							{/if}
						</div>
					</div>
					<button class="panel-close" onclick={closePanel} aria-label="Schließen">✕</button>
				</div>

				{#if panelLoading}
					<div class="spinner-wrap-sm"><span class="spinner"></span></div>
				{:else if selectedAttempt}
					{#if selectedAttempt.query}
						<div class="panel-section">
							<span class="panel-lbl">LETZTE ABFRAGE · {relTime(selectedAttempt.updated_at)}</span>
							<div class="query-box">
								<pre class="query-pre">{selectedAttempt.query}</pre>
							</div>
						</div>
					{/if}
					{#if selectedAttempt.error_msg}
						<div class="panel-section">
							<span class="panel-lbl">FEHLERMELDUNG</span>
							<div class="error-hint">
								<span class="error-ico">!</span>
								<span class="error-msg">{selectedAttempt.error_msg}</span>
							</div>
						</div>
					{/if}
				{:else}
					<p class="panel-empty">Noch keine Abfrage gespeichert.</p>
				{/if}

				<span style="flex:1"></span>
				<p class="panel-privacy">Nur Sie sehen diese Ansicht. Schüler sehen keine Daten anderer.</p>
			</aside>
		{/if}
	</div>
{/if}

<style>
	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner-wrap-sm { display: grid; place-items: center; padding: 30px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	/* Empty state */
	.empty-dashboard { flex: 1; display: grid; grid-template-columns: 320px 420px; gap: 56px; align-items: center; padding: 40px; place-content: center; }
	@media (max-width: 800px) { .empty-dashboard { grid-template-columns: 1fr; gap: 24px; padding: 24px; } }
	.empty-qr-side { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.qr-mock { width: 236px; height: 236px; border-radius: 6px; background: repeating-conic-gradient(var(--ink) 0 25%, transparent 0 50%) 0 0/20px 20px; opacity: 0.9; }
	.empty-code { font-family: var(--mono); font-size: 30px; font-weight: 500; letter-spacing: 5px; }
	.empty-text-side { display: flex; flex-direction: column; gap: 18px; }
	.empty-title { font-size: 28px; font-weight: 600; }
	.empty-body { font-size: 16px; color: var(--ink-2); }
	.empty-steps { display: flex; flex-direction: column; gap: 10px; }
	.empty-step { display: flex; align-items: center; gap: 12px; font-size: 16px; }
	.step-n { width: 28px; height: 28px; border-radius: 6px; background: var(--accent-soft); color: var(--accent-ink); display: grid; place-items: center; font-size: 13px; flex: none; }

	/* Dashboard */
	.dashboard-inner { flex: 1; display: flex; min-height: 0; }
	.dashboard-inner.has-panel .dashboard-content { border-right: 1px solid var(--line); }
	.dashboard-content { flex: 1; min-width: 0; padding: 20px 40px; display: flex; flex-direction: column; gap: 16px; }
	@media (max-width: 767px) { .dashboard-content { padding: 16px; } }

	.dashboard-toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
	.focus-bar { position: relative; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 14px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--accent-soft); }
	.focus-star { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--accent-ink); }
	.focus-title { font-size: 15px; font-weight: 500; }
	.focus-change-btn { display: inline-flex; align-items: center; height: 30px; padding: 0 10px; border-radius: 6px; background: var(--surface); border: 1px solid var(--accent-line); font-size: 13px; font-weight: 500; cursor: pointer; }
	.focus-dropdown { position: absolute; top: calc(100% + 4px); left: 0; z-index: 10; width: 320px; max-height: 300px; overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow-pop); display: flex; flex-direction: column; padding: 4px; }
	.focus-option { padding: 8px 10px; border-radius: 6px; text-align: left; font-size: 14px; cursor: pointer; }
	.focus-option:hover { background: var(--subtle); }
	.focus-option.current { background: var(--accent-soft); color: var(--accent-ink); }

	.update-hint { margin-left: auto; font-size: 13px; color: var(--ink-3); }
	.view-seg { display: flex; padding: 3px; border-radius: 8px; background: var(--subtle); font-size: 13px; font-weight: 500; }
	.view-seg button { padding: 5px 12px; border-radius: 6px; color: var(--ink-2); }
	.view-seg button.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgb(15 23 42 / 0.1); }

	.counters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
	@media (max-width: 767px) { .counters { grid-template-columns: 1fr 1fr; } }
	.counter-card { display: flex; flex-direction: column; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
	.counter-card.alert { border-color: var(--danger-line); background: var(--danger-soft); }
	.counter-val { font-size: 28px; line-height: 34px; font-weight: 600; }
	.counter-val.danger { color: var(--danger-ink); }
	.counter-lbl { font-size: 13px; color: var(--ink-2); }
	.counter-lbl.danger { color: var(--danger-ink); }

	/* Student table */
	.student-table { flex: 1; min-height: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; display: flex; flex-direction: column; }
	.table-header { display: grid; grid-template-columns: minmax(0,1.4fr) 160px 90px 120px 120px; padding: 0 16px; background: var(--subtle); border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3); }
	@media (max-width: 900px) { .table-header { display: none; } }
	.table-header span { padding: 9px 0; }
	.table-row { position: relative; display: grid; grid-template-columns: minmax(0,1.4fr) 160px 90px 120px 120px; align-items: center; padding: 0 16px; min-height: 44px; border-bottom: 1px solid var(--line); font-size: 14px; text-align: left; cursor: pointer; width: 100%; }
	@media (max-width: 900px) { .table-row { grid-template-columns: 1fr 120px; gap: 8px; min-height: 52px; } }
	.table-row:hover { background: var(--subtle); }
	.table-row.selected { background: var(--accent-soft); }
	.row-selection-indicator { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); }
	.row-name { font-weight: 500; position: relative; }

	/* Badges */
	.badge { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
	.badge.danger { background: var(--danger-soft); color: var(--danger-ink); }
	.badge.accent { background: var(--accent-soft); color: var(--accent-ink); font-weight: 500; }
	.badge.ok { background: var(--ok-soft); color: var(--ok-ink); font-weight: 500; }
	.badge.neutral { border: 1px solid var(--line); color: var(--ink-3); font-weight: 500; }

	.mono { font-family: var(--mono); font-size: 13px; }
	.dim { color: var(--ink-2); }

	/* Matrix */
	.matrix-legend { display: flex; gap: 18px; font-size: 13px; color: var(--ink-2); align-items: center; flex-wrap: wrap; }
	.ml-item { display: flex; align-items: center; gap: 6px; }
	.ml-cell { width: 18px; height: 18px; border-radius: 4px; display: grid; place-items: center; font-size: 11px; }
	.ml-cell.ok { background: var(--ok); color: #fff; }
	.ml-cell.started { background: var(--accent-soft); border: 1px solid var(--accent-line); color: var(--accent-ink); }
	.ml-cell.stuck { background: var(--danger); color: #fff; font-weight: 700; }
	.ml-cell.open { border: 1px solid var(--line-strong); }
	.ml-cell.locked { background: var(--subtle); color: var(--ink-3); }

	.matrix-table { flex: 1; min-height: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: auto; }
	.matrix-header { display: grid; grid-template-columns: 200px repeat(var(--cols, 11), 48px) minmax(0,1fr); align-items: center; padding: 0 16px; background: var(--subtle); border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 11px; color: var(--ink-3); position: sticky; top: 0; }
	.matrix-row { display: grid; grid-template-columns: 200px repeat(var(--cols, 11), 48px) minmax(0,1fr); align-items: center; padding: 0 16px; min-height: 46px; border-bottom: 1px solid var(--line); }
	.m-name { font-size: 14px; font-weight: 500; padding: 10px 0; }
	.m-cell-hdr { padding: 10px 0; text-align: center; }
	.m-cell-val { display: grid; place-items: center; }
	.mc-done { width: 26px; height: 26px; border-radius: 5px; background: var(--ok); color: #fff; display: grid; place-items: center; font-size: 12px; }
	.mc-started { width: 26px; height: 26px; border-radius: 5px; background: var(--accent-soft); border: 1px solid var(--accent-line); color: var(--accent-ink); display: grid; place-items: center; font-size: 10px; }
	.mc-stuck { width: 26px; height: 26px; border-radius: 5px; background: var(--danger); color: #fff; display: grid; place-items: center; font-size: 13px; font-weight: 700; }
	.mc-locked { width: 26px; height: 26px; border-radius: 5px; background: var(--subtle); color: var(--ink-3); display: grid; place-items: center; font-size: 12px; }
	.mc-open { width: 26px; height: 26px; border-radius: 5px; border: 1px solid var(--line-strong); }
	.m-prog { text-align: right; font-family: var(--mono); font-size: 13px; color: var(--ink-2); }

	/* Side Panel */
	.side-panel { width: 420px; flex: none; background: var(--surface); padding: 24px; display: flex; flex-direction: column; gap: 18px; box-shadow: var(--shadow-pop); overflow-y: auto; }
	@media (max-width: 900px) {
		.side-panel { position: fixed; inset: 0; z-index: 20; width: 100%; max-width: 100%; }
		.dashboard-inner.has-panel .dashboard-content { display: none; }
	}
	.panel-head { display: flex; align-items: flex-start; gap: 10px; }
	.panel-student-info { flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.panel-name { font-size: 22px; font-weight: 600; }
	.panel-badges { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
	.panel-step-info { font-size: 13px; color: var(--ink-3); }
	.panel-close { width: 32px; height: 32px; display: grid; place-items: center; color: var(--ink-3); border-radius: 6px; cursor: pointer; flex: none; }
	.panel-close:hover { background: var(--subtle); }

	.panel-section { display: flex; flex-direction: column; gap: 6px; }
	.panel-lbl { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3); }
	.query-box { padding: 12px 14px; border-radius: 10px; background: #0f172a; }
	.query-pre { font-family: var(--mono); font-size: 13px; line-height: 22px; color: #e2e8f0; white-space: pre-wrap; word-break: break-all; margin: 0; }
	.error-hint { display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--danger-line); background: var(--danger-soft); }
	.error-ico { width: 20px; height: 20px; flex: none; border-radius: 50%; background: var(--danger); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
	.error-msg { font-size: 14px; line-height: 20px; color: var(--danger-ink); }
	.panel-empty { font-size: 14px; color: var(--ink-3); }
	.panel-privacy { font-size: 12px; color: var(--ink-3); text-align: center; }
</style>
