<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CLASSES, initials } from '$lib/teacher-data';
	import Surface from '$lib/components/Surface.svelte';
	import JoinCodeChip from '$lib/components/JoinCodeChip.svelte';

	let classId = $derived(page.params.class);
	let cls = $derived(CLASSES.find((c) => c.id === classId)!);

	function rowProgress(studentId: string) {
		const rs = cls.lessons.map((l) => cls.progress[studentId][l.id]);
		return {
			done: rs.filter((p) => p.state === 'done').length,
			prog: rs.filter((p) => p.state === 'progress').length,
			stuck: rs.some((p) => p.stuck),
			total: rs.length
		};
	}

	function openStudent(sid: string) {
		const url = new URL(page.url);
		url.pathname = `/teach/${classId}`;
		url.searchParams.set('student', sid);
		goto(url.pathname + url.search);
	}
</script>

<svelte:head>
	<title>Schüler:innen · {cls.name} · SbSQLTT</title>
</svelte:head>

<div class="max-w-[1280px] mx-auto px-6 py-8 md:py-10">
	<div class="mb-6">
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
			{cls.students.length === 1 ? 'Schüler:in' : 'Schülerinnen und Schüler'}
		</p>
	</div>

	<div
		class="mt-2 mb-5 text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
	>
		Schüler:innen
	</div>

	{#if cls.students.length === 0}
		<Surface class="p-8 text-center text-ink-700">
			Noch keine Schüler:innen in dieser Klasse. Teilen Sie den Code <span
				class="font-mono text-ink-900">{cls.joinCode}</span
			>, damit Schüler:innen beitreten können.
		</Surface>
	{:else}
		<Surface class="overflow-hidden">
			<ul class="divide-y divide-ink-200">
				{#each cls.students as stu (stu.id)}
					{@const r = rowProgress(stu.id)}
					<li>
						<button
							onclick={() => openStudent(stu.id)}
							class="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-ink-100/40"
						>
							<span
								class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink-100 text-[12px] font-mono text-ink-800 shrink-0"
							>
								{initials(stu.name)}
							</span>
							<div class="flex-1 min-w-0">
								<div
									class="text-[14px] font-medium text-ink-900 truncate flex items-center gap-2"
								>
									{stu.name}
									{#if r.stuck}
										<span
											style="width: 7px; height: 7px; border-radius: 999px; background: oklch(0.62 0.16 70);"
										></span>
									{/if}
								</div>
								<div class="text-[12px] text-ink-600 font-mono mt-0.5">
									Beigetreten vor {stu.joinedDaysAgo} Tagen
								</div>
							</div>
							<div class="flex items-center gap-3 shrink-0">
								<div class="w-24 h-1.5 rounded-full bg-ink-200 overflow-hidden">
									<div
										class="h-full bg-accent"
										style="width: {(r.done / Math.max(1, r.total)) * 100}%"
									></div>
								</div>
								<span
									class="text-[12px] font-mono text-ink-700 tabular-num w-14 text-right"
								>
									{r.done}/{r.total}
								</span>
							</div>
						</button>
					</li>
				{/each}
			</ul>
		</Surface>
	{/if}
</div>
