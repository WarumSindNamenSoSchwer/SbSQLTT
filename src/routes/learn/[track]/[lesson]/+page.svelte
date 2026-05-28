<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		CURRENT_LESSON,
		TRACKS,
		runSQL,
		highlightSQL,
		type CheckStep,
		type Row
	} from '$lib/data';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Kbd from '$lib/components/Kbd.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Editor from '$lib/components/Editor.svelte';

	// TODO: look up lesson by [track]/[lesson] params; for now uses CURRENT_LESSON from data.ts
	const L = CURRENT_LESSON;

	// Prev / next lookup based on the current lesson's track + id.
	const track = TRACKS.find((t) => t.id === L.track);
	const lessonIdx = track ? track.lessons.findIndex((l) => l.id === L.id) : -1;
	const prevLesson =
		track && lessonIdx > 0 ? track.lessons[lessonIdx - 1] : null;
	const nextLesson =
		track && lessonIdx >= 0 && lessonIdx < track.lessons.length - 1
			? track.lessons[lessonIdx + 1]
			: null;
	const checkStepIdx = L.steps.findIndex((s) => s.kind === 'check');
	const checkStep = L.steps[checkStepIdx] as CheckStep;
	const initialSql = checkStep.starter;

	let activeStep = $state(checkStepIdx);
	let completed = $state(
		new Set<number>(
			L.steps
				.map((_, i) => (i < checkStepIdx ? i : null))
				.filter((v): v is number => v !== null)
		)
	);
	let sql = $state(checkStep.starter);

	type ResultState =
		| { kind: 'idle' }
		| { kind: 'running' }
		| { kind: 'ok'; columns: string[]; rows: Row[]; ms: number }
		| { kind: 'error'; error: string };

	let result = $state<ResultState>({ kind: 'idle' });
	let tab = $state<'lesson' | 'editor' | 'result'>('lesson');

	let dirty = $derived(sql !== initialSql);
	let total = $derived(L.steps.length);
	let done = $derived(completed.size);
	let pct = $derived(done / total);

	function run() {
		result = { kind: 'running' };
		const t0 = performance.now();
		setTimeout(() => {
			try {
				const r = runSQL(sql);
				const ms = Math.max(0.4, Math.round((performance.now() - t0) * 10) / 10);
				result = { kind: 'ok', columns: r.columns, rows: r.rows, ms };
				tab = 'result';
				const cs = L.steps[checkStepIdx] as CheckStep;
				if (
					cs.expected.rowsMatch(r.rows) &&
					cs.expected.columns.every((c, i) => r.columns[i] === c)
				) {
					completed = new Set([...completed, checkStepIdx]);
				}
			} catch (e) {
				result = { kind: 'error', error: (e as Error).message };
				tab = 'result';
			}
		}, 180);
	}

	$effect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
				e.preventDefault();
				run();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function typeColOf(rows: Row[], c: string): string {
		const sample = rows.find((r) => r[c] !== null && r[c] !== undefined);
		if (!sample) return '';
		const v = sample[c];
		if (typeof v === 'number') return 'int';
		if (typeof v === 'boolean') return 'bool';
		return 'text';
	}

	function formatCell(v: string | number | boolean | null | undefined): string {
		if (v === null || v === undefined) return 'NULL';
		if (typeof v === 'number') return v.toLocaleString('de-DE');
		return String(v);
	}
</script>

