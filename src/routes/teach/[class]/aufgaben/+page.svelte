<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CLASSES, AUFGABEN_TRACKS, microStat } from '$lib/teacher-data';
	import Surface from '$lib/components/Surface.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import JoinCodeChip from '$lib/components/JoinCodeChip.svelte';

	let classId = $derived(page.params.class);
	let cls = $derived(CLASSES.find((c) => c.id === classId)!);

	let query = $state('');
	let pending = $state(0);
	let savedToast = $state(false);

	// Initial enabled state — beginner on for short classes, beginner+intermediate otherwise.
	let enabled = $state<Record<string, boolean>>(initialEnabled());

	function initialEnabled(): Record<string, boolean> {
		const def: Record<string, boolean> = {};
		const isShort = (cls?.lessons.length ?? 0) <= 5;
		AUFGABEN_TRACKS.forEach((t) =>
			t.lessons.forEach((l) => {
				def[l.id] = isShort ? t.id === 'beginner' : t.id !== 'advanced';
			})
		);
		return def;
	}

	// Re-seed when class changes
	$effect(() => {
		// access classId so this re-runs on navigation
		void classId;
		enabled = initialEnabled();
		pending = 0;
		savedToast = false;
	});

	$effect(() => {
		if (!savedToast) return;
		const t = setTimeout(() => (savedToast = false), 3500);
		return () => clearTimeout(t);
	});

	function toggleLesson(id: string) {
		enabled = { ...enabled, [id]: !enabled[id] };
		pending += 1;
	}

	function enableAll() {
		const next: Record<string, boolean> = {};
		let changed = 0;
		AUFGABEN_TRACKS.forEach((t) =>
			t.lessons.forEach((l) => {
				next[l.id] = true;
				if (!enabled[l.id]) changed++;
			})
		);
		enabled = next;
		pending += changed;
	}

	function save() {
		pending = 0;
		savedToast = true;
	}

	let noStudents = $derived(cls.students.length === 0);

	// Per-track display order (only changed via the mobile up/down buttons —
	// drag-reorder on desktop remains visual-only for now, same as old behavior).
	let order = $state<Record<string, string[]>>(initialOrder());

	function initialOrder(): Record<string, string[]> {
		const o: Record<string, string[]> = {};
		AUFGABEN_TRACKS.forEach((t) => (o[t.id] = t.lessons.map((l) => l.id)));
		return o;
	}

	function move(trackId: string, idx: number, dir: -1 | 1) {
		const list = [...(order[trackId] ?? [])];
		const target = idx + dir;
		if (target < 0 || target >= list.length) return;
		[list[idx], list[target]] = [list[target], list[idx]];
		order = { ...order, [trackId]: list };
		pending += 1;
	}

	let collapsed = $state<Record<string, boolean>>({});
	function toggleCollapse(id: string) {
		collapsed = { ...collapsed, [id]: !collapsed[id] };
	}
</script>

<svelte:head>
	<title>SbSQLTT</title>
</svelte:head>

