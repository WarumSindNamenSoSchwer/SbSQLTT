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

	let menuOpen = $state(false);

	function closeMenu() {
		menuOpen = false;
	}

	function navAndClose(href: string) {
		closeMenu();
		setTimeout(() => goto(href), 80);
	}

	function toggleTheme() {
		const next: 'light' | 'dark' =
			document.documentElement.classList.contains('light') ? 'dark' : 'light';
		document.documentElement.classList.toggle('light', next === 'light');
		document.documentElement.classList.toggle('dark', next === 'dark');
		try {
			localStorage.setItem('sbsqltt-theme', next);
		} catch {
			// ignore — toggle still works without persistence
		}
	}

	function currentTheme(): 'dark' | 'light' {
		if (typeof document === 'undefined') return 'dark';
		return document.documentElement.classList.contains('light') ? 'light' : 'dark';
	}

	let theme = $state<'dark' | 'light'>('dark');
	$effect(() => {
		theme = currentTheme();
	});

	$effect(() => {
		if (!menuOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeMenu();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// lock body scroll while the sheet is open
	$effect(() => {
		if (typeof document === 'undefined') return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = menuOpen ? 'hidden' : prev;
		return () => {
			document.body.style.overflow = prev;
		};
	});

	type SheetItem = { id: string; label: string; href?: string; action?: () => void };
	let sheetItems = $derived<SheetItem[]>(
		isTeacher
			? [
					{ id: 'overview', label: 'Übersicht', href: '/teach' },
					{ id: 'settings', label: 'Einstellungen', href: '/teach/settings' }
				]
			: [
					{ id: 'lessons', label: 'Lektionen', href: '/learn' },
					{ id: 'try', label: 'Aktuelle Lektion', href: '/learn/beginner/where-filters' },
					{ id: 'docs', label: 'Docs', href: '/docs' },
					{ id: 'teach', label: 'Lehrer-Ansicht', href: '/teach' },
					{ id: 'fuer', label: 'Für Lehrkräfte', href: '/fuer-lehrkraefte' }
				]
	);
</script>

<header
	class="sticky top-0 z-30 border-b border-ink-200 navbar-bg backdrop"
	style="-webkit-backdrop-filter: blur(8px)"
>
	<div
		class="max-w-[1280px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between"
	>
		<div class="flex items-center gap-8 min-w-0">
			<a href="/" class="flex items-center gap-2 ring-accent rounded shrink-0">
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

		<!-- desktop right-side -->
		<div class="hidden md:flex items-center gap-1.5">
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

		<!-- mobile right-side: optional CTA + hamburger -->
		<div class="flex md:hidden items-center gap-1">
			{#if !isTeacher}
				<Button
					variant="primary"
					size="sm"
					class="tap !h-9 !px-3"
					onclick={() => goto('/learn/beginner/where-filters')}
				>
					Lektion
				</Button>
			{/if}
			<button
				onclick={() => (menuOpen = true)}
				aria-label="Menü"
				class="tap w-10 h-10 grid place-items-center rounded-md text-ink-800 hover:bg-ink-100"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<path d="M4 7h16M4 12h16M4 17h16" />
				</svg>
			</button>
		</div>
	</div>

	{#if menuOpen}
		<div
			class="fixed inset-0 z-50 fade-in md:hidden"
			role="dialog"
			aria-modal="true"
			aria-label="Hauptmenü"
		>
			<button
				aria-label="Menü schließen"
				class="absolute inset-0 bg-black/45 backdrop cursor-default"
				onclick={closeMenu}
			></button>
			<div
				class="absolute inset-x-0 top-0 bg-ink-50 border-b border-ink-200"
				style="animation: msFadeIn 180ms ease-out both"
			>
				<div
					class="px-4 h-14 flex items-center justify-between border-b border-ink-200"
				>
					<Logo />
					<button
						onclick={closeMenu}
						aria-label="Schließen"
						class="tap w-10 h-10 grid place-items-center rounded-md text-ink-700 hover:text-ink-900 hover:bg-ink-100"
					>
						<Icon name="close" size={16} />
					</button>
				</div>

				<nav class="p-2">
					{#each sheetItems as it (it.id)}
						{@const current = it.href === pathname}
						<button
							onclick={() => it.href && navAndClose(it.href)}
							class={'tap w-full flex items-center justify-between px-3 py-3 rounded-md text-left transition-colors ' +
								(current
									? 'bg-accent-soft text-accent'
									: 'text-ink-900 hover:bg-ink-100')}
						>
							<span class="text-[15px] font-medium">{it.label}</span>
							{#if current}
								<Icon name="check" size={14} />
							{:else}
								<Icon name="arrow" size={14} class="text-ink-600" />
							{/if}
						</button>
					{/each}
				</nav>

				<div class="px-2 pb-3 pt-1 border-t border-ink-200 mt-1">
					<button
						onclick={() => {
							toggleTheme();
							theme = currentTheme();
						}}
						class="tap w-full flex items-center justify-between px-3 py-3 rounded-md hover:bg-ink-100"
					>
						<span class="text-[15px] text-ink-900">Erscheinungsbild</span>
						<span
							class="inline-flex items-center gap-1.5 text-[12.5px] font-mono text-ink-700"
						>
							<Icon name={theme === 'dark' ? 'moon' : 'sun'} size={14} />
							{theme === 'dark' ? 'Dunkel' : 'Hell'}
						</span>
					</button>
					{#if isTeacher}
						<button
							onclick={() => navAndClose('/')}
							class="tap w-full flex items-center justify-between px-3 py-3 rounded-md hover:bg-ink-100"
						>
							<span class="text-[15px] text-ink-900">Lehrer-Ansicht verlassen</span>
							<Icon name="arrow" size={14} class="text-ink-600" />
						</button>
					{:else}
						<button
							onclick={() => {
								closeMenu();
								setTimeout(() => onOpenLogin?.(), 80);
							}}
							class="tap w-full flex items-center justify-between px-3 py-3 rounded-md hover:bg-ink-100"
						>
							<span class="text-[15px] text-ink-900">Anmelden</span>
							<Icon name="arrow" size={14} class="text-ink-600" />
						</button>
					{/if}
				</div>

				<div
					class="px-5 pb-5 pt-2 text-[11.5px] font-mono text-ink-600 flex items-center justify-between pb-safe-0"
				>
					<a
						href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT"
						target="_blank"
						rel="noreferrer"
						class="hover:text-ink-900"
					>
						github.com/.../SbSQLTT
					</a>
					<span>AGPL-3.0</span>
				</div>
			</div>
		</div>
	{/if}
</header>
