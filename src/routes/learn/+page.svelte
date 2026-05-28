<script lang="ts">
	import { goto } from '$app/navigation';
	import { TRACKS } from '$lib/data';
	import ProgressRing from '$lib/components/ProgressRing.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let query = $state('');

	let filteredTracks = $derived(
		TRACKS.map((track) => ({
			track,
			lessons: track.lessons.filter(
				(l) => !query || l.title.toLowerCase().includes(query.toLowerCase())
			),
			done: track.lessons.filter((l) => l.status === 'done').length,
			total: track.lessons.length
		}))
	);

	function openLesson(trackId: string, lessonId: string) {
		goto(`/learn/${trackId}/${lessonId}`);
	}
</script>

<div class="max-w-[1280px] mx-auto px-6 py-12 md:py-16">
	<div class="flex items-end justify-between gap-6 mb-10">
		<div>
			<div
				class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
			>
				Katalog
			</div>
			<h1
				class="mt-2 text-[36px] md:text-[44px] leading-tight tracking-[-0.02em] font-semibold"
			>
				Lektionen
			</h1>
			<p class="mt-2 text-[15px] text-ink-700 max-w-[60ch]">
				Drei Tracks, vierzehn Lektionen. Jede Lektion ist eine kleine, fokussierte
				Übung — die meisten dauern unter fünfzehn Minuten.
			</p>
		</div>
		<div class="hidden md:flex items-center gap-2">
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-600">
					<Icon name="search" size={13} />
				</span>
				<input
					type="text"
					bind:value={query}
					placeholder="Lektionen durchsuchen…"
					class="h-9 w-64 pl-9 pr-3 rounded-md bg-ink-50 border border-ink-200 text-[13px]
                         placeholder-ink-600 ring-accent focus:border-[oklch(0.72_0.15_195_/_0.4)]"
				/>
			</div>
		</div>
	</div>

	<div class="space-y-12">
		{#each filteredTracks as { track, lessons, done, total } (track.id)}
			<section>
				<div class="flex items-center justify-between mb-5">
					<div class="flex items-center gap-4">
						<ProgressRing
							value={done / total}
							size={28}
							stroke={3}
							class="text-ink-300"
						/>
						<div>
							<h2 class="text-[20px] font-semibold tracking-tight">{track.label}</h2>
							<p class="text-[13px] text-ink-700">{track.blurb}</p>
						</div>
					</div>
					<div class="text-[12px] font-mono text-ink-600 tabular-num">
						{done} / {total} abgeschlossen
					</div>
				</div>

				<div
					class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink-200 border border-ink-200 rounded-lg overflow-hidden"
				>
					{#each lessons as l (l.id)}
						{@const num = track.lessons.indexOf(l) + 1}
						{@const isActive = l.status === 'active'}
						{@const isDone = l.status === 'done'}
						<button
							onclick={() => openLesson(track.id, l.id)}
							class="group text-left bg-ink-50 hover:bg-ink-100/60 px-5 py-5 transition relative"
						>
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-center gap-3">
									<span
										class={'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono ' +
											(isDone
												? 'bg-accent text-[oklch(0.16_0.04_195)]'
												: isActive
													? 'bg-accent-soft text-accent border border-[oklch(0.72_0.15_195_/_0.45)]'
													: 'bg-ink-200 text-ink-700')}
									>
										{#if isDone}
											<Icon name="check" size={11} sw={2.4} />
										{:else}
											{num.toString().padStart(2, '0')}
										{/if}
									</span>
									<div>
										<div class="text-[14.5px] font-semibold text-ink-900">
											{l.title}
										</div>
										<div class="text-[12px] font-mono text-ink-600 mt-0.5">
											{l.minutes} Min · {track.label.toLowerCase()}
										</div>
									</div>
								</div>
								{#if isActive}
									<Badge tone="accent" class="!h-5 !text-[10px]">In Bearbeitung</Badge>
								{/if}
								{#if isDone && !isActive}
									<span class="text-[11px] text-ink-600 font-mono">erledigt</span>
								{/if}
							</div>
							<span
								class="absolute right-4 bottom-4 text-ink-600 opacity-0 group-hover:opacity-100 transition"
							>
								<Icon name="arrow" size={14} />
							</span>
						</button>
					{/each}
				</div>
			</section>
		{/each}
	</div>

	<!-- contributor link -->
	<div class="mt-16 border-t border-ink-200 pt-8 flex items-center justify-between">
		<div class="text-[13px] text-ink-700">
			Du baust auf SbSQLTT auf? Schau in den Quellcode auf
			<a
				href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT"
				target="_blank"
				rel="noreferrer"
				class="text-accent hover:underline underline-offset-4 font-medium">GitHub</a
			>.
		</div>
	</div>
</div>
