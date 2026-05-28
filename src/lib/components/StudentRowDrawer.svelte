<script lang="ts">
	import type { TeacherClass } from '$lib/teacher-data';
	import { initials } from '$lib/teacher-data';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Surface from './Surface.svelte';
	import MatrixCell from './MatrixCell.svelte';

	let {
		open,
		cls,
		studentId,
		focusLessonId,
		onClose
	}: {
		open: boolean;
		cls: TeacherClass;
		studentId: string | null;
		focusLessonId?: string | null;
		onClose: () => void;
	} = $props();

	let stu = $derived(cls.students.find((s) => s.id === studentId) || cls.students[0]);

	let counts = $derived.by(() => {
		let done = 0;
		let prog = 0;
		let todo = 0;
		cls.lessons.forEach((l) => {
			const s = cls.progress[stu?.id]?.[l.id]?.state;
			if (s === 'done') done++;
			else if (s === 'progress') prog++;
			else todo++;
		});
		return { done, prog, todo };
	});

	let joined = $derived.by(() => {
		const d = new Date();
		if (stu) d.setDate(d.getDate() - stu.joinedDaysAgo);
		return d;
	});

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if open && stu}
	<div
		class="drawer-shell fade-in"
		role="dialog"
		aria-modal="true"
	>
		<button
			aria-label="Schließen"
			class="absolute inset-0 bg-black/40 backdrop cursor-default"
			onclick={onClose}
		></button>
		<div class="drawer-card relative w-full">
			<span class="ms-handle"></span>
			<div
				class="sticky top-0 z-10 bg-ink-50/95 backdrop border-b border-ink-200 px-6 py-4 flex items-start justify-between gap-4"
			>
				<div class="flex items-center gap-3">
					<span
						class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink-100 text-[13px] font-mono text-ink-800"
					>
						{initials(stu.name)}
					</span>
					<div>
						<div class="text-[18px] font-semibold tracking-tight text-ink-900">
							{stu.name}
						</div>
						<div class="text-[12px] text-ink-700 font-mono">
							{cls.name} · beigetreten {joined.toLocaleDateString('de-DE', {
								day: '2-digit',
								month: 'short',
								year: 'numeric'
							})}
						</div>
					</div>
				</div>
				<button
					onclick={onClose}
					class="tap w-10 h-10 md:w-8 md:h-8 grid place-items-center rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100"
					aria-label="Schließen"
				>
					<Icon name="close" size={16} />
				</button>
			</div>

			<div class="px-6 py-8 space-y-10">
				<div class="grid grid-cols-3 gap-3">
					{#each [['Abgeschlossen', counts.done, 'accent'], ['In Arbeit', counts.prog, ''], ['Offen', counts.todo, '']] as [label, value, tone] (label)}
						<div class="bg-ink-50 border border-ink-200 rounded-lg px-4 py-4">
							<div
								class="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-600"
							>
								{label}
							</div>
							<div
								class={'mt-2 text-[24px] font-semibold font-mono tabular-num leading-none ' +
									(tone === 'accent' ? 'text-accent' : 'text-ink-900')}
							>
								{value}
							</div>
						</div>
					{/each}
				</div>

				<div>
					<h3
						class="text-[13px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-5"
					>
						Lektionen
					</h3>
					<ol
						class="relative space-y-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-ink-200"
					>
						{#each cls.lessons as les (les.id)}
							{@const p = cls.progress[stu.id][les.id]}
							{@const focused = focusLessonId === les.id}
							<li
								class={'relative pl-7 ' +
									(focused
										? '-mx-3 px-3 rounded-md bg-accent-soft border border-[oklch(0.72_0.15_195_/_0.3)]'
										: '')}
							>
								<span class="absolute left-0 top-2.5">
									<MatrixCell
										state={p.state}
										percent={p.percent}
										stuck={p.stuck}
										size={16}
									/>
								</span>
								<div class="flex items-baseline justify-between gap-3">
									<div>
										<div
											class="text-[13.5px] font-semibold text-ink-900"
										>
											{les.code} · {les.title}
										</div>
										<div class="text-[12px] text-ink-700 font-mono">
											Schritt {p.currentStep}/{p.totalSteps}
											{p.minutes ? ` · ${p.minutes} min` : ''}
											{p.attempts ? ` · ${p.attempts} Versuche` : ''}
											{#if p.stuck}
												<span class="text-warn"> · hängt fest</span>
											{/if}
										</div>
									</div>
									{#if p.state !== 'todo'}
										<!-- TODO: read-only lesson viewer not yet built -->
										<a
											href={`/learn/beginner/where-filters`}
											class="text-[12px] text-ink-700 hover:text-ink-900 font-mono"
										>
											Lektion live anschauen →
										</a>
									{/if}
								</div>
								{#if focused && p.state !== 'todo'}
									<div class="mt-3 rounded-md bg-ink-100/60 border border-ink-200 p-3">
										<div
											class="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-600 mb-1.5"
										>
											Letzte Abfrage
										</div>
										<pre class="font-mono text-[12px] leading-[19px] whitespace-pre overflow-x-auto"><span class="tok-com">-- Versuch {p.attempts}
</span><span class="tok-kw">SELECT</span><span class="tok-pun"> title, year </span>
<span class="tok-kw">FROM</span><span class="tok-pun">   </span><span class="tok-id">books</span>
<span class="tok-kw">WHERE</span><span class="tok-pun">  </span><span class="tok-id">year</span><span class="tok-pun"> &gt; </span><span class="tok-num">2010</span><span class="tok-pun">;</span></pre>
									</div>
								{/if}
							</li>
						{/each}
					</ol>
				</div>

				<Surface class="p-5 !bg-ink-100/40">
					<div class="flex items-start gap-3">
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							class="text-ink-700 mt-0.5 shrink-0"
						>
							<path d="M12 2 4 6v6c0 5 4 9 8 10 4-1 8-5 8-10V6l-8-4z" />
						</svg>
						<p class="text-[12.5px] leading-relaxed text-ink-700">
							Sie sehen nur die Schritte, die im Schulkontext relevant sind.
							Persönliche Notizen oder Konto-Daten der Schülerin werden nicht
							angezeigt.
						</p>
					</div>
				</Surface>

				<div
					class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-ink-200"
				>
					<Button variant="secondary" size="md" class="tap w-full sm:w-auto"
						>Daten exportieren (CSV)</Button
					>
					<button
						class="tap text-[13px] text-err hover:underline underline-offset-4 py-2 sm:py-0 text-left sm:text-right"
					>
						Schüler:in aus Klasse entfernen
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
