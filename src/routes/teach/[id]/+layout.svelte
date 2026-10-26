<script lang="ts">
	import { siteOrigin, siteHost } from '$lib/tabula/site.js';
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session, sessionLogout } from '$lib/tabula/session.svelte.js';
	import {
		apiTeacherGetClasses,
		apiTeacherGetClass,
		apiTeacherNewCode,
		type TeacherClass,
	} from '$lib/tabula/api.js';
	import QRCode from 'qrcode';
	import G from '$lib/edgar/owl-gen.js';

	let { children } = $props();

	let dark = $state(false);
	// Gleiches Logo wie in der TopNav (owl-gen icon)
	const logoSvg = $derived(
		G.icon(dark ? { body: '#E2E8F0', line: '#E2E8F0' } : {}).replace('<svg ', '<svg width="100%" height="100%" aria-hidden="true" ')
	);
	let cls = $state<TeacherClass | null>(null);
	let allClasses = $state<TeacherClass[]>([]);
	let loading = $state(true);
	let classId = $derived(Number(page.params.id));
	let qrDataUrl = $state<string | null>(null);
	let qrOpen = $state(false);
	let classSwitcherOpen = $state(false);
	let avatarMenuOpen = $state(false);

	/** Schuljahr berechnen: ab 1. August neues Schuljahr (z.B. 2026/27). */
	function schuljahr(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1; // 1-12
		const startYear = month >= 8 ? year : year - 1;
		return `${startYear}/${String(startYear + 1).slice(-2)}`;
	}

	/** Avatar-Initialen aus display_name */
	const navInitials = $derived(() => {
		const u = session.teacher;
		if (!u) return '';
		const parts = u.display_name.trim().split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		return parts[0].slice(0, 2).toUpperCase();
	});

	/** Anzeigename (erster Vorname oder display_name) */
	const navDisplayName = $derived(() => {
		const u = session.teacher;
		if (!u) return '';
		// "Fr. Müller" aus name, sonst display_name kuerzen
		if (u.name) {
			const parts = u.name.trim().split(/\s+/);
			if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
			return u.name;
		}
		const parts = u.display_name.trim().split(/\s+/);
		if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
		return u.display_name;
	});

	const pathSuffix = $derived(() => {
		const p = page.url.pathname;
		if (p.endsWith('/lektionen')) return 'lektionen';
		if (p.endsWith('/schueler')) return 'schueler';
		if (p.endsWith('/einstellungen')) return 'einstellungen';
		return 'uebersicht';
	});

	const tabs = [
		{ id: 'uebersicht', label: 'Übersicht', href: () => `/teach/${classId}` },
		{ id: 'lektionen', label: 'Lektionen', href: () => `/teach/${classId}/lektionen` },
		{ id: 'schueler', label: 'Schüler', href: () => `/teach/${classId}/schueler` },
		{ id: 'einstellungen', label: 'Einstellungen', href: () => `/teach/${classId}/einstellungen` },
	];

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		const checkAuth = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(checkAuth, 50); return; }
			if (!session.user) { goto('/login?redirect=/teach'); return; }
			if (session.user.role !== 'teacher') { goto('/teach'); return; }
			loadData();
		};
		checkAuth();

		document.addEventListener('click', closeOnOutside);
		return () => {
			mo.disconnect();
			document.removeEventListener('click', closeOnOutside);
		};
	});

	function closeOnOutside(e: MouseEvent) {
		if (!(e.target as Element).closest('.class-switcher')) classSwitcherOpen = false;
		if (!(e.target as Element).closest('.av-wrap')) avatarMenuOpen = false;
	}

	async function loadData() {
		loading = true;
		try {
			const [clsRes, allRes] = await Promise.all([
				apiTeacherGetClass(classId),
				apiTeacherGetClasses(),
			]);
			cls = clsRes.class;
			allClasses = allRes.classes.filter(c => !c.archived);
		} catch {
			goto('/teach');
		} finally {
			loading = false;
		}
	}

	async function openQr() {
		qrOpen = true;
		if (!qrDataUrl && cls) {
			const url = `${siteOrigin()}/beitreten/${cls.join_code}`;
			qrDataUrl = await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
		}
	}

	function closeQrOnEsc(e: KeyboardEvent) {
		if (e.key === 'Escape') { qrOpen = false; }
	}

	async function handleAvatarLogout() {
		avatarMenuOpen = false;
		try { await sessionLogout(); } catch { /* ignore */ }
		goto('/login');
	}

	// Provide class data to child pages via context
	import { setContext } from 'svelte';
	setContext('teachClass', {
		get cls() { return cls; },
		reload: loadData,
		setFocus: (lesson: string | null) => {
			if (cls) cls = { ...cls, focus_lesson: lesson };
		},
	});
