<script lang="ts">
	import { page } from '$app/state';

	let { classId }: { classId?: string } = $props();

	let pathname = $derived(page.url.pathname);

	type Item = { label: string; href: string; match: (p: string) => boolean };

	let items = $derived<Item[]>(
		classId
			? [
					{
						label: 'Übersicht',
						href: `/teach/${classId}`,
						match: (p) => p === `/teach/${classId}`
					},
					{
						label: 'Schüler',
						href: `/teach/${classId}/students`,
						match: (p) => p.startsWith(`/teach/${classId}/students`)
					},
					{
						label: 'Aufgaben',
						href: `/teach/${classId}/aufgaben`,
						match: (p) => p.startsWith(`/teach/${classId}/aufgaben`)
					},
					{
						label: 'Einstellungen',
						href: `/teach/${classId}/einstellungen`,
						match: (p) => p.startsWith(`/teach/${classId}/einstellungen`)
					}
				]
			: [
					{ label: 'Übersicht', href: '/teach', match: (p) => p === '/teach' },
					{
						label: 'Einstellungen',
						href: '/teach/settings',
						match: (p) => p.startsWith('/teach/settings')
					}
				]
	);
</script>

<div class="border-b border-ink-200 bg-ink-50/40">
	<div class="max-w-[1280px] mx-auto px-6 flex items-center">
		<div class="flex items-center gap-1">
			{#each items as it (it.href)}
				{@const active = it.match(pathname)}
				<a
					href={it.href}
					class={'relative h-11 px-3.5 inline-flex items-center text-[13.5px] font-medium transition-colors ' +
						(active ? 'text-ink-900' : 'text-ink-700 hover:text-ink-900')}
				>
					{it.label}
					{#if active}
						<span
							class="absolute left-3 right-3 -bottom-px h-[2px] bg-accent rounded-full"
						></span>
					{/if}
				</a>
			{/each}
		</div>
	</div>
</div>
