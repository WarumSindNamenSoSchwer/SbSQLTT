<script lang="ts">
	import { goto } from '$app/navigation';
	import type { TeacherClass } from '$lib/teacher-data';
	import Surface from './Surface.svelte';
	import JoinCodeChip from './JoinCodeChip.svelte';
	import Sparkline from './Sparkline.svelte';

	let { cls }: { cls: TeacherClass } = $props();

	let menuOpen = $state(false);

	let totalLessons = $derived(cls.lessons.length);
	let totalCells = $derived(cls.students.length * totalLessons);
	let doneCells = $derived.by(() => {
		let n = 0;
		cls.students.forEach((s) =>
			cls.lessons.forEach((l) => {
				if (cls.progress[s.id]?.[l.id]?.state === 'done') n++;
			})
		);
		return n;
	});
	let pct = $derived(doneCells / Math.max(1, totalCells));

	function open() {
		goto(`/teach/${cls.id}`);
	}

	function handleMenu(action: string) {
		menuOpen = false;
		// menu actions are placeholders (rename, reset-code, export, archive)
		void action;
	}
</script>

<div
	onclick={open}
	onkeydown={(e) => {
		if (e.key === 'Enter') open();
	}}
	role="button"
	tabindex="0"
	class="ring-accent rounded-lg block"
>
	<Surface
		class="p-5 hover:border-ink-300 transition-colors cursor-pointer group relative"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<div class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600">
					{cls.term}
				</div>
				<h3
					class="mt-1 text-[16.5px] font-semibold tracking-tight text-ink-900 truncate"
					style="text-wrap: balance"
				>
					{cls.name}
				</h3>
			</div>
			<div
				class="relative"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="presentation"
			>
				<button
					onclick={() => (menuOpen = !menuOpen)}
					class="w-7 h-7 grid place-items-center rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100"
					aria-label="Mehr"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
						<circle cx="5" cy="12" r="1.8" />
						<circle cx="12" cy="12" r="1.8" />
						<circle cx="19" cy="12" r="1.8" />
					</svg>
				</button>
				{#if menuOpen}
					<button
						aria-label="Menü schließen"
						class="fixed inset-0 z-10 cursor-default bg-transparent"
						onclick={() => (menuOpen = false)}
					></button>
					<div
						class="absolute right-0 top-8 z-20 w-52 rounded-md bg-ink-50 border border-ink-200 shadow-pop py-1 fade-in"
					>
						{#each [['Klasse umbenennen', 'rename'], ['Code zurücksetzen', 'reset-code'], ['Daten exportieren', 'export'], ['Archivieren', 'archive']] as [label, a] (a)}
							<button
								onclick={() => handleMenu(a)}
								class="w-full text-left px-3 py-1.5 text-[13px] text-ink-800 hover:bg-ink-100 hover:text-ink-900"
							>
								{label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div
			class="mt-3 flex items-center gap-2"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="presentation"
		>
			<JoinCodeChip code={cls.joinCode} size="sm" />
		</div>

		<div class="mt-5 grid grid-cols-[1fr_auto] gap-3 items-end">
			<div>
				<div
					class="text-[24px] leading-none font-semibold text-ink-900 font-mono tabular-num"
				>
					{cls.activeThisWeek}<span class="text-ink-600 text-[16px]">
						/ {cls.students.length}</span
					>
				</div>
				<div class="mt-1.5 text-[12px] text-ink-700">Diese Woche aktiv</div>
			</div>
			<div class="flex flex-col items-end gap-1">
				<Sparkline data={cls.sparkline} width={86} height={22} />
				<div class="text-[10.5px] font-mono text-ink-600">14 Tage</div>
			</div>
		</div>

		<div
			class="mt-4 pt-4 border-t border-ink-200 flex items-center justify-between text-[12px] text-ink-700"
		>
			<span>{Math.round(pct * 100)} % der Lektionen abgeschlossen</span>
			<span
				class="inline-flex items-center gap-1 text-ink-900 font-medium group-hover:text-accent"
			>
				Öffnen →
			</span>
		</div>
	</Surface>
</div>
