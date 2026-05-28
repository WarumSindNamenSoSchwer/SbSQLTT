<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import LehrerBadge from './LehrerBadge.svelte';
	import { TEACHER, initials } from '$lib/teacher-data';

	let { onOpenLogin }: { onOpenLogin?: () => void } = $props();

	let pathname = $derived(page.url.pathname);
	let isCatalog = $derived(pathname === '/learn' || pathname.startsWith('/learn'));
	let isDocs = $derived(pathname.startsWith('/docs'));
	let isTeacher = $derived(pathname.startsWith('/teach'));
</script>

<header
	class="sticky top-0 z-30 border-b border-ink-200 navbar-bg backdrop"
	style="-webkit-backdrop-filter: blur(8px)"
>
	<div class="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
		<div class="flex items-center gap-8">
			<a href="/" class="flex items-center gap-2 ring-accent rounded">
				<Logo />
				{#if isTeacher}
					<LehrerBadge />
				{/if}
			</a>
			{#if !isTeacher}
				<nav class="hidden md:flex items-center gap-1 text-[13px] text-ink-700">
					<a
						href="/learn"
						class={'px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100 ' +
							(isCatalog ? 'text-ink-900' : '')}
					>
						Lektionen
					</a>
					<a
						href="/docs"
						class={'px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100 ' +
							(isDocs ? 'text-ink-900' : '')}
					>
						Docs
					</a>
					<a
						href="/#teachers"
						class="px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100"
						>Für Lehrkräfte</a
					>
					<a
						href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT/releases"
						target="_blank"
						rel="noreferrer"
						class="px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100"
					>
						Changelog
					</a>
				</nav>
			{/if}
		</div>

		<div class="flex items-center gap-1.5">
			<ThemeToggle />
			{#if isTeacher}
				<span class="w-px h-4 bg-ink-300 mx-1.5"></span>
				<span
					class="hidden sm:inline-flex items-center gap-2 h-7 px-2 text-[12.5px] text-ink-700"
				>
					<span
						class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink-100 text-[10.5px] font-mono text-ink-800"
					>
						{initials(TEACHER.greetingName)}
					</span>
					<span class="font-medium text-ink-900">{TEACHER.greetingName}</span>
					<span class="hidden md:inline text-ink-600 font-mono text-[11.5px]"
						>· {TEACHER.school}</span
					>
				</span>
				<Button variant="ghost" size="sm" onclick={() => goto('/')}>
					Lehrer-Ansicht verlassen
				</Button>
			{:else}
				<a
					href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT"
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center justify-center h-7 w-7 rounded-md text-ink-700 hover:text-ink-900 hover:bg-ink-100 ring-accent"
					aria-label="GitHub"
				>
					<Icon name="github" size={16} />
				</a>
				<span class="w-px h-4 bg-ink-300 mx-1.5"></span>
				<Button variant="ghost" size="sm" onclick={() => onOpenLogin?.()}>Anmelden</Button>
				<Button
					variant="primary"
					size="sm"
					onclick={() => goto('/learn/beginner/where-filters')}
				>
					Lektion ausprobieren
				</Button>
			{/if}
		</div>
	</div>
</header>
