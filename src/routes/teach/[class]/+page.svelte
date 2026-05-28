<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getContext, onMount } from 'svelte';
	import { CLASSES, getStuckStudents, initials } from '$lib/teacher-data';
	import Surface from '$lib/components/Surface.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import JoinCodeChip from '$lib/components/JoinCodeChip.svelte';
	import MatrixCell from '$lib/components/MatrixCell.svelte';
	import ProgressMatrix from '$lib/components/ProgressMatrix.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const openShare = getContext<(kind: 'email' | 'qr') => void>('teach:openShare');

	let classId = $derived(page.params.class);
	let cls = $derived(CLASSES.find((c) => c.id === classId)!);

	let filter = $state<'all' | 'active' | 'stuck' | 'done'>('all');
	let shareMenuOpen = $state(false);

	// view switcher — cards default on mobile, matrix default on desktop
	let view = $state<'cards' | 'matrix'>('matrix');
	onMount(() => {
		if (window.matchMedia('(max-width: 767px)').matches) view = 'cards';
	});

	let stuck = $derived(getStuckStudents(cls));
	let isEmpty = $derived(cls.students.length === 0);

	let filtered = $derived(
		cls.students.filter((stu) => {
			if (filter === 'all') return true;
			const rowStates = cls.lessons.map((l) => cls.progress[stu.id][l.id]);
			if (filter === 'active') return rowStates.some((p) => p.state === 'progress');
			if (filter === 'stuck') return rowStates.some((p) => p.stuck);
			if (filter === 'done') return rowStates.every((p) => p.state === 'done');
			return true;
		})
	);

	let doneCount = $derived(
		cls.students.filter((stu) =>
			cls.lessons.every((l) => cls.progress[stu.id][l.id].state === 'done')
		).length
	);

	function openStudent(studentId: string, lessonId?: string) {
		const url = new URL(page.url);
		url.searchParams.set('student', studentId);
		if (lessonId) url.searchParams.set('lesson', lessonId);
		else url.searchParams.delete('lesson');
		goto(url.pathname + url.search, { replaceState: false, noScroll: true, keepFocus: true });
	}

	const filterItems: Array<{
		id: 'all' | 'active' | 'stuck' | 'done';
		label: string;
		tone?: 'warn';
		count?: number;
	}> = $derived([
		{ id: 'all', label: 'Alle' },
		{ id: 'active', label: 'Aktiv' },
		{ id: 'stuck', label: 'Hängen fest', count: stuck.length, tone: 'warn' },
		{ id: 'done', label: 'Fertig', count: doneCount }
	]);
</script>

<svelte:head>
	<title>{cls.name} · Lehrer · SbSQLTT</title>
</svelte:head>

