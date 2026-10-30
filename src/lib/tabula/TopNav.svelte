<script lang="ts">
	// Gemeinsame Kopfleiste (Design A2 / v11): Logo, Lernen, Datensaetze, Fuer Lehrkraefte.
	// Wenn angemeldet: Avatar-Menue statt „Anmelden".
	import { page } from '$app/state';
	import G from '$lib/edgar/owl-gen.js';
	import { session, sessionLogout } from '$lib/tabula/session.svelte.js';
	import { goto } from '$app/navigation';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';

	let { dark = false }: { dark?: boolean } = $props();
	let open = $state(false);
	let avatarOpen = $state(false);
	let logoutBusy = $state(false);
	const path = $derived(page.url.pathname);
	const icon = $derived(
		G.icon(dark ? { body: '#E2E8F0', line: '#E2E8F0' } : {}).replace('<svg ', '<svg width="100%" height="100%" aria-hidden="true" ')
	);
	const links = [
		{ href: '/learn', label: 'Lernen' },
		{ href: '/datasets', label: 'Datensätze' },
		{ href: '/#lehrkraefte', label: 'Für Lehrkräfte' }
	];

	// Avatar-Initialen aus dem Anzeigenamen (Schüler: Name nur im Tab gespeichert)
	const initials = $derived(() => {
		const n = session.displayName.trim();
		if (!n) return '';
		const parts = n.split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		return parts[0].slice(0, 2).toUpperCase();
	});

	function toggleTheme() {
		const light = document.documentElement.classList.toggle('light');
		document.documentElement.classList.toggle('dark', !light);
		try {
			localStorage.setItem('tabula-theme', light ? 'light' : 'dark');
		} catch {
			/* ignore */
		}
	}

	async function handleLogout() {
		if (logoutBusy) return;
		logoutBusy = true;
		avatarOpen = false;
		try {
			await sessionLogout();
			goto('/login');
		} catch {
			// ignore
		} finally {
			logoutBusy = false;
		}
	}

	function closeAvatar(e: MouseEvent) {
		if (avatarOpen && !(e.target as Element).closest('.avatar-wrap')) {
			avatarOpen = false;
		}
	}
</script>

<svelte:window onclick={closeAvatar} />