<div class="min-h-[calc(100vh-3.5rem)] bg-ink-0 flex flex-col">
	<!-- ===== Lesson header ===== -->
	<div class="border-b border-ink-200 bg-ink-50/40">
		<div class="px-4 md:px-6 h-13 py-3 flex items-center justify-between gap-4">
			<div class="flex items-center gap-3 min-w-0">
				<button
					onclick={() => goto('/learn')}
					class="text-[12px] text-ink-700 hover:text-ink-900 font-mono inline-flex items-center gap-1"
				>
					<Icon name="arrow" size={12} class="rotate-180" />
					<span class="hidden sm:inline">Alle Lektionen</span>
				</button>
				<span class="text-ink-300">·</span>
				<div class="min-w-0">
					<div class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600">
						Anfänger · Lektion 2/5
					</div>
					<div class="text-[14px] font-semibold tracking-tight text-ink-900 truncate">
						{L.title}
					</div>
				</div>
			</div>

			<div class="flex items-center gap-4">
				<!-- step pips -->
				<div class="hidden sm:flex items-center gap-1.5">
					{#each L.steps as _, i (i)}
						{@const isDone = completed.has(i)}
						{@const isActive = i === activeStep}
						<div class="flex items-center gap-1.5">
							<span
								class={'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono ' +
									(isDone
										? 'bg-accent text-[oklch(0.16_0.04_195)]'
										: isActive
											? 'bg-accent-soft text-accent border border-[oklch(0.72_0.15_195_/_0.4)] step-active'
											: 'bg-ink-200 text-ink-700')}
							>
								{#if isDone}
									<Icon name="check" size={10} sw={2.4} />
								{:else}
									{i + 1}
								{/if}
							</span>
							{#if i < L.steps.length - 1}
								<span class={'block w-4 h-px ' + (isDone ? 'bg-accent' : 'bg-ink-300')}
								></span>
							{/if}
						</div>
					{/each}
				</div>

				<span class="hidden md:inline text-[12px] font-mono text-ink-700 tabular-num">
					Schritt {activeStep + 1} von {total}
				</span>
				<span class="hidden md:inline text-[12px] font-mono text-ink-600 tabular-num">
					· {Math.round(pct * 100)} % erledigt
				</span>
				{#if nextLesson}
					<Button
						variant="ghost"
						size="sm"
						class="!h-7"
						onclick={() => goto(`/learn/${L.track}/${nextLesson.id}`)}
					>
						Nächste Lektion
						{#snippet trailing()}<Icon name="arrow" size={12} />{/snippet}
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Mobile tabs -->
	<div class="md:hidden border-b border-ink-200 px-3">
		<div class="flex gap-1">
			{#each [['lesson', 'Lektion'], ['editor', 'Editor'], ['result', 'Ergebnis']] as const as [t, label] (t)}
				<button
					onclick={() => (tab = t)}
					class={'h-10 px-3 text-[13px] font-medium border-b-2 -mb-px ' +
						(tab === t
							? 'text-ink-900 border-accent'
							: 'text-ink-700 border-transparent hover:text-ink-900')}
				>
					{label}
					{#if t === 'result' && result.kind === 'ok'}
						<span class="ml-2 text-[11px] font-mono text-ink-600">{result.rows.length}</span>
					{/if}
					{#if t === 'result' && result.kind === 'error'}
						<span class="ml-2 text-[11px] font-mono text-err">!</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Desktop 3-pane / mobile tab content -->
	<div class="flex-1 min-h-0 md:grid md:grid-cols-[minmax(320px,30%)_1fr] md:gap-0">
		<!-- Left: lesson narrative -->
		<aside
			class={'border-r border-ink-200 bg-ink-50/40 overflow-y-auto ' +
				(tab === 'lesson' ? 'block' : 'hidden md:block')}
			style="max-height: calc(100vh - 3.5rem - 3.25rem)"
		>
			<div class="px-6 md:px-7 py-6 md:py-8 max-w-[640px] md:max-w-none">
				<div
					class="text-[11px] font-mono uppercase tracking-[0.14em] text-accent"
				>
					Lektion
				</div>
				<h1
					class="mt-2 text-[22px] md:text-[24px] font-semibold tracking-tight text-ink-900"
					style="text-wrap: balance"
				>
					{L.title}
				</h1>
				<p class="mt-2 text-[13.5px] leading-relaxed text-ink-700">{L.subtitle}</p>

				<div class="mt-7 space-y-7">
					{#each L.steps as step, i (i)}
						{@const isActive = i === activeStep}
						{@const isDone = completed.has(i)}
						{@const isCheck = i === checkStepIdx}
						<div
							role="button"
							tabindex="0"
							onclick={() => (activeStep = i)}
							onkeydown={(e) => {
								if (e.key === 'Enter') activeStep = i;
							}}
							class={'group relative pl-9 cursor-pointer transition ' +
								(isActive ? '' : 'opacity-90 hover:opacity-100')}
						>
							<span
								class={'absolute left-0 top-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono ' +
									(isDone
										? 'bg-accent text-[oklch(0.16_0.04_195)]'
										: isActive
											? 'bg-accent-soft text-accent border border-[oklch(0.72_0.15_195_/_0.45)] step-active'
											: 'bg-ink-200 text-ink-700 border border-ink-300')}
							>
								{#if isDone}
									<Icon name="check" size={11} sw={2.4} />
								{:else}
									{i + 1}
								{/if}
							</span>
							<div class="flex items-baseline gap-2">
								<h3
									class={'text-[14.5px] font-semibold tracking-tight ' +
										(isActive ? 'text-ink-900' : 'text-ink-900/85')}
								>
									{step.title}
								</h3>
								{#if isCheck}
									<Badge tone="accent" class="!h-5 !text-[10px]">Übung</Badge>
								{/if}
							</div>
							<p
								class="mt-2 text-[13.5px] leading-relaxed text-ink-700"
								style="text-wrap: pretty"
							>
								{step.body}
							</p>
							{#if step.kind === 'read' && step.code}
								<pre
									class="mt-3 p-3 rounded-md bg-ink-100/60 border border-ink-200 font-mono text-[12.5px] leading-[20px] overflow-x-auto">{#each highlightSQL(step.code) as t, j (j)}<span
											class={t.cls}>{t.text}</span>{/each}</pre>
							{/if}
							{#if isCheck}
								<div class="mt-3 flex items-center gap-2">
									<Button
										variant="secondary"
										size="sm"
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											tab = 'editor';
										}}
									>
										Im Editor öffnen
										{#snippet trailing()}<Icon name="arrow" size={12} />{/snippet}
									</Button>
									{#if isDone}
										<span
											class="inline-flex items-center gap-1.5 text-[12px] text-accent font-mono"
										>
											<Icon name="check" size={12} sw={2.4} /> Prüfung bestanden
										</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<div
					class="mt-10 pt-6 border-t border-ink-200 flex items-center justify-between gap-4"
				>
					{#if prevLesson}
						<a
							href={`/learn/${L.track}/${prevLesson.id}`}
							class="text-[13px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1.5"
						>
							<Icon name="arrow" size={12} class="rotate-180" /> Zurück · {prevLesson.title}
						</a>
					{:else}
						<span></span>
					{/if}
					{#if nextLesson}
						<a
							href={`/learn/${L.track}/${nextLesson.id}`}
							class="text-[13px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1.5"
						>
							Weiter · {nextLesson.title} <Icon name="arrow" size={12} />
						</a>
					{/if}
				</div>
			</div>
		</aside>

		<!-- Right: editor + result -->
		<section class="md:grid md:grid-rows-[1fr_1fr] min-h-0">
			<div
				class={'border-b border-ink-200 ' +
					(tab === 'editor' ? 'block' : 'hidden md:block')}
				style="min-height: 0"
			>
				<!-- Editor pane wrapper -->
				<div class="h-full flex flex-col min-h-0 bg-ink-0">
					<Editor value={sql} onChange={(v) => (sql = v)} onRun={run} {dirty} />
					<div
						class="h-10 px-3 border-t border-ink-200 bg-ink-50/40 flex items-center justify-between"
					>
						<div
							class="text-[11.5px] font-mono text-ink-600 flex items-center gap-3"
						>
							<span class="inline-flex items-center gap-1">
								<Icon name="db" size={12} /> library.books
							</span>
							<span class="text-ink-500">·</span>
							<span>9 Zeilen</span>
						</div>
						<div class="flex items-center gap-2">
							<span
								class="hidden sm:inline-flex items-center gap-1 text-[11px] text-ink-600"
							>
								<Kbd>⌘</Kbd><Kbd>↵</Kbd>
							</span>
							<Button variant="primary" size="sm" onclick={run}>
								{#snippet leading()}<Icon name="play" size={10} />{/snippet}
								Ausführen
							</Button>
						</div>
					</div>
				</div>
			</div>

			<!-- Result panel -->
			<div
				class={tab === 'result' ? 'block' : 'hidden md:block'}
				style="min-height: 0"
			>
				<div class="flex flex-col h-full">
					<div
						class="flex items-center justify-between px-3 h-9 border-b border-ink-200 bg-ink-50/60"
					>
						<div
							class="flex items-center gap-2 text-[11px] font-mono text-ink-700"
						>
							<span
								class="dot"
								style={'background:' +
									(result.kind === 'ok'
										? 'oklch(0.72 0.15 195)'
										: result.kind === 'error'
											? '#e07a7a'
											: result.kind === 'running'
												? '#f0b48a'
												: '#3a3a47')}
							></span>
							<span>Ergebnis</span>
						</div>
						<div class="text-[11px] text-ink-700 font-mono tabular-num">
							{#if result.kind === 'ok'}
								{result.rows.length} Zeile{result.rows.length === 1 ? '' : 'n'} · {result.ms}
								ms
							{:else if result.kind === 'running'}
								läuft…
							{:else if result.kind === 'error'}
								Fehler
							{:else}
								<Kbd>⌘</Kbd> <Kbd>↵</Kbd> zum Ausführen drücken
							{/if}
						</div>
					</div>

					<div class="flex-1 overflow-auto">
						{#if result.kind === 'idle'}
							<div
								class="h-full grid place-items-center text-ink-600 text-[13px] font-mono px-6 text-center"
							>
								Führe eine Abfrage aus, um Ergebnisse zu sehen.
							</div>
						{:else if result.kind === 'running'}
							<div
								class="h-full grid place-items-center text-ink-700 text-[13px]"
							>
								Abfrage wird ausgeführt…
							</div>
						{:else if result.kind === 'error'}
							<div class="p-4 font-mono text-[12px] leading-relaxed">
								<div class="text-err mb-1">FEHLER</div>
								<div class="text-ink-800 whitespace-pre-wrap">{result.error}</div>
								<div class="text-ink-600 mt-3">
									Tipp: für diese Lektion brauchst du nur
									<span class="tok-kw">SELECT</span>,
									<span class="tok-kw">FROM</span>,
									<span class="tok-kw">WHERE</span>,
									<span class="tok-kw">ORDER BY</span> und
									<span class="tok-kw">LIMIT</span>.
								</div>
							</div>
						{:else if result.kind === 'ok'}
							<table class="w-full text-[12.5px] font-mono tabular-num">
								<thead
									class="sticky top-0 bg-ink-50/95 backdrop border-b border-ink-200"
								>
									<tr>
										<th
											class="w-10 text-right pr-2 pl-3 py-2 text-ink-600 font-normal"
											>#</th
										>
										{#each result.columns as c (c)}
											<th class="text-left px-3 py-2 text-ink-700 font-medium">
												{c}
												<span class="ml-2 text-[10px] text-ink-600 font-normal">
													{typeColOf(result.rows, c)}
												</span>
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each result.rows as r, i (i)}
										<tr class="border-b border-ink-100 hover:bg-ink-100/60">
											<td class="text-right pr-2 pl-3 py-1.5 text-ink-600">
												{i + 1}
											</td>
											{#each result.columns as c (c)}
												<td class="px-3 py-1.5 text-ink-900 whitespace-nowrap">
													{#if r[c] === null || r[c] === undefined}
														<span class="text-ink-600 italic">NULL</span>
													{:else}
														{formatCell(r[c])}
													{/if}
												</td>
											{/each}
										</tr>
									{/each}
									{#if result.rows.length === 0}
										<tr>
											<td
												colspan={result.columns.length + 1}
												class="py-8 text-center text-ink-600 italic"
											>
												keine Zeilen — die Abfrage lief, aber nichts passte
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						{/if}
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
