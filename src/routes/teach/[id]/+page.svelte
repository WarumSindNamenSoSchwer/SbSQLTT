<script lang="ts">
	import { siteOrigin, siteHost } from '$lib/tabula/site.js';
	import { onMount, onDestroy, getContext } from 'svelte';
	import { page } from '$app/state';
	import {
		apiTeacherDashboard,
		apiTeacherMatrix,
		apiTeacherLastAttempt,
		apiTeacherPatchClass,
		apiTeacherComplete,
		apiTeacherPutLessons,
		apiTeacherGetLessons,
		type DashboardStudent,
		type MatrixRow,
		type LastAttempt,
	} from '$lib/tabula/api.js';
	import { CATALOG, LESSONS } from '$lib/tabula/lessons.js';
	import { tok } from '$lib/tabula/highlight.js';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import QRCode from 'qrcode';

	let dark = $state(false);
	$effect(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => mo.disconnect();
	});

	const ctx = getContext<{ cls: any; reload: () => void; setFocus: (l: string | null) => void }>('teachClass');

	// Echter QR-Code fuer den Leer-Zustand
	let emptyQr = $state<string | null>(null);
	$effect(() => {
		const code = ctx?.cls?.join_code as string | undefined;
		if (!code) return;
		QRCode.toDataURL(`${siteOrigin()}/beitreten/${code}`, { width: 472, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
			.then((u: string) => (emptyQr = u))
			.catch(() => (emptyQr = null));
	});

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
	let completeBusy = $state(false);
	let agoSeconds = $state(0);

	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let agoInterval: ReturnType<typeof setInterval> | null = null;

	const focusLesson = $derived(ctx?.cls?.focus_lesson ?? null);
	const focusCatalogEntry = $derived(CATALOG.find(c => c.id === focusLesson) ?? null);

	// Counters
	const countDone = $derived(students.filter(s => s.status === 'done').length);
	const countWork = $derived(students.filter(s => s.status === 'in_progress').length);
	const countStuck = $derived(students.filter(s => s.status === 'stuck').length);
	const countNone = $derived(students.filter(s => s.status === 'not_started').length);
	const total = $derived(students.length);

	// sorted: stuck first, then in_progress, then done, then not_started
	const sortedStudents = $derived([...students].sort((a, b) => {
		const order = { stuck: 0, in_progress: 1, done: 2, not_started: 3 };
		return order[a.status] - order[b.status];
	}));

	// Schüler die hängen fest (für "Braucht Hilfe" Karte)
	const stuckStudents = $derived(students.filter(s => s.status === 'stuck'));

	// Schritt-Verteilung: Balkendiagramm
	const stepDistribution = $derived(() => {
		if (!focusLesson) return [];
		const lesson = LESSONS[focusLesson];
		if (!lesson) return [];
		const stepCount = lesson.steps.length;
		if (stepCount === 0) return [];
		// Zähle Schüler je Schritt
		const counts = new Array(stepCount).fill(0);
		const stuckAt = new Array(stepCount).fill(false);
		for (const s of students) {
			if (s.status === 'done') {
				counts[stepCount - 1]++;
				continue;
			}
			const idx = s.current_step ?? s.step ?? 0;
			const safeIdx = Math.min(idx, stepCount - 1);
			counts[safeIdx]++;
			if (s.status === 'stuck') stuckAt[safeIdx] = true;
		}
		const maxCount = Math.max(...counts, 1);
		return counts.map((n, i) => ({
			n: i + 1,
			count: n,
			stuck: stuckAt[i],
			h: Math.max(4, Math.round((n / maxCount) * 88)),
		}));
	});

	function relTime(ts: number | null | undefined): string {
		if (!ts) return '–';
		const s = Math.floor(Date.now() / 1000 - ts);
		if (s < 60) return 'gerade eben';
		if (s < 3600) return `vor ${Math.floor(s / 60)} min`;
		if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
		return `vor ${Math.floor(s / 86400)} Tagen`;
	}

	function fmtTime(ts: number | null | undefined): string {
		if (!ts) return '';
		const d = new Date(ts * 1000);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr`;
	}

	const currentTaskText = $derived(() => {
		if (!selectedStudent || !focusLesson) return null;
		const lesson = LESSONS[focusLesson];
		if (!lesson) return null;
		const stepIdx = selectedStudent.current_step;
		if (stepIdx == null) return null;
		const step = lesson.steps[stepIdx];
		if (!step) return null;
		return (step as any).task ?? (step as any).prompt ?? null;
	});

	const panelStepLabel = $derived(() => {
		const s = selectedStudent;
		if (!s || s.current_step == null || s.total_steps == null) return null;
		const display = Math.min(s.current_step + 1, s.total_steps);
		return `${display} von ${s.total_steps}`;
	});

	onMount(() => {
		loadData();
		startPolling();
		agoInterval = setInterval(() => {
			if (lastUpdate > 0) agoSeconds = Math.round((Date.now() - lastUpdate) / 1000);
		}, 1000);
		document.addEventListener('visibilitychange', handleVisibility);
		return () => {
			stopPolling();
			clearInterval(agoInterval ?? undefined);
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});

	function handleVisibility() {
		if (document.visibilityState === 'visible') startPolling();
		else stopPolling();
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
				agoSeconds = 0;
				if (selectedStudent) {
					const updated = res.students.find(s => s.user_id === selectedStudent!.user_id);
					if (updated) selectedStudent = updated;
				}
			} else {
				const res = await apiTeacherMatrix(classId);
				matrixRows = res.rows;
				matrixLessonIds = res.lesson_ids;
				lastUpdate = Date.now();
				agoSeconds = 0;
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
		return e ? `${e.n} · ${e.title}` : id;
	}

	function getMatrixLessonLabel(id: string): string {
		const e = CATALOG.find(c => c.id === id);
		return e ? e.n : id;
	}

	function stepDisplay(s: DashboardStudent): string {
		if (s.total_steps == null) return '–';
		if (s.status === 'done') return `${s.total_steps} / ${s.total_steps}`;
		if (s.current_step != null) return `${s.current_step + 1} / ${s.total_steps}`;
		if (s.step != null) return `${s.step + 1} / ${s.total_steps}`;
		return `1 / ${s.total_steps}`;
	}

	async function markComplete() {
		if (!selectedStudent || !focusLesson || completeBusy) return;
		const stepIdx = selectedStudent.current_step ?? (selectedStudent.step ?? 0);
		completeBusy = true;
		try {
			await apiTeacherComplete(classId, selectedStudent.user_id, focusLesson, stepIdx);
			await loadData();
		} catch {
			// ignore
		} finally {
			completeBusy = false;
		}
	}

	async function setFocusLesson(lessonId: string) {
		try {
			const res = await apiTeacherGetLessons(classId);
			const updated = res.lessons.map((s: any) => ({ ...s, is_focus: s.lesson_id === lessonId, unlocked: s.lesson_id === lessonId ? true : s.unlocked }));
			await apiTeacherPutLessons(classId, updated);
			ctx?.setFocus(lessonId);
		} catch {
			// ignore
		}
	}
</script>

{#if loading && students.length === 0 && matrixRows.length === 0}
	<div class="spinner-wrap"><span class="spinner"></span></div>
{:else if students.length === 0 && matrixRows.length === 0 && viewMode === 'focus'}
	<!-- Leerer Zustand -->
	<div class="empty-dashboard">
		<div class="empty-qr-side">
			<div class="empty-qr-box">
				{#if emptyQr}
					<img class="qr-real" src={emptyQr} alt="QR-Code zum Beitreten der Klasse" />
				{:else}
					<div class="qr-mock" aria-hidden="true"></div>
				{/if}
			</div>
			<div class="empty-code mono">{ctx?.cls?.join_code ?? '------'}</div>
		</div>
		<div class="empty-text-side">
			<Edgar pose="wave" {dark} class="empty-wave-owl" />
			<h2 class="empty-title">Noch niemand beigetreten</h2>
			<p class="empty-body">Zeigen Sie diesen Code oder QR-Code. Schüler öffnen {siteHost()}/beitreten und geben den Code ein.</p>
			<ol class="empty-steps">
				<li>QR-Code scannen oder Code eingeben</li>
				<li>Name und Passwort festlegen</li>
				<li>Fertig. Der Schüler erscheint hier.</li>
			</ol>
		</div>
	</div>
{:else}
	<div class="dashboard-inner" class:has-panel={selectedStudent !== null}>
		<div class="dashboard-content">

			<!-- Fokus-Leiste -->
			<div class="focus-bar">
				<span class="focus-label">Fokus</span>
				<select
					aria-label="Fokus-Lektion"
					class="focus-select"
					value={focusLesson ?? ''}
					onchange={async (e) => {
						const val = (e.target as HTMLSelectElement).value;
						if (val) await setFocusLesson(val);
					}}
				>
					<option value="">– Kein Fokus –</option>
					{#each CATALOG as c}
						<option value={c.id}>{c.n} · {c.title}</option>
					{/each}
				</select>
				<span class="focus-bar-grow"></span>
				<div class="view-seg" role="tablist" aria-label="Ansicht">
					<button role="tab" aria-selected={viewMode === 'focus'} class:active={viewMode === 'focus'} onclick={() => switchView('focus')}>Fokus</button>
					<button role="tab" aria-selected={viewMode === 'matrix'} class:active={viewMode === 'matrix'} onclick={() => switchView('matrix')}>Alle Lektionen</button>
				</div>
				<span aria-live="polite" class="ago-hint">Aktualisiert vor {agoSeconds} s</span>
			</div>

			{#if viewMode === 'focus'}

				<!-- "Braucht Hilfe" Karte -->
				<section class="help-card" aria-label="Braucht Hilfe">
					<div class="help-card-head">
						<Edgar pose={stuckStudents.length > 0 ? 'thinking' : 'idle'} {dark} class="help-edgar" />
						<h2 class="help-card-title">
							{#if stuckStudents.length > 0}
								{stuckStudents.length} {stuckStudents.length === 1 ? 'braucht' : 'brauchen'} Hilfe
							{:else}
								Gerade hängt niemand fest
							{/if}
						</h2>
					</div>
					{#each stuckStudents as s (s.user_id)}
						<button
							type="button"
							class="stuck-row"
							onclick={() => selectStudent(s)}
						>
							<span class="stuck-row-top">
								<strong class="stuck-name">{s.display_name}</strong>
								<span class="stuck-meta">Schritt {stepDisplay(s)} · {s.attempts} Fehlversuche</span>
								<span class="stuck-open" aria-hidden="true">Ansehen →</span>
							</span>
							{#if s.attempts > 0}
								<span class="stuck-badge-err">! Hängt fest</span>
							{/if}
						</button>
					{/each}
				</section>

				<!-- Wo die Klasse steht (Schritt-Histogramm) -->
				{#if focusLesson && stepDistribution().length > 0}
					<section class="hist-section" aria-label="Wo die Klasse in der Lektion steht">
						<div class="hist-head">
							<h2 class="hist-title">Wo die Klasse in der Lektion steht</h2>
							<span class="hist-hint">Schüler pro Schritt · rot: dort hängt jemand fest</span>
						</div>
						<div class="hist-bars" role="img" aria-label="Schüler je Schritt">
							{#each stepDistribution() as bar}
								<div class="hist-col" title="Schritt {bar.n}: {bar.count} Schüler{bar.stuck ? ' (hängt fest)' : ''}">
									{#if bar.count > 0}
										<span class="hist-count">{bar.count}</span>
									{/if}
									<span class="hist-bar" style="height:{bar.h}px;background:{bar.stuck ? 'var(--danger)' : 'var(--accent-soft)'}"></span>
								</div>
							{/each}
						</div>
						<div class="hist-labels">
							{#each stepDistribution() as bar}
								<span class="hist-lbl">{bar.n}</span>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Status-Leiste -->
				{#if total > 0}
					<div class="status-bar-wrap">
						{#if countDone > 0}<span class="status-seg" style="flex:{countDone};background:var(--ok)"></span>{/if}
						{#if countWork > 0}<span class="status-seg" style="flex:{countWork};background:var(--accent)"></span>{/if}
						{#if countStuck > 0}<span class="status-seg" style="flex:{countStuck};background:var(--danger)"></span>{/if}
						{#if countNone > 0}<span class="status-seg" style="flex:{countNone};background:var(--subtle)"></span>{/if}
					</div>
					<div class="status-legend">
						<span class="status-item"><span class="status-dot" style="background:var(--ok)"></span><strong>{countDone}</strong> Fertig</span>
						<span class="status-item"><span class="status-dot" style="background:var(--accent)"></span><strong>{countWork}</strong> In Arbeit</span>
						<span class="status-item" class:danger={countStuck > 0}><span class="status-dot" style="background:var(--danger)"></span><strong>{countStuck}</strong> Hängt fest</span>
						<span class="status-item"><span class="status-dot" style="background:var(--line-strong)"></span><strong>{countNone}</strong> Nicht begonnen</span>
					</div>
				{/if}

				<!-- Schüler-Tabelle -->
				<div class="student-table-wrap">
					<table class="student-table">
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Status</th>
								<th scope="col" class="th-right">Schritt</th>
								<th scope="col" class="th-right">Fehlversuche</th>
								{#if students.some(s => s.last_active)}<th scope="col" class="th-right">Zuletzt aktiv</th>{/if}
							</tr>
						</thead>
						<tbody>
							{#each sortedStudents as s (s.user_id)}
								<tr
									class="student-row"
									class:selected={selectedStudent?.user_id === s.user_id}
									onclick={() => selectStudent(s)}
								>
									<td class="td-name">
										{#if selectedStudent?.user_id === s.user_id}
											<span class="row-sel-bar" aria-hidden="true"></span>
										{/if}
										{s.display_name}
									</td>
									<td>
										{#if s.status === 'stuck'}
											<span class="badge danger">! Hängt fest</span>
										{:else if s.status === 'in_progress'}
											<span class="badge accent">● In Arbeit</span>
										{:else if s.status === 'done'}
											<span class="badge ok">✓ Fertig</span>
										{:else}
											<span class="badge neutral">○ Nicht begonnen</span>
										{/if}
									</td>
									<td class="td-mono td-right">{stepDisplay(s)}</td>
									<td class="td-mono td-right" class:fail-ink={s.attempts > 3}>{s.attempts > 0 ? s.attempts : '–'}</td>
									{#if students.some(ss => ss.last_active)}
										<td class="td-right td-dim">{relTime(s.last_active)}</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

			{:else}
				<!-- Matrix-Ansicht: Alle Lektionen -->
				<div class="matrix-legend">
					<span class="ml-item"><span class="ml-cell ok">✓</span> Fertig</span>
					<span class="ml-item"><span class="ml-cell started">●</span> Begonnen</span>
					<span class="ml-item"><span class="ml-cell stuck">!</span> Hängt fest</span>
					<span class="ml-item"><span class="ml-cell open"></span> Offen</span>
					<span class="ml-item"><span class="ml-cell locked">–</span> Gesperrt</span>
				</div>
				<div class="matrix-table-wrap" style="--cols: {matrixLessonIds.length}">
					<table class="matrix-table">
						<thead>
							<tr>
								<th scope="col" class="m-name-hdr">Name</th>
								{#each matrixLessonIds as lid}
									<th scope="col" class="m-cell-hdr mono" title={getLessonLabel(lid)}>{getMatrixLessonLabel(lid)}</th>
								{/each}
								<th scope="col" class="m-prog-hdr">Fortschritt</th>
							</tr>
						</thead>
						<tbody>
							{#each matrixRows as row (row.user_id)}
								<tr class="matrix-row">
									<td class="m-name">{row.display_name}</td>
									{#each row.cells as cell}
										<td class="m-cell-val">
											{#if cell.status === 'done'}<span class="mc-done">✓</span>
											{:else if cell.status === 'started'}<span class="mc-started">●</span>
											{:else if cell.status === 'stuck'}<span class="mc-stuck">!</span>
											{:else if cell.status === 'locked'}<span class="mc-locked">–</span>
											{:else}<span class="mc-open"></span>
											{/if}
										</td>
									{/each}
									<td class="m-prog mono">{row.progress}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		{#if selectedStudent}
			<!-- Detail-Drawer -->
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
							{#if panelStepLabel()}
								<span class="panel-step-info">Schritt {panelStepLabel()} · {selectedStudent.attempts} Fehlversuche</span>
							{/if}
						</div>
					</div>
					<button class="panel-close" onclick={closePanel} aria-label="Schließen">✕</button>
				</div>

				{#if panelLoading}
					<div class="spinner-wrap-sm"><span class="spinner"></span></div>
				{:else}
					{#if currentTaskText()}
						<div class="panel-section">
							<span class="panel-lbl">AUFGABE</span>
							<p class="panel-task">{currentTaskText()}</p>
						</div>
					{/if}

					{#if selectedAttempt}
						{#if selectedAttempt.query}
							<div class="panel-section">
								<span class="panel-lbl">LETZTE ABFRAGE · {relTime(selectedAttempt.updated_at).toUpperCase()}</span>
								<div class="query-box">
									{#each selectedAttempt.query.split('\n') as line, i}
										<div class="query-line" class:query-line-err={selectedAttempt.error_msg && i === selectedAttempt.query.split('\n').length - 1}>
											{#each tok(line) as token}
												<span style="color:{token.c}">{token.t}</span>
											{/each}
										</div>
									{/each}
								</div>
							</div>
						{/if}
						{#if selectedAttempt.error_msg}
							<div class="panel-section">
								<span class="panel-lbl">FEHLERMELDUNG</span>
								<div class="error-hint">
									<span class="error-ico">!</span>
									<div class="error-msg-wrap">
										<span class="error-msg">{selectedAttempt.error_msg}</span>
										<span class="error-time mono">{fmtTime(selectedAttempt.updated_at)}</span>
									</div>
								</div>
							</div>
						{/if}
					{:else}
						<p class="panel-empty">Noch keine Abfrage gespeichert.</p>
					{/if}
				{/if}

				<span style="flex:1"></span>

				{#if selectedStudent.status !== 'done' && focusLesson}
					<button class="btn-complete" disabled={completeBusy} onclick={markComplete}>
						{completeBusy ? '…' : '✓ Als erledigt markieren'}
					</button>
				{/if}

				<p class="panel-privacy">Nur Sie sehen diese Ansicht. Schüler sehen keine Daten anderer.</p>
			</aside>
		{/if}
	</div>
{/if}

<style>
	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner-wrap-sm { display: grid; place-items: center; padding: 30px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	/* Leerer Zustand */
	.empty-dashboard { flex: 1; display: flex; flex-wrap: wrap; gap: 32px; align-items: center; justify-content: center; padding: 32px; }
	.empty-qr-side { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
	.qr-mock { width: 200px; height: 200px; border-radius: 6px; background: repeating-conic-gradient(var(--ink) 0 25%, transparent 0 50%) 0 0/20px 20px; opacity: 0.9; }
	.qr-real { width: 200px; height: 200px; display: block; border-radius: 6px; }
	.empty-code { font-family: var(--mono); font-size: 22px; font-weight: 500; letter-spacing: 2px; }
	.empty-text-side { flex: 1 1 300px; display: flex; flex-direction: column; gap: 14px; max-width: 440px; }
	:global(.empty-wave-owl) { width: 80px; height: 72px; }
	.empty-title { font-size: 22px; font-weight: 600; margin: 0; }
	.empty-body { font-size: 15px; color: var(--ink-2); margin: 0; }
	.empty-steps { margin: 0; padding-left: 20px; font-size: 15px; color: var(--ink-2); line-height: 2; }

	/* Dashboard Layout */
	.dashboard-inner { flex: 1; display: flex; min-height: 0; }
	.dashboard-inner.has-panel .dashboard-content { border-right: 1px solid var(--line); }
	.dashboard-content { flex: 1; min-width: 0; padding: 20px clamp(16px,3vw,40px); display: flex; flex-direction: column; gap: 14px; }

	/* Fokus-Leiste */
	.focus-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
	.focus-label { font-size: 14px; color: var(--ink-3); white-space: nowrap; }
	.focus-select { height: 36px; padding: 0 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); font-size: 14px; font-weight: 600; min-width: 220px; color: var(--ink); cursor: pointer; }
	.focus-select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
	.focus-bar-grow { flex: 1; }
	.view-seg { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--subtle); font-size: 13px; font-weight: 500; }
	.view-seg button { height: 30px; padding: 0 12px; border-radius: 6px; color: var(--ink-2); cursor: pointer; }
	.view-seg button.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgb(15 23 42 / 0.1); }
	.ago-hint { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }

	/* Braucht-Hilfe Karte */
	.help-card { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); overflow: hidden; }
	.help-card-head { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
	:global(.help-edgar) { width: 44px; height: 40px; flex: none; }
	.help-card-title { font-size: 16px; font-weight: 600; margin: 0; flex: 1; }
	.stuck-row { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 14px 18px; border-bottom: 1px solid var(--line); background: transparent; cursor: pointer; }
	.stuck-row:hover { background: var(--subtle); }
	.stuck-row-top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
	.stuck-name { font-size: 15px; font-weight: 600; }
	.stuck-meta { font-size: 13px; color: var(--ink-3); white-space: nowrap; }
	.stuck-open { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--accent-ink); white-space: nowrap; }
	.stuck-badge-err { align-self: flex-start; font-size: 13px; padding: 2px 8px; border-radius: 5px; background: var(--danger-soft); color: var(--danger-ink); }

	/* Histogramm */
	.hist-section { padding: 16px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
	.hist-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
	.hist-title { margin: 0; font-size: 16px; font-weight: 600; flex: 1; }
	.hist-hint { font-size: 13px; color: var(--ink-3); }
	.hist-bars { display: flex; align-items: flex-end; gap: 4px; height: 96px; }
	.hist-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; height: 100%; }
	.hist-count { font: 600 11px/1 var(--mono); color: var(--ink-2); }
	.hist-bar { width: 100%; min-height: 3px; border-radius: 4px 4px 0 0; }
	.hist-labels { display: flex; gap: 4px; margin-top: 5px; }
	.hist-lbl { flex: 1; text-align: center; font: 11px/1 var(--mono); color: var(--ink-3); }

	/* Status-Leiste */
	.status-bar-wrap { display: flex; height: 8px; border-radius: 5px; overflow: hidden; gap: 2px; }
	.status-seg { border-radius: 3px; transition: flex 0.3s; }
	.status-legend { display: flex; gap: 8px 24px; flex-wrap: wrap; }
	.status-item { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink-2); }
	.status-item.danger strong { color: var(--danger-ink); }
	.status-dot { width: 8px; height: 8px; border-radius: 2px; flex: none; }

	/* Schüler-Tabelle */
	.student-table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
	.student-table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 14px; }
	.student-table thead { background: var(--subtle); }
	.student-table th { text-align: left; padding: 10px 18px; font: 500 12px/1 var(--mono); letter-spacing: 0.06em; color: var(--ink-3); border-bottom: 1px solid var(--line); }
	.th-right { text-align: right; }
	.student-row { cursor: pointer; transition: background 0.1s; }
	.student-row:hover { background: var(--subtle); }
	.student-row.selected { background: var(--accent-soft); }
	.student-row td { padding: 11px 18px; border-bottom: 1px solid var(--line); vertical-align: middle; }
	.student-row:last-child td { border-bottom: none; }
	.td-name { font-weight: 500; position: relative; }
	.row-sel-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); }
	.td-mono { font-family: var(--mono); font-size: 13px; }
	.td-right { text-align: right; }
	.td-dim { color: var(--ink-3); }
	.fail-ink { color: var(--danger-ink); }

	/* Badges */
	.badge { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
	.badge.danger { background: var(--danger-soft); color: var(--danger-ink); }
	.badge.accent { background: var(--accent-soft); color: var(--accent-ink); font-weight: 500; }
	.badge.ok { background: var(--ok-soft); color: var(--ok-ink); font-weight: 500; }
	.badge.neutral { border: 1px solid var(--line); color: var(--ink-3); font-weight: 500; }

	/* Matrix */
	.matrix-legend { display: flex; gap: 18px; font-size: 13px; color: var(--ink-2); align-items: center; flex-wrap: wrap; }
	.ml-item { display: flex; align-items: center; gap: 6px; }
	.ml-cell { width: 18px; height: 18px; border-radius: 4px; display: grid; place-items: center; font-size: 11px; }
	.ml-cell.ok { background: var(--ok); color: #fff; }
	.ml-cell.started { background: var(--accent-soft); border: 1px solid var(--accent-line); color: var(--accent-ink); }
	.ml-cell.stuck { background: var(--danger); color: #fff; font-weight: 700; }
	.ml-cell.open { border: 1px solid var(--line-strong); }
	.ml-cell.locked { background: var(--subtle); color: var(--ink-3); }

	.matrix-table-wrap { overflow: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
	.matrix-table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
	.m-name-hdr { position: sticky; left: 0; background: var(--surface); text-align: left; padding: 10px 16px; font: 500 12px/1 var(--mono); letter-spacing: 0.06em; color: var(--ink-3); border-bottom: 1px solid var(--line); min-width: 140px; }
	.m-cell-hdr { padding: 10px 4px; text-align: center; font: 600 12px/1 var(--mono); color: var(--ink-3); border-bottom: 1px solid var(--line); min-width: 40px; }
	.m-prog-hdr { text-align: right; padding: 10px 16px; font: 500 12px/1 var(--mono); color: var(--ink-3); border-bottom: 1px solid var(--line); }
	.matrix-row td { padding: 6px 4px; border-bottom: 1px solid var(--line); }
	.matrix-row:last-child td { border-bottom: none; }
	.m-name { position: sticky; left: 0; background: var(--surface); padding: 6px 16px; font-weight: 500; white-space: nowrap; }
	.m-cell-val { text-align: center; }
	.mc-done { width: 26px; height: 26px; border-radius: 5px; background: var(--ok); color: #fff; display: grid; place-items: center; font-size: 12px; }
	.mc-started { width: 26px; height: 26px; border-radius: 5px; background: var(--accent-soft); border: 1px solid var(--accent-line); color: var(--accent-ink); display: grid; place-items: center; font-size: 10px; }
	.mc-stuck { width: 26px; height: 26px; border-radius: 5px; background: var(--danger); color: #fff; display: grid; place-items: center; font-size: 13px; font-weight: 700; }
	.mc-locked { width: 26px; height: 26px; border-radius: 5px; background: var(--subtle); color: var(--ink-3); display: grid; place-items: center; font-size: 12px; }
	.mc-open { width: 26px; height: 26px; border-radius: 5px; border: 1px solid var(--line-strong); display: block; }
	.m-prog { text-align: right; font-family: var(--mono); font-size: 13px; color: var(--ink-2); padding-right: 12px; }

	/* Detail-Drawer */
	.side-panel { width: 420px; flex: none; background: var(--surface); padding: 24px; display: flex; flex-direction: column; gap: 18px; box-shadow: var(--shadow-pop); overflow-y: auto; }
	@media (max-width: 900px) {
		.side-panel { position: fixed; inset: 0; z-index: 20; width: 100%; max-width: 100%; }
		.dashboard-inner.has-panel .dashboard-content { display: none; }
	}
	.panel-head { display: flex; align-items: flex-start; gap: 10px; }
	.panel-student-info { flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.panel-name { font-size: 22px; line-height: 28px; font-weight: 600; margin: 0; }
	.panel-badges { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
	.panel-step-info { font-size: 13px; color: var(--ink-3); }
	.panel-close { width: 32px; height: 32px; display: grid; place-items: center; color: var(--ink-3); border-radius: 6px; cursor: pointer; flex: none; }
	.panel-close:hover { background: var(--subtle); }

	.panel-section { display: flex; flex-direction: column; gap: 4px; }
	.panel-lbl { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3); }
	.panel-task { font-size: 15px; line-height: 22px; color: var(--ink); margin: 0; }

	.query-box { padding: 12px 14px; border-radius: 10px; background: #0f172a; font-family: var(--mono); font-size: 13px; line-height: 22px; }
	.query-line { white-space: pre-wrap; word-break: break-all; }
	.query-line-err { background: rgb(248 113 113 / 0.14); box-shadow: inset 3px 0 #f87171; margin: 0 -14px; padding: 0 14px; }

	.error-hint { display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--danger-line); background: var(--danger-soft); }
	.error-ico { width: 20px; height: 20px; flex: none; border-radius: 50%; background: var(--danger); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
	.error-msg-wrap { display: flex; flex-direction: column; gap: 2px; }
	.error-msg { font-size: 14px; line-height: 20px; font-weight: 500; color: var(--danger-ink); }
	.error-time { font-size: 11px; color: var(--ink-3); }

	.panel-empty { font-size: 14px; color: var(--ink-3); margin: 0; }
	.panel-privacy { font-size: 12px; color: var(--ink-3); text-align: center; margin: 0; }

	.btn-complete { display: flex; align-items: center; justify-content: center; width: 100%; height: 44px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-complete:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-complete:disabled { opacity: 0.6; cursor: default; }

	.mono { font-family: var(--mono); }

	@media (prefers-reduced-motion: reduce) { .status-seg { transition: none; } }
</style>