<div class="max-w-[1280px] mx-auto px-6 py-8 md:py-10">
	<div
		class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6"
	>
		<div>
			<button
				onclick={() => goto('/teach')}
				class="text-[12px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1 mb-2 font-mono"
			>
				← Alle Klassen
			</button>
			<div class="flex items-center gap-3 flex-wrap">
				<h1
					class="text-[26px] md:text-[30px] leading-tight tracking-[-0.02em] font-semibold"
				>
					{cls.name}
				</h1>
				<JoinCodeChip code={cls.joinCode} size="lg" />

				<span class="relative inline-block">
					<button
						onclick={() => (shareMenuOpen = !shareMenuOpen)}
						class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium bg-ink-100 hover:bg-ink-200 border border-ink-200 text-ink-800"
					>
						Teilen
						<svg
							width="10"
							height="10"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.4"
						>
							<path
								d="M6 9l6 6 6-6"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					{#if shareMenuOpen}
						<button
							aria-label="Menü schließen"
							class="fixed inset-0 z-10 bg-transparent cursor-default"
							onclick={() => (shareMenuOpen = false)}
						></button>
						<div
							class="absolute left-0 top-9 z-20 w-48 rounded-md bg-ink-50 border border-ink-200 shadow-pop py-1 fade-in"
						>
							<button
								onclick={() => {
									shareMenuOpen = false;
									openShare('email');
								}}
								class="w-full text-left px-3 py-2 text-[13px] text-ink-800 hover:bg-ink-100 hover:text-ink-900 inline-flex items-center gap-2"
							>
								<Icon name="mail" size={13} /> Per E-Mail teilen
							</button>
							<button
								onclick={() => {
									shareMenuOpen = false;
									openShare('qr');
								}}
								class="w-full text-left px-3 py-2 text-[13px] text-ink-800 hover:bg-ink-100 hover:text-ink-900 inline-flex items-center gap-2"
							>
								<svg
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
								>
									<rect x="3" y="3" width="7" height="7" rx="1" />
									<rect x="14" y="3" width="7" height="7" rx="1" />
									<rect x="3" y="14" width="7" height="7" rx="1" />
									<rect x="14" y="14" width="3" height="3" />
									<rect x="18" y="18" width="3" height="3" />
								</svg>
								QR-Code für die Tafel
							</button>
						</div>
					{/if}
				</span>

				{#if cls.createdDaysAgo < 14}
					<Badge tone="accent" class="!h-6">
						vor {cls.createdDaysAgo} Tagen angelegt
					</Badge>
				{/if}
			</div>
			<p class="mt-1.5 text-[13px] text-ink-700">
				<span class="font-mono">{cls.students.length}</span>
				{cls.students.length === 1 ? 'Schüler:in' : 'Schülerinnen und Schüler'} ·
				<span class="font-mono">{cls.activeThisWeek}</span> diese Woche aktiv ·
				{cls.term.split('·')[1].trim()}
			</p>
		</div>

		{#if !isEmpty}
			<div class="flex items-center gap-2 flex-wrap">
				<div
					class="inline-flex items-center bg-ink-100 border border-ink-200 rounded-md p-0.5"
				>
					{#each filterItems as it (it.id)}
						{@const active = it.id === filter}
						<button
							onclick={() => (filter = it.id)}
							class={'tap h-7 px-3 rounded-[5px] text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors ' +
								(active
									? 'bg-ink-50 text-ink-900 shadow-soft border border-ink-200'
									: 'text-ink-700 hover:text-ink-900')}
						>
							{it.label}
							{#if it.count != null && it.count > 0}
								<span
									class={'inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full font-mono text-[10px] ' +
										(it.tone === 'warn'
											? 'text-warn bg-[oklch(0.62_0.16_70_/_0.18)]'
											: 'bg-ink-200 text-ink-700')}
								>
									{it.count}
								</span>
							{/if}
						</button>
					{/each}
				</div>

				<!-- View switcher: cards (default on mobile) vs. matrix -->
				<div
					class="inline-flex p-0.5 bg-ink-100 border border-ink-200 rounded-md"
				>
					{#each [['cards', 'Karten'], ['matrix', 'Matrix']] as const as [id, label] (id)}
						{@const active = view === id}
						<button
							onclick={() => (view = id)}
							class={'tap h-7 px-2.5 rounded-[5px] text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors ' +
								(active
									? 'bg-ink-50 text-ink-900 shadow-soft border border-ink-200'
									: 'text-ink-700 hover:text-ink-900')}
						>
							{#if id === 'cards'}
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
								>
									<rect x="3" y="4" width="18" height="6" rx="1.5" />
									<rect x="3" y="14" width="18" height="6" rx="1.5" />
								</svg>
							{:else}
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
								>
									<rect x="3" y="3" width="7" height="7" rx="1" />
									<rect x="14" y="3" width="7" height="7" rx="1" />
									<rect x="3" y="14" width="7" height="7" rx="1" />
									<rect x="14" y="14" width="7" height="7" rx="1" />
								</svg>
							{/if}
							<span class="hidden sm:inline">{label}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if isEmpty}
		<Surface class="p-8 md:p-10">
			<div
				class="grid md:grid-cols-[1.1fr_1fr] gap-8 md:gap-12 items-center"
			>
				<div>
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-accent"
					>
						Noch keine Schüler:innen
					</div>
					<h2
						class="mt-3 text-[22px] md:text-[26px] leading-[1.15] tracking-tight font-semibold text-ink-900"
						style="text-wrap: balance"
					>
						Geben Sie den Beitritts-Code an Ihre Klasse weiter.
					</h2>
					<p
						class="mt-3 text-[13.5px] leading-relaxed text-ink-700 max-w-[55ch]"
						style="text-wrap: pretty"
					>
						Sobald jemand mit dem Code beitritt, erscheint die Person hier in der
						Matrix. Sie sehen Fortschritt in Echtzeit, sobald Aufgaben bearbeitet werden.
					</p>
					<div class="mt-5 flex flex-wrap items-center gap-3">
						<Button variant="primary" size="md" onclick={() => openShare('email')}>
							Einladungen senden
						</Button>
						<Button variant="secondary" size="md" onclick={() => openShare('qr')}>
							An der Tafel zeigen
						</Button>
						<Button variant="ghost" size="md">Code zurücksetzen</Button>
					</div>
				</div>

				<Surface class="p-5 !bg-ink-100/40">
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600"
					>
						Beitritts-Code
					</div>
					<div
						class="mt-3 text-[34px] md:text-[40px] leading-none font-mono tracking-tight text-ink-900"
					>
						{cls.joinCode}
					</div>
					<ol
						class="mt-5 space-y-2 text-[13px] text-ink-700 list-decimal list-inside marker:text-ink-600 marker:font-mono"
					>
						<li>sbsqltt.de öffnen</li>
						<li>„Einer Klasse beitreten" antippen</li>
						<li>
							Code <span class="font-mono text-ink-900">{cls.joinCode}</span> eingeben
						</li>
					</ol>
					<div
						class="mt-4 pt-4 border-t border-ink-200 text-[11.5px] text-ink-600 font-mono"
					>
						Kein Schüler-Konto nötig · Code jederzeit erneuerbar
					</div>
				</Surface>
			</div>
		</Surface>
	{:else}
		{#if stuck.length > 0}
			<div class="mb-6">
				<Surface
					class="p-4"
					style="background: oklch(0.62 0.16 70 / 0.06); border-color: oklch(0.62 0.16 70 / 0.35);"
				>
					<div class="flex items-start gap-4">
						<div
							class="shrink-0 w-9 h-9 rounded-md grid place-items-center"
							style="background: oklch(0.62 0.16 70 / 0.15);"
						>
							<span
								style="width: 9px; height: 9px; border-radius: 999px; background: oklch(0.62 0.16 70); display: inline-block;"
							></span>
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between gap-3">
								<div>
									<div class="text-[13.5px] font-semibold text-ink-900">
										Hängen jetzt fest
									</div>
									<div class="text-[12px] text-ink-700">
										{stuck.length}
										{stuck.length === 1 ? 'Person braucht' : 'Personen brauchen'}
										kurz Aufmerksamkeit.
									</div>
								</div>
								<div class="text-[11px] font-mono text-ink-600">
									aktualisiert vor 30 Sek.
								</div>
							</div>

							<ul
								class="mt-3 divide-y"
								style="--tw-divide-opacity: 1; border-color: oklch(0.62 0.16 70 / 0.18);"
							>
								{#each stuck as s, i (i)}
									<li class="py-2 flex items-center justify-between gap-4">
										<div
											class="min-w-0 flex-1 flex items-center gap-3"
										>
											<span
												class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-ink-100 text-[11px] font-mono text-ink-800 shrink-0"
											>
												{initials(s.student.name)}
											</span>
											<div class="min-w-0">
												<div
													class="text-[13.5px] text-ink-900 font-medium truncate"
												>
													{s.student.name}
												</div>
												<div
													class="text-[12px] text-ink-700 font-mono truncate"
												>
													{s.lesson.code} · {s.lesson.short} · Schritt {s.progress.currentStep}/{s
														.progress.totalSteps}
													<span class="mx-1.5 text-ink-500">·</span>
													seit {s.minutesStuck} min · {s.progress.attempts} Versuche
												</div>
											</div>
										</div>
										<Button
											variant="primary"
											size="sm"
											onclick={() => openStudent(s.student.id, s.lesson.id)}
										>
											Ansehen →
										</Button>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				</Surface>
			</div>
		{/if}

		{#if view === 'matrix'}
			<Surface class="overflow-hidden">
				<div
					class="flex items-center justify-between gap-3 px-4 py-3 border-b border-ink-200 bg-ink-50/40 flex-wrap"
				>
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600"
					>
						Fortschritts-Matrix · {cls.students.length} × {cls.lessons.length}
					</div>
					<div
						class="flex items-center gap-3 md:gap-5 text-[11.5px] text-ink-700 flex-wrap"
					>
						<span class="inline-flex items-center gap-1.5">
							<MatrixCell state="todo" size={14} /> Nicht begonnen
						</span>
						<span class="inline-flex items-center gap-1.5">
							<MatrixCell state="progress" percent={0.4} size={14} /> Begonnen
						</span>
						<span class="inline-flex items-center gap-1.5">
							<MatrixCell state="done" size={14} /> Abgeschlossen
						</span>
						<span class="inline-flex items-center gap-1.5">
							<MatrixCell state="progress" percent={0.6} stuck size={14} /> Hängt fest
						</span>
					</div>
				</div>
				<ProgressMatrix
					{cls}
					students={filtered}
					lessons={cls.lessons}
					onOpenStudent={(sid) => openStudent(sid)}
				/>
			</Surface>
		{:else}
			<Surface class="overflow-hidden">
				<div
					class="flex items-center justify-between px-4 py-3 border-b border-ink-200 bg-ink-50/40"
				>
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600"
					>
						Karten · {filtered.length} Schüler:innen
					</div>
				</div>
				<ul class="divide-y divide-ink-200">
					{#each filtered as stu (stu.id)}
						{@const cells = cls.lessons.map((l) => cls.progress[stu.id][l.id])}
						{@const done = cells.filter((p) => p.state === 'done').length}
						{@const stuckRow = cells.some((p) => p.stuck)}
						{@const activeIdx = cells.findIndex((p) => p.state === 'progress')}
						{@const activeLesson = activeIdx >= 0 ? cls.lessons[activeIdx] : null}
						<li class="px-4 py-4 hover:bg-ink-100/40 transition-colors">
							<button
								onclick={() => openStudent(stu.id, activeLesson?.id)}
								class="tap w-full text-left flex items-start gap-3"
							>
								<span
									class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink-100 text-[12px] font-mono text-ink-800 shrink-0"
								>
									{initials(stu.name)}
								</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between gap-2">
										<span
											class="text-[14.5px] font-semibold text-ink-900 truncate"
										>
											{stu.name}
										</span>
										{#if stuckRow}
											<span
												class="inline-flex items-center gap-1 text-[10.5px] font-mono px-1.5 h-5 rounded-full"
												style="color: oklch(0.45 0.14 70); background: oklch(0.62 0.16 70 / 0.18);"
											>
												<span
													style="width: 6px; height: 6px; border-radius: 999px; background: oklch(0.62 0.16 70); display: inline-block;"
												></span>
												hängt fest
											</span>
										{/if}
									</div>
									<div class="mt-0.5 text-[12px] font-mono text-ink-700">
										{#if activeLesson}
											aktiv in {activeLesson.code} · {activeLesson.short}
										{:else if done === cls.lessons.length}
											alle Lektionen abgeschlossen
										{:else}
											wartet auf Start
										{/if}
									</div>
									<div class="mt-2 flex items-center gap-2">
										<div
											class="flex-1 h-1.5 rounded-full bg-ink-200 overflow-hidden"
										>
											<div
												class="h-full bg-accent"
												style={`width: ${(done / cls.lessons.length) * 100}%`}
											></div>
										</div>
										<span
											class="text-[11px] font-mono text-ink-700 tabular-num shrink-0"
										>
											{done}/{cls.lessons.length}
										</span>
									</div>
									<div class="mt-2.5 flex flex-wrap items-center gap-1">
										{#each cls.lessons as l, i (l.id)}
											<span
												title={`${l.code} · ${l.short}`}
												class="inline-flex items-center justify-center"
											>
												<MatrixCell
													state={cells[i].state}
													percent={cells[i].percent}
													stuck={cells[i].stuck}
													size={14}
												/>
											</span>
										{/each}
									</div>
								</div>
							</button>
						</li>
					{/each}
				</ul>
			</Surface>
		{/if}

		<p class="mt-3 text-[11.5px] text-ink-600 font-mono">
			Sie sehen nur Lernfortschritt im Schulkontext. Persönliche Konto-Daten der Schüler:innen werden nicht angezeigt.
		</p>
	{/if}
</div>
