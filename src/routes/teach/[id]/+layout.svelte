<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import {
		apiTeacherGetClasses,
		apiTeacherGetClass,
		apiTeacherNewCode,
		type TeacherClass,
	} from '$lib/tabula/api.js';
	import QRCode from 'qrcode';

	let { children } = $props();

	let dark = $state(false);
	let cls = $state<TeacherClass | null>(null);
	let allClasses = $state<TeacherClass[]>([]);
	let loading = $state(true);
	let classId = $derived(Number(page.params.id));
	let qrDataUrl = $state<string | null>(null);
	let qrOpen = $state(false);
	let classSwitcherOpen = $state(false);

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
			const url = `https://www.tabulasql.de/beitreten/${cls.join_code}`;
			qrDataUrl = await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
		}
	}

	function closeQrOnEsc(e: KeyboardEvent) {
		if (e.key === 'Escape') qrOpen = false;
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
	<TopNav {dark} />

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
					<span class="class-meta">{cls.student_count ?? 0} Schüler</span>
				</div>
				<div class="class-header-actions">
					<button class="code-btn" onclick={openQr} title="QR-Code anzeigen">
						<span class="mono code-text">{cls.join_code}</span>
						<span class="code-qr-hint">QR ⤢</span>
					</button>
					<button class="btn-quiz" onclick={() => {}}>▶ Quiz starten</button>
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
					<div class="qr-dialog-url mono">tabulasql.de/beitreten/{cls.join_code}</div>
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
	.code-qr-hint { font-size: 13px; color: var(--ink-3); font-family: var(--sans); letter-spacing: 0; }
	.btn-quiz { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-quiz:hover { background: var(--accent-strong); }

	.class-tabs { display: flex; gap: 28px; font-size: 14px; color: var(--ink-2); overflow-x: auto; }
	@media (max-width: 767px) { .class-tabs { gap: 20px; } }
	.tab { padding-bottom: 12px; white-space: nowrap; }
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
	.qr-dialog-code { font-family: var(--mono); font-size: 38px; font-weight: 500; letter-spacing: 5px; }
	.qr-dialog-url { font-family: var(--mono); font-size: 12px; color: var(--ink-3); word-break: break-all; }
	.qr-dialog-actions { display: flex; gap: 10px; margin-top: 4px; }
	.btn-secondary { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; font-weight: 500; cursor: pointer; }
	.btn-secondary:hover { background: var(--subtle); }
</style>
