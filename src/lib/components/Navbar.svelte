<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let { onOpenLogin }: { onOpenLogin?: () => void } = $props();

	let pathname = $derived(page.url.pathname);
	let isCatalog = $derived(pathname === '/learn' || pathname.startsWith('/learn'));
</script>

<header
	class="sticky top-0 z-30 border-b border-ink-200 navbar-bg backdrop"
	style="-webkit-backdrop-filter: blur(8px)"
>
	<div class="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
		<div class="flex items-center gap-8">
			<a href="/" class="flex items-center gap-2 ring-accent rounded">
				<Logo />
			</a>
			<nav class="hidden md:flex items-center gap-1 text-[13px] text-ink-700">
				<a
					href="/learn"
					class={'px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100 ' +
						(isCatalog ? 'text-ink-900' : '')}
				>
					Lessons
				</a>
				<a
					href="#"
					class="px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100"
					>Docs</a
				>
				<a
					href="#"
					class="px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100"
					>Teachers</a
				>
				<a
					href="#"
					class="px-2.5 h-8 rounded-md flex items-center hover:text-ink-900 hover:bg-ink-100"
					>Changelog</a
				>
			</nav>
		</div>

		<div class="flex items-center gap-1.5">
			<ThemeToggle />
			<a
				href="https://github.com"
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center justify-center h-7 w-7 rounded-md text-ink-700 hover:text-ink-900 hover:bg-ink-100 ring-accent"
				aria-label="GitHub"
			>
				<Icon name="github" size={16} />
			</a>
			<span class="w-px h-4 bg-ink-300 mx-1.5"></span>
			<Button variant="ghost" size="sm" onclick={() => onOpenLogin?.()}>Sign in</Button>
			<Button
				variant="primary"
				size="sm"
				onclick={() => goto('/learn/beginner/where-filters')}
			>
				Try a lesson
			</Button>
		</div>
	</div>
</header>
