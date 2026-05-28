<script lang="ts">
	import type { TeacherClass, Student, LessonRef } from '$lib/teacher-data';
	import { initials } from '$lib/teacher-data';
	import MatrixCell from './MatrixCell.svelte';

	let {
		cls,
		students,
		lessons,
		onOpenStudent
	}: {
		cls: TeacherClass;
		students: Student[];
		lessons: LessonRef[];
		onOpenStudent: (studentId: string) => void;
	} = $props();

	let hoverCell = $state<{ r: number; c: number } | null>(null);
</script>

<div class="relative overflow-auto" style="max-height: calc(100vh - 320px)">
	<table class="border-separate border-spacing-0">
		<thead>
			<tr>
				<th
					class="sticky left-0 top-0 z-30 bg-ink-50 border-b border-r border-ink-200 px-4 py-3 text-left"
				>
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600"
					>
						Schüler:in
					</div>
				</th>
				{#each lessons as l (l.id)}
					<th
						class="sticky top-0 z-20 bg-ink-50 border-b border-ink-200 px-2 py-3 text-left"
						style="min-width: 88px"
					>
						<div class="flex flex-col gap-0.5">
							<span
								class="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-600"
								>{l.code}</span
							>
							<span class="text-[12px] font-medium text-ink-900 truncate"
								>{l.short}</span
							>
						</div>
					</th>
				{/each}
				<th
					class="sticky top-0 z-20 bg-ink-50 border-b border-l border-ink-200 px-3 py-3 text-right w-[110px]"
				>
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600"
					>
						Fortschritt
					</div>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each students as stu, ri (stu.id)}
				{@const rowStates = lessons.map((l) => cls.progress[stu.id][l.id])}
				{@const doneCount = rowStates.filter((p) => p.state === 'done').length}
				{@const totalCount = rowStates.length}
				{@const isStuckRow = rowStates.some((p) => p.stuck)}
				<tr class="group hover:bg-ink-100/40">
					<td
						class="sticky left-0 z-10 bg-ink-50 group-hover:bg-ink-100/40 border-b border-r border-ink-200 px-4 py-2"
					>
						<button
							onclick={() => onOpenStudent(stu.id)}
							class="flex items-center gap-3 text-left w-full"
						>
							<span
								class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-ink-100 text-[11px] font-mono text-ink-800 shrink-0"
							>
								{initials(stu.name)}
							</span>
							<div class="min-w-0">
								<div
									class="text-[13.5px] text-ink-900 font-medium truncate flex items-center gap-1.5"
								>
									{stu.name}
									{#if isStuckRow}
										<span
											style="width: 6px; height: 6px; border-radius: 999px; background: oklch(0.62 0.16 70);"
										></span>
									{/if}
								</div>
								<div class="text-[11.5px] font-mono text-ink-600">
									Beigetreten vor {stu.joinedDaysAgo} Tagen
								</div>
							</div>
						</button>
					</td>
					{#each lessons as l, ci (l.id)}
						{@const p = cls.progress[stu.id][l.id]}
						{@const tip = `${stu.name} · ${l.short} · Schritt ${p.currentStep}/${p.totalSteps}` +
							(p.minutes ? ` · ${p.minutes} min` : '') +
							(p.attempts ? ` · ${p.attempts} Versuche` : '')}
						<td
							class="border-b border-ink-200 px-2 py-2 text-center relative"
							onmouseenter={() => (hoverCell = { r: ri, c: ci })}
							onmouseleave={() => (hoverCell = null)}
						>
							<MatrixCell
								state={p.state}
								percent={p.percent}
								stuck={p.stuck}
								size={20}
								title={tip}
							/>
							{#if hoverCell && hoverCell.r === ri && hoverCell.c === ci}
								<div
									class="absolute z-40 left-1/2 -translate-x-1/2 top-full mt-1 w-60 rounded-md text-[11.5px] shadow-pop p-3 pointer-events-none fade-in"
									style="background: rgb(var(--ink-900)); color: rgb(var(--ink-0));"
								>
									<div class="font-semibold text-[12.5px]">{stu.name}</div>
									<div class="font-mono opacity-80 mt-0.5">
										{l.code} · {l.title}
									</div>
									<div class="mt-2 grid grid-cols-2 gap-y-1 font-mono opacity-90">
										<div class="opacity-70">Schritt</div>
										<div class="text-right">
											{p.currentStep}/{p.totalSteps}
										</div>
										<div class="opacity-70">Zeit</div>
										<div class="text-right">{p.minutes} min</div>
										<div class="opacity-70">Versuche</div>
										<div class="text-right">{p.attempts}</div>
										<div class="opacity-70">Status</div>
										<div class="text-right">
											{#if p.state === 'done'}abgeschlossen{/if}
											{#if p.state === 'progress'}{p.stuck
													? 'hängt fest'
													: 'in Arbeit'}{/if}
											{#if p.state === 'todo'}nicht begonnen{/if}
										</div>
									</div>
								</div>
							{/if}
						</td>
					{/each}
					<td class="border-b border-l border-ink-200 px-3 py-2 text-right">
						<div class="inline-flex items-center gap-2">
							<div class="w-14 h-1.5 rounded-full bg-ink-200 overflow-hidden">
								<div
									class="h-full bg-accent"
									style="width: {(doneCount / totalCount) * 100}%"
								></div>
							</div>
							<span
								class="text-[11px] font-mono text-ink-700 tabular-num w-10 text-right"
							>
								{doneCount}/{totalCount}
							</span>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