</script>

<svelte:head>
	<title>{cls ? cls.name + ' · Tabula' : 'Klasse · Tabula'}</title>
</svelte:head>
<svelte:window onkeydown={closeQrOnEsc} />

<div class="tb page">
	<!-- Lehrkraft-Topbar mit Klassen-Umschalter (Design D3-D6) -->
	<header class="teach-nav">
		<a class="teach-brand" href="/teach">
			<span class="teach-logo-owl" aria-hidden="true">{@html logoSvg}</span>
			Tabula
		</a>
		{#if cls}
			<span class="teach-nav-sep" aria-hidden="true"></span>
			<!-- Klassen-Umschalter Dropdown -->
			<div class="class-switcher">
				<button
					class="class-switcher-btn"
					aria-haspopup="listbox"
					aria-expanded={classSwitcherOpen}
					onclick={() => (classSwitcherOpen = !classSwitcherOpen)}
				>{cls.name} <span class="cs-arrow">▾</span></button>
				{#if classSwitcherOpen}
					<div class="cs-dropdown" role="listbox" aria-label="Klasse wechseln">
						{#each allClasses as c (c.id)}
							<a
								href="/teach/{c.id}"
								class="cs-option"
								class:cs-current={c.id === classId}
								onclick={() => (classSwitcherOpen = false)}
								role="option"
								aria-selected={c.id === classId}
							>{c.name}</a>
						{/each}
						{#if allClasses.length === 0}
							<span class="cs-empty">Keine Klassen</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
		<span class="teach-nav-grow"></span>
		<!-- Avatar-Menue -->
		{#if session.user}
			<div class="av-wrap">
				<button
					class="av-btn"
					aria-label="Kontomenue"
					aria-expanded={avatarMenuOpen}
					onclick={() => (avatarMenuOpen = !avatarMenuOpen)}
				>
					<span class="av-circle">{navInitials()}</span>
					<span class="av-name">{navDisplayName()} ▾</span>
				</button>
				{#if avatarMenuOpen}
					<div class="av-menu" role="menu">
						<div class="av-head">
							<span class="av-display">{session.displayName}</span>
							<span class="av-email">{session.teacher?.email ?? ''}</span>
						</div>
						<a role="menuitem" href="/profil" onclick={() => (avatarMenuOpen = false)} class="av-item">Profil</a>
						<a role="menuitem" href="/teach" onclick={() => (avatarMenuOpen = false)} class="av-item">Alle Klassen</a>
						<button role="menuitem" class="av-item av-logout" onclick={handleAvatarLogout}>Abmelden</button>
					</div>
				{/if}
			</div>
		{/if}
	</header>

	{#if !ACCOUNTS_LIVE}
		<main class="center">
			<div class="notice-box" role="status">
				<span class="notice-ico">i</span>
				<span>Konten sind in Kürze verfügbar.</span>
			</div>
		</main>
	{:else if loading}
		<main class="center"><div class="spinner-wrap"><span class="spinner"></span></div></main>
	{:else if cls}
		<div class="class-header">
			<div class="class-header-top">
				<div class="class-header-title">
					<h1 class="class-name">{cls.name}</h1>
					<span class="class-meta">Schuljahr {schuljahr()} · {cls.student_count ?? 0} Schüler</span>
				</div>
				<div class="class-header-actions">
					<button class="code-btn" onclick={openQr} title="QR-Code anzeigen">
						<span class="mono code-text">{cls.join_code}</span>
						<span class="code-qr-hint">QR ⤢</span>
					</button>
					<a href="/teach/quiz" class="btn-quiz">▶ Quiz</a>
				</div>
			</div>
			<nav class="class-tabs" aria-label="Klassen-Navigation">
				{#each tabs as t}
					<a
						href={t.href()}
						class="tab"
						class:active={pathSuffix() === t.id}
					>{t.label}</a>
				{/each}
			</nav>
		</div>

		<main class="class-main">
			{@render children()}
		</main>

		{#if qrOpen}
			<div
				class="qr-dialog-overlay"
				role="dialog"
				aria-modal="true"
				aria-label="QR-Code"
			>
				<div class="qr-dialog">
					<button class="qr-close" onclick={() => (qrOpen = false)} aria-label="Schließen">✕</button>
					<h2 class="qr-dialog-title">{cls.name} beitreten</h2>
					{#if qrDataUrl}
						<img src={qrDataUrl} alt="QR-Code für Klasse {cls.name}" class="qr-dialog-img" />
					{/if}
					<div class="qr-dialog-code mono">{cls.join_code}</div>
					<div class="qr-dialog-url mono">{siteHost()}/beitreten/{cls.join_code}</div>
					<div class="qr-dialog-actions">
						<button class="btn-secondary" onclick={() => { qrOpen = false; goto(`/teach/${classId}/einstellungen`); }}>Einstellungen</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
	.notice-box { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; background: var(--accent-soft); border: 1px solid var(--accent-line); font-size: 14px; color: var(--accent-ink); }
	.notice-ico { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }
	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	/* Lehrkraft-Topbar */
	.teach-nav {
		height: 64px;
		flex: none;
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 0 32px;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
		position: relative;
		z-index: 10;
	}
	@media (max-width: 767px) { .teach-nav { padding: 0 16px; gap: 12px; } }

	.teach-brand {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.5px;
		color: var(--ink);
		text-decoration: none;
		flex: none;
	}
	.teach-logo-owl { width: 30px; height: 26px; display: block; }
	.teach-logo-owl :global(svg) { display: block; }

	.teach-nav-sep { width: 1px; height: 22px; background: var(--line); flex: none; }
	.teach-nav-grow { flex: 1; }

	/* Klassen-Umschalter */
	.class-switcher { position: relative; }
	.class-switcher-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 12px;
		border-radius: 6px;
		border: 1px solid var(--line-strong);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		background: var(--surface);
		color: var(--ink);
	}
	.class-switcher-btn:hover { background: var(--subtle); }
	.cs-arrow { color: var(--ink-3); font-size: 12px; }
	.cs-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 20;
		min-width: 200px;
		max-height: 300px;
		overflow-y: auto;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 8px;
		box-shadow: var(--shadow-pop);
		display: flex;
		flex-direction: column;
		padding: 4px;
	}
	.cs-option {
		padding: 8px 10px;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		color: var(--ink);
		text-decoration: none;
		display: block;
	}
	.cs-option:hover { background: var(--subtle); }
	.cs-current { background: var(--accent-soft); color: var(--accent-ink); }
	.cs-empty { padding: 8px 10px; font-size: 14px; color: var(--ink-3); }

	/* Avatar-Menue */
	.av-wrap { position: relative; }
	.av-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		cursor: pointer;
		border-radius: 6px;
		padding: 4px 8px;
		color: var(--ink);
	}
	.av-btn:hover { background: var(--subtle); }
	.av-circle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent-ink);
		display: grid;
		place-items: center;
		font-size: 12px;
		font-weight: 600;
		flex: none;
	}
	.av-name { font-weight: 500; }
	.av-menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 20;
		width: 260px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 10px;
		box-shadow: var(--shadow-pop);
		display: flex;
		flex-direction: column;
		padding: 6px;
		font-size: 14px;
	}
	.av-head {
		display: flex;
		flex-direction: column;
		padding: 10px 10px 12px;
		border-bottom: 1px solid var(--line);
		margin-bottom: 4px;
		gap: 2px;
	}
	.av-display { font-weight: 600; }
	.av-email { font-size: 12px; color: var(--ink-3); }
	.av-item {
		padding: 9px 10px;
		border-radius: 6px;
		color: var(--ink);
		text-decoration: none;
		cursor: pointer;
		text-align: left;
		font-size: 14px;
		display: block;
		width: 100%;
	}
	.av-item:hover { background: var(--subtle); }
	.av-logout { color: var(--ink-2); border-top: 1px solid var(--line); margin-top: 4px; border-radius: 0 0 6px 6px; }

	/* Klassen-Header */
	.class-header { flex: none; background: var(--surface); border-bottom: 1px solid var(--line); padding: 24px 40px 0; display: flex; flex-direction: column; gap: 16px; }
	@media (max-width: 767px) { .class-header { padding: 16px 16px 0; } }
	.class-header-top { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
	.class-header-title { flex: 1; display: flex; flex-direction: column; }
	.class-name { font-size: 28px; line-height: 36px; font-weight: 600; letter-spacing: -0.01em; }
	.class-meta { font-size: 14px; color: var(--ink-3); }
	.class-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

	.code-btn { display: inline-flex; align-items: center; gap: 10px; height: 40px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line-strong); font-size: 15px; font-weight: 500; cursor: pointer; background: var(--surface); }
	.code-btn:hover { background: var(--subtle); }
	.code-text { letter-spacing: 2px; font-family: var(--mono); }
	.code-qr-hint { font-size: 13px; color: var(--ink-3); font-family: var(--mono); letter-spacing: 0; }
	.btn-quiz { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-quiz:hover { background: var(--accent-strong); }

	.class-tabs { display: flex; gap: 28px; font-size: 14px; color: var(--ink-2); overflow-x: auto; }
	@media (max-width: 767px) { .class-tabs { gap: 20px; } }
	.tab { padding-bottom: 12px; white-space: nowrap; color: inherit; text-decoration: none; }
	.tab:hover { color: var(--ink); }
	.tab.active { color: var(--ink); font-weight: 500; box-shadow: 0 2px 0 var(--accent); }

	.class-main { flex: 1; display: flex; flex-direction: column; }
	.mono { font-family: var(--mono); }

	/* QR Dialog */
	.qr-dialog-overlay { position: fixed; inset: 0; background: rgb(15 23 42 / 0.5); z-index: 50; display: grid; place-items: center; padding: 20px; }
	.qr-dialog { position: relative; background: var(--surface); border-radius: 10px; box-shadow: var(--shadow-pop); padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; max-width: 400px; width: 100%; }
	.qr-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; display: grid; place-items: center; color: var(--ink-3); border-radius: 6px; cursor: pointer; }
	.qr-close:hover { background: var(--subtle); color: var(--ink); }
	.qr-dialog-title { font-size: 20px; font-weight: 600; }
	.qr-dialog-img { width: 240px; height: 240px; border-radius: 6px; }
	.qr-dialog-code { font-family: var(--mono); font-size: 28px; font-weight: 500; letter-spacing: 2px; white-space: nowrap; }
	.qr-dialog-url { font-family: var(--mono); font-size: 12px; color: var(--ink-3); word-break: break-all; }
	.qr-dialog-actions { display: flex; gap: 10px; margin-top: 4px; }
	.btn-secondary { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; font-weight: 500; cursor: pointer; }
	.btn-secondary:hover { background: var(--subtle); }
</style>