<header class="nav">
	<a class="brand" href="/"><span class="ic">{@html icon}</span>Tabula</a>
	<nav class="links">
		{#each links as l}
			<a href={l.href} aria-current={(l.href === '/#lehrkraefte' ? path === '/' : path.startsWith(l.href)) ? 'page' : undefined} class:on={l.href === '/#lehrkraefte' ? path === '/' : path.startsWith(l.href)}>{l.label}</a>
		{/each}
	</nav>
	<span class="grow"></span>
	<button class="theme" onclick={toggleTheme} aria-label="Hell/Dunkel umschalten"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5"></circle><path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5Z" fill="currentColor"></path></svg></button>

	{#if ACCOUNTS_LIVE && session.user}
		<!-- Avatar-Menue (Design A2-04) -->
		<div class="avatar-wrap">
			<button
				class="avatar-btn"
				aria-expanded={avatarOpen}
				onclick={() => (avatarOpen = !avatarOpen)}
			>
				<span class="avatar">{initials()}</span>
				<span class="avatar-name">{session.displayName.split(' ')[0]} <span aria-hidden="true">▾</span></span><span class="sr-only">Kontomenü</span>
			</button>
			{#if avatarOpen}
				<div class="amenu" role="menu">
					<div class="amenu-head">
						<span class="amenu-display">{session.displayName}</span>
						<span class="amenu-username mono">{session.teacher ? session.teacher.email : (session.student?.class?.name ?? '')}</span>
					</div>
					<a role="menuitem" href="/profil" onclick={() => (avatarOpen = false)} class="amenu-item">Profil</a>
					{#if session.teacher}
						<a role="menuitem" href="/teach" onclick={() => (avatarOpen = false)} class="amenu-item">Meine Klassen</a>
					{/if}
					<button role="menuitem" class="amenu-item amenu-logout" onclick={handleLogout} disabled={logoutBusy}>
						{logoutBusy ? 'Wird abgemeldet …' : 'Abmelden'}
					</button>
				</div>
			{/if}
		</div>
	{:else}
		<a class="login" href="/login">Anmelden</a>
	{/if}

	<button class="burger" aria-label="Menü" aria-expanded={open} onclick={() => (open = !open)}>☰</button>
	{#if open}
		<div class="mmenu" role="menu">
			{#each links as l}<a role="menuitem" href={l.href} onclick={() => (open = false)}>{l.label}</a>{/each}
			<button role="menuitem" onclick={toggleTheme}>Hell / Dunkel</button>
			{#if ACCOUNTS_LIVE && session.user}
				<a role="menuitem" href="/profil" onclick={() => (open = false)}>Profil</a>
				<button role="menuitem" onclick={handleLogout}>Abmelden</button>
			{:else}
				<a role="menuitem" href="/login" onclick={() => (open = false)}>Anmelden</a>
			{/if}
		</div>
	{/if}
</header>

<style>
	.nav { height: 60px; flex: none; display: flex; align-items: center; gap: 28px; padding: 0 clamp(16px, 3vw, 48px); border-bottom: 1px solid var(--line); background: var(--surface); position: relative; z-index: 10; }
	.brand { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
	.ic { width: 28px; height: 25px; display: block; }
	.ic :global(svg) { display: block; }
	.links { display: flex; gap: 4px; font-size: 14px; color: var(--ink-2); }
	.links a { padding: 6px 10px; border-radius: 6px; }
	.links a:hover { color: var(--ink); background: var(--subtle); }
	.links a.on { color: var(--ink); font-weight: 500; background: var(--subtle); }
	.grow { flex: 1; }
	.theme { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--line) !important; border-radius: 7px; background: var(--surface) !important; color: var(--ink-2) !important; }
	.theme:hover { background: var(--subtle) !important; }
	.mono { font-family: var(--mono, 'IBM Plex Mono', monospace); }
	.login { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 7px; border: 1px solid var(--line); font-size: 14px; font-weight: 500; }
	.login:hover { background: var(--subtle); }
	.burger { display: none; width: 44px; height: 44px; place-items: center; font-size: 18px; color: var(--ink-2) !important; }
	.mmenu { position: absolute; top: 52px; right: 8px; width: 240px; display: flex; flex-direction: column; padding: 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-pop); font-size: 15px; }
	.mmenu a, .mmenu button { padding: 10px; border-radius: 6px; text-align: left; }
	.mmenu a:hover, .mmenu button:hover { background: var(--subtle) !important; }

	/* Avatar */
	.avatar-wrap { position: relative; }
	.avatar-btn { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 4px 6px; border-radius: 6px; }
	.avatar-btn:hover { background: var(--subtle) !important; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
	.avatar { width: 32px; height: 32px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink); display: grid; place-items: center; font-size: 12px; font-weight: 600; flex: none; }
	.avatar-name { font-size: 14px; color: var(--ink); }
	.amenu { position: absolute; top: calc(100% + 6px); right: 0; width: 260px; display: flex; flex-direction: column; padding: 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); box-shadow: 0 12px 32px -12px rgb(15 23 42 / .28); font-size: 14px; line-height: 20px; z-index: 20; }
	.amenu-head { display: flex; flex-direction: column; padding: 10px 10px 12px; border-bottom: 1px solid var(--line); margin-bottom: 4px; }
	.amenu-display { font-weight: 600; }
	.amenu-username { font-size: 12px; color: var(--ink-3); }
	.amenu-item { padding: 9px 10px; border-radius: 6px; text-align: left; display: block; width: 100%; font-size: 14px; }
	.amenu-item:hover { background: var(--subtle) !important; }
	.amenu-logout { color: var(--ink-2); border-top: 1px solid var(--line); margin-top: 4px; }
	.amenu-logout:disabled { opacity: 0.6; }

	@media (max-width: 767px) {
		.nav { height: 56px; gap: 8px; padding: 0 6px 0 16px; }
		.brand { font-size: 17px; gap: 8px; }
		.ic { width: 26px; height: 22px; }
		.links, .theme { display: none; }
		.login { padding: 0 12px; }
		.burger { display: grid; }
		.avatar-name { display: none; }
		.avatar-btn { gap: 0; padding: 4px; }
	}
</style>
