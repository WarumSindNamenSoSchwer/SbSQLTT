<script lang="ts">
	// Gemeinsame Kopfleiste (Design A2 / v11): Logo, Lernen, Datensaetze, Fuer Lehrkraefte.
	import { page } from '$app/state';
	import G from '$lib/edgar/owl-gen.js';

	let { dark = false }: { dark?: boolean } = $props();
	let open = $state(false);
	const path = $derived(page.url.pathname);
	const icon = $derived(
		G.icon(dark ? { body: '#E2E8F0', line: '#E2E8F0' } : {}).replace('<svg ', '<svg width="100%" height="100%" aria-hidden="true" ')
	);
	const links = [
		{ href: '/learn', label: 'Lernen' },
		{ href: '/datasets', label: 'Datensätze' },
		{ href: '/#lehrkraefte', label: 'Für Lehrkräfte' }
	];
	function toggleTheme() {
		const light = document.documentElement.classList.toggle('light');
		document.documentElement.classList.toggle('dark', !light);
		try {
			localStorage.setItem('tabula-theme', light ? 'light' : 'dark');
		} catch {
			/* ignore */
		}
	}
</script>

<header class="nav">
	<a class="brand" href="/"><span class="ic">{@html icon}</span>Tabula</a>
	<nav class="links">
		{#each links as l}
			<a href={l.href} class:on={l.href === '/#lehrkraefte' ? path === '/' : path.startsWith(l.href)}>{l.label}</a>
		{/each}
	</nav>
	<span class="grow"></span>
	<button class="theme" onclick={toggleTheme} aria-label="Hell/Dunkel umschalten">◐</button>
	<span class="lang mono">DE</span>
	<a class="login" href="/login">Anmelden</a>
	<button class="burger" aria-label="Menü" aria-expanded={open} onclick={() => (open = !open)}>☰</button>
	{#if open}
		<div class="mmenu" role="menu">
			{#each links as l}<a role="menuitem" href={l.href} onclick={() => (open = false)}>{l.label}</a>{/each}
			<button role="menuitem" onclick={toggleTheme}>Hell / Dunkel</button>
		</div>
	{/if}
</header>

<style>
	.nav { height: 64px; flex: none; display: flex; align-items: center; gap: 32px; padding: 0 32px; border-bottom: 1px solid var(--line); background: var(--surface); position: relative; z-index: 10; }
	.brand { display: flex; align-items: center; gap: 9px; font-size: 19px; font-weight: 600; letter-spacing: -0.5px; }
	.ic { width: 30px; height: 26px; display: block; }
	.ic :global(svg) { display: block; }
	.links { display: flex; gap: 24px; font-size: 14px; color: var(--ink-2); }
	.links a { padding: 20px 0; }
	.links a:hover { color: var(--ink); }
	.links a.on { color: var(--ink); font-weight: 500; box-shadow: 0 2px 0 var(--accent); }
	.grow { flex: 1; }
	.theme { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--line) !important; border-radius: 6px; color: var(--ink-2) !important; }
	.lang { font-size: 12px; color: var(--ink-2); }
	.login { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line-strong); font-size: 14px; font-weight: 500; }
	.login:hover { background: var(--subtle); }
	.burger { display: none; width: 44px; height: 44px; place-items: center; font-size: 18px; color: var(--ink-2) !important; }
	.mmenu { position: absolute; top: 52px; right: 8px; width: 240px; display: flex; flex-direction: column; padding: 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-pop); font-size: 15px; }
	.mmenu a, .mmenu button { padding: 10px; border-radius: 6px; text-align: left; }
	.mmenu a:hover, .mmenu button:hover { background: var(--subtle) !important; }
	@media (max-width: 767px) {
		.nav { height: 56px; gap: 8px; padding: 0 6px 0 16px; }
		.brand { font-size: 17px; gap: 8px; }
		.ic { width: 26px; height: 22px; }
		.links, .theme, .lang { display: none; }
		.login { padding: 0 12px; }
		.burger { display: grid; }
	}
</style>