<div class="max-w-[1280px] mx-auto px-6 py-8 md:py-10 pb-24">
	<div
		class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2"
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
			</div>
			<p class="mt-1.5 text-[13px] text-ink-700">
				<span class="font-mono">{cls.students.length}</span>
				{cls.students.length === 1 ? 'Schüler:in' : 'Schülerinnen und Schüler'} ·
				<span class="font-mono">{cls.activeThisWeek}</span> diese Woche aktiv ·
				{cls.term.split('·')[1].trim()}
			</p>
		</div>
	</div>

	<div
		class="mt-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5"
	>
		<div>
			<div
				class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
			>
				Aufgaben
			</div>
			<h2 class="mt-1.5 text-[20px] font-semibold tracking-tight">
				Welche Lektionen sind für diese Klasse freigeschaltet, in welcher Reihenfolge.
			</h2>
			<p class="mt-1 text-[13px] text-ink-700">
				Änderungen werden für alle Schüler:innen wirksam, sobald Sie sie speichern.
			</p>
		</div>
		<div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
			<div class="relative flex-1 md:flex-none min-w-[140px]">
				<span
					class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-600 pointer-events-none"
				>
					<Icon name="search" size={13} />
				</span>
				<input
					type="text"
					bind:value={query}
					placeholder="Lektion suchen…"
					class="h-9 w-full md:w-56 pl-9 pr-3 rounded-md bg-ink-50 border border-ink-200 text-[13px] placeholder-ink-600 ring-accent focus:border-[oklch(0.72_0.15_195_/_0.5)]"
				/>
			</div>
			<Button variant="ghost" size="md" onclick={enableAll} class="tap"
				>Alle freischalten</Button
			>
			<Button
				variant={pending > 0 ? 'primary' : 'secondary'}
				size="md"
				disabled={pending === 0}
				onclick={pending > 0 ? save : undefined}
				class={'tap ' + (pending === 0 ? '!opacity-50 !cursor-not-allowed' : '')}
			>
				Reihenfolge speichern
				{#if pending > 0}
					<span
						class="ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full font-mono text-[10.5px]"
						style="background: rgba(255,255,255,0.22);"
					>
						{pending} {pending === 1 ? 'Änderung' : 'Änderungen'}
					</span>
				{/if}
			</Button>
		</div>
	</div>

	{#if noStudents}
		<Surface
			class="p-4 mb-6 !bg-accent-soft"
			style="border-color: oklch(0.72 0.15 195 / 0.3);"
		>
			<div class="flex items-start gap-3">
				<span
					class="mt-0.5 shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-accent"
					style="background: oklch(0.72 0.15 195 / 0.18);"
				>
					<Icon name="book" size={14} />
				</span>
				<div>
					<div class="text-[13.5px] font-semibold text-ink-900">
						Diese Klasse hat noch keine Schüler:innen.
					</div>
					<p class="text-[12.5px] text-ink-700 mt-0.5">
						Aufgaben können trotzdem schon vorbereitet werden. Sobald jemand
						beitritt, sieht er nur die hier freigeschalteten Lektionen.
					</p>
				</div>
			</div>
		</Surface>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
		{#each AUFGABEN_TRACKS as t, ti (t.id)}
			{@const ordered = (order[t.id] ?? t.lessons.map((l) => l.id))
				.map((id) => t.lessons.find((ll) => ll.id === id))
				.filter((l): l is (typeof t.lessons)[number] => !!l)}
			{@const filteredLessons = ordered.filter(
				(l) =>
					!query || l.title.toLowerCase().includes(query.toLowerCase())
			)}
			{@const enabledCount = t.lessons.filter((l) => enabled[l.id]).length}
			{@const isCollapsed = !!collapsed[t.id]}
			<Surface class="p-0 flex flex-col">
				<button
					type="button"
					onclick={() => toggleCollapse(t.id)}
					class="tap md:cursor-default px-4 py-3 border-b border-ink-200 flex items-center justify-between bg-ink-50/40 text-left w-full"
				>
					<div class="flex items-center gap-3">
						<span
							class="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-600"
						>
							Track {String(ti + 1).padStart(2, '0')}
						</span>
						<span class="text-[14.5px] font-semibold text-ink-900">{t.label}</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-[11px] font-mono text-ink-600">
							{enabledCount}/{t.lessons.length} an
						</span>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class={'md:hidden text-ink-600 transition-transform ' +
								(isCollapsed ? '' : 'rotate-180')}
						>
							<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</div>
				</button>

				<div class={isCollapsed ? 'hidden md:block' : 'block'}>
					<div
						class="px-4 py-2 border-b border-ink-200 text-[12px] text-ink-700"
					>
						{t.blurb}
					</div>

					<ul class="p-2 flex flex-col gap-1.5">
						{#each filteredLessons as l (l.id)}
							{@const on = !!enabled[l.id]}
							{@const stat = microStat(l.id, cls, on)}
							{@const statTone = stat?.includes('hängt')
								? 'text-warn'
								: stat?.includes('abgeschlossen')
									? 'text-accent'
									: 'text-ink-600'}
							{@const idx = ordered.indexOf(l)}
							{@const canMoveUp = idx > 0}
							{@const canMoveDown = idx < ordered.length - 1}
							<li
								class={'rounded-md border p-3 flex items-center gap-3 transition-colors ' +
									(on
										? 'border-ink-200 bg-ink-50 hover:border-ink-300'
										: 'border-dashed border-ink-200 bg-ink-100/30')}
							>
								<!-- Drag handle on desktop -->
								<span
									class={'shrink-0 hidden md:inline-flex items-center justify-center w-6 h-7 rounded text-ink-600 ' +
										(on
											? 'cursor-grab hover:text-ink-900 hover:bg-ink-100'
											: 'opacity-30 pointer-events-none')}
									title="Reihenfolge ändern"
									aria-label="Reihenfolge ändern"
								>
									<svg
										width="10"
										height="14"
										viewBox="0 0 10 14"
										fill="currentColor"
									>
										<circle cx="2" cy="3" r="1.3" />
										<circle cx="8" cy="3" r="1.3" />
										<circle cx="2" cy="7" r="1.3" />
										<circle cx="8" cy="7" r="1.3" />
										<circle cx="2" cy="11" r="1.3" />
										<circle cx="8" cy="11" r="1.3" />
									</svg>
								</span>
								<!-- Up/down chevrons on mobile -->
								<span
									class={'shrink-0 inline-flex md:hidden flex-col items-stretch border border-ink-200 rounded ' +
										(on ? '' : 'opacity-30 pointer-events-none')}
								>
									<button
										onclick={() => move(t.id, idx, -1)}
										disabled={!canMoveUp}
										class="w-8 h-7 grid place-items-center hover:bg-ink-100 disabled:opacity-30"
										aria-label="Nach oben"
									>
										<svg
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
										>
											<path
												d="M6 15l6-6 6 6"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</button>
									<span class="h-px bg-ink-200"></span>
									<button
										onclick={() => move(t.id, idx, +1)}
										disabled={!canMoveDown}
										class="w-8 h-7 grid place-items-center hover:bg-ink-100 disabled:opacity-30"
										aria-label="Nach unten"
									>
										<svg
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
										>
											<path
												d="M6 9l6 6 6-6"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</button>
								</span>

								<div class="flex-1 min-w-0">
									<div
										class={'text-[13.5px] font-medium truncate ' +
											(on ? 'text-ink-900' : 'text-ink-700')}
									>
										{l.title}
									</div>
									<div
										class="text-[11.5px] font-mono text-ink-600 mt-0.5 flex items-center gap-2"
									>
										<span>{l.minutes} min</span>
										{#if on && stat}
											<span class="text-ink-500">·</span>
											<span class={statTone}>{stat}</span>
										{/if}
									</div>
								</div>

								<button
									onclick={() => toggleLesson(l.id)}
									aria-pressed={on}
									title={on
										? 'Freigeschaltet — antippen zum Sperren'
										: 'Antippen zum Freischalten'}
									class={'tap shrink-0 inline-flex items-center justify-between w-[88px] h-7 pl-2 pr-1 rounded-full text-[11px] font-mono transition-colors ' +
										(on
											? 'bg-accent text-white'
											: 'bg-ink-200 text-ink-700 hover:bg-ink-300')}
								>
									<span>{on ? 'an' : 'aus'}</span>
									<span
										class="inline-block w-5 h-5 rounded-full bg-white"
										style="box-shadow: 0 1px 2px rgba(0,0,0,0.25);"
									></span>
								</button>
							</li>
						{/each}
						{#if filteredLessons.length === 0}
							<li class="px-3 py-6 text-center text-[12.5px] text-ink-600">
								Keine Lektion mit „{query}".
							</li>
						{/if}
					</ul>
				</div>
			</Surface>
		{/each}
	</div>

	<Surface class="mt-10 p-5 !bg-ink-100/40">
		<div class="flex items-start gap-3">
			<span
				class="mt-0.5 shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md bg-ink-200 text-ink-700"
			>
				<Icon name="spark" size={13} />
			</span>
			<div class="flex-1">
				<div class="text-[13.5px] font-semibold text-ink-900">
					Eigene Aufgaben — in Vorbereitung
				</div>
				<p class="text-[12.5px] text-ink-700 mt-0.5 max-w-[60ch]">
					Lehrkraftverfasste Lektionen (eigene Aufgabentexte, eigenes Schema,
					eigene Lösung) folgen in einem späteren Release. Auf der Warteliste werden
					Sie benachrichtigt, sobald die Funktion bereit ist.
				</p>
			</div>
			<Button variant="secondary" size="sm">Auf die Warteliste</Button>
		</div>
	</Surface>
</div>

{#if savedToast}
	<div
		class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 fade-in pointer-events-none"
	>
		<div
			class="flex items-center gap-3 px-4 py-2.5 rounded-full shadow-pop"
			style="background: rgb(var(--ink-900)); color: rgb(var(--ink-0));"
		>
			<span
				class="inline-flex items-center justify-center w-5 h-5 rounded-full"
				style="background: oklch(0.72 0.13 150);"
			>
				<Icon name="check" size={11} sw={3} />
			</span>
			<span class="text-[13px]">Reihenfolge gespeichert</span>
			<span class="text-[11.5px] font-mono opacity-60">· vor 2 Sekunden</span>
		</div>
	</div>
{/if}
