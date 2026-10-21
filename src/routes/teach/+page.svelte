<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import {
		apiTeacherGetClasses,
		apiTeacherPatchClass,
		type TeacherClass,
		ApiError,
	} from '$lib/tabula/api.js';

	let dark = $state(false);

	// E-Mail-Bestätigung (K7): Hinweis + Link erneut senden
	let verifyBusy = $state(false);
	let verifySent = $state(false);
	async function resendVerify() {
		verifyBusy = true;
		try {
			const { apiResendVerification } = await import('$lib/tabula/api.js');
			await apiResendVerification();
			verifySent = true;
		} catch {
			/* Fehler still: Banner bleibt */
		} finally {
			verifyBusy = false;
		}
	}
	let classes = $state<TeacherClass[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let tab = $state<'aktiv' | 'archiviert'>('aktiv');

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		const checkAuth = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) {
				setTimeout(checkAuth, 50);
				return;
			}
			if (!session.user) {
				goto('/login?redirect=/teach');
				return;
			}
			if (session.user.role !== 'teacher') {
				// Schüler: Hinweis
				return;
			}
			loadClasses();
		};
		checkAuth();
		return () => mo.disconnect();
	});

	async function loadClasses() {
		loading = true;
		error = null;
		try {
			const res = await apiTeacherGetClasses();
			classes = res.classes;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden.';
		} finally {
			loading = false;
		}
	}

	const activeClasses = $derived(classes.filter(c => !c.archived));
	const archivedClasses = $derived(classes.filter(c => c.archived));
	const shown = $derived(tab === 'aktiv' ? activeClasses : archivedClasses);

	function relativeTime(ts: number): string {
		const s = Math.floor(Date.now() / 1000 - ts);
		if (s < 120) return 'gerade eben';
		if (s < 3600) return `vor ${Math.floor(s / 60)} min`;
		if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
		if (s < 172800) return 'gestern';
		return `vor ${Math.floor(s / 86400)} Tagen`;
	}
</script>

<svelte:head><title>Klassen · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center">
			<div class="form-wrap narrow">
				<div class="title-block">
					<h1>Lehrerbereich</h1>
					<p class="sub">Die Lehrkraft-Funktionen sind in Kürze verfügbar.</p>
				</div>
				<div class="notice-box" role="status">
					<span class="notice-ico">i</span>
					<span>Konten sind in Kürze freigeschaltet. Bitte versuchen Sie es später erneut.</span>
				</div>
			</div>
		</main>
	{:else if session.loading}
		<main class="center"><div class="spinner-wrap"><span class="spinner"></span></div></main>
	{:else if !session.user}
		<main class="center">
			<div class="form-wrap narrow">
				<div class="title-block">
					<h1>Nicht angemeldet</h1>
					<p class="sub">Bitte melden Sie sich an, um den Lehrerbereich zu nutzen.</p>
				</div>
				<a href="/login?redirect=/teach" class="btn-primary" style="display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:6px;background:var(--accent);color:#fff;font-size:15px;font-weight:500;text-decoration:none">Zur Anmeldung</a>
			</div>
		</main>
	{:else if session.user.role !== 'teacher'}
		<main class="center">
			<div class="form-wrap narrow">
				<div class="title-block">
					<h1>Lehrerbereich</h1>
					<p class="sub">Dieser Bereich ist nur für Lehrkräfte zugänglich.</p>
				</div>
				<a href="/learn" class="btn-accent" style="display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:6px;background:var(--accent);color:#fff;font-size:15px;font-weight:500;text-decoration:none">Zum Lernbereich</a>
			</div>
		</main>
	{:else}
		<main class="teach-main">
			<div class="teach-content">
				<div class="page-header">
					<h1 class="page-title">Klassen</h1>
					<div class="seg-tabs">
						<button class:active={tab === 'aktiv'} onclick={() => (tab = 'aktiv')}>Aktiv</button>
						<button class:active={tab === 'archiviert'} onclick={() => (tab = 'archiviert')}>Archiviert</button>
					</div>
					<button class="btn-primary" onclick={() => goto('/teach/neu')}>+ Neue Klasse</button>
				</div>

				{#if session.user && session.user.role === 'teacher' && !session.user.email_verified_at}
					<div class="verify-banner" role="status">
						<span>Bitte bestätigen Sie Ihre E-Mail-Adresse {session.user.email}. Wir haben Ihnen einen Link geschickt.</span>
						<button class="verify-btn" onclick={resendVerify} disabled={verifyBusy || verifySent}>{verifySent ? 'Neuer Link gesendet' : 'Link erneut senden'}</button>
					</div>
				{/if}

				{#if loading}
					<div class="spinner-wrap"><span class="spinner"></span></div>
				{:else if error}
					<div class="error-box">{error}</div>
				{:else if shown.length === 0}
					{#if tab === 'aktiv'}
						<div class="empty-state">
							<Edgar pose="curious" {dark} class="empty-owl" />
							<span class="empty-title">Noch keine Klasse</span>
							<p class="empty-body">Legen Sie Ihre erste Klasse an. Ihre Schüler treten danach mit einem Code oder QR-Code bei.</p>
							<button class="btn-primary mt6" onclick={() => goto('/teach/neu')}>+ Neue Klasse</button>
						</div>
					{:else}
						<div class="empty-state">
							<span class="empty-title">Keine archivierten Klassen</span>
						</div>
					{/if}
				{:else}
					<div class="class-grid">
						{#each shown as cls (cls.id)}
							<button class="class-card" onclick={() => goto(`/teach/${cls.id}`)}>
								<div class="class-card-head">
									<div class="class-card-info">
										<span class="class-name">{cls.name}</span>
										<span class="class-meta">
											{cls.student_count ?? 0} Schüler
										</span>
									</div>
									<span class="card-dots" aria-hidden="true">⋯</span>
								</div>
								<div class="class-focus-box">
									<span class="lbl">FOKUS</span>
									<span class="class-focus">{cls.focus_lesson ?? 'Kein Fokus gesetzt'}</span>
								</div>
								<div class="class-card-footer">
									{#if (cls.stuck_count ?? 0) > 0}
										<span class="badge danger">! {cls.stuck_count} hängen fest</span>
									{:else}
										<span class="badge ok">✓ Niemand hängt fest</span>
									{/if}
									<span class="class-last">{relativeTime(cls.created_at)}</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</main>
	{/if}
</div>

<style>
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
	.form-wrap { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 20px; }
	.narrow { max-width: 440px; }
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	.title-block h1 { font-size: 30px; line-height: 38px; font-weight: 600; letter-spacing: -0.02em; }
	.title-block .sub { font-size: 15px; color: var(--ink-2); }
	.notice-box { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px; background: var(--accent-soft); border: 1px solid var(--accent-line); font-size: 14px; color: var(--accent-ink); }
	.notice-ico { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }
	.spinner-wrap { flex: 1; display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }

	.teach-main { flex: 1; display: flex; justify-content: center; padding: 44px 40px; }
	@media (max-width: 767px) { .teach-main { padding: 20px 16px; } }
	.teach-content { width: 100%; max-width: 1200px; display: flex; flex-direction: column; gap: 28px; }

	.page-header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
	.verify-banner { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--accent-soft); color: var(--accent-ink); font-size: 14px; line-height: 20px; }
	.verify-banner span { flex: 1; min-width: 220px; }
	.verify-btn { height: 34px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--accent-line); background: var(--surface); color: var(--accent-ink); font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.verify-btn:disabled { opacity: .7; cursor: default; }
	.page-title { flex: 1; font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; }
	@media (max-width: 767px) { .page-title { font-size: 26px; line-height: 34px; } }

	.seg-tabs { display: flex; padding: 3px; border-radius: 8px; background: var(--subtle); font-size: 14px; font-weight: 500; }
	.seg-tabs button { padding: 5px 14px; border-radius: 6px; color: var(--ink-2); }
	.seg-tabs button.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }

	.btn-primary { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-primary:hover { background: var(--accent-strong); }

	.error-box { padding: 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }

	.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; border: 1px dashed var(--line-strong); border-radius: 10px; padding: 56px 40px; min-height: 300px; }
	:global(.empty-owl) { width: 150px; height: 135px; }
	.empty-title { font-size: 22px; font-weight: 600; }
	.empty-body { font-size: 15px; color: var(--ink-2); max-width: 440px; line-height: 24px; }
	.mt6 { margin-top: 6px; }

	.class-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
	@media (max-width: 1024px) { .class-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 640px) { .class-grid { grid-template-columns: 1fr; } }

	.class-card { display: flex; flex-direction: column; gap: 14px; padding: 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); text-align: left; cursor: pointer; transition: box-shadow 0.15s; }
	.class-card:hover { box-shadow: 0 4px 16px -4px rgb(15 23 42 / 0.12); }

	.class-card-head { display: flex; align-items: flex-start; gap: 10px; }
	.class-card-info { flex: 1; display: flex; flex-direction: column; }
	.class-name { font-size: 18px; line-height: 26px; font-weight: 600; }
	.class-meta { font-size: 13px; color: var(--ink-3); }
	.card-dots { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 6px; color: var(--ink-3); }

	.class-focus-box { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 6px; background: var(--subtle); }
	.lbl { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3); }
	.class-focus { font-size: 14px; line-height: 20px; font-weight: 500; }

	.class-card-footer { display: flex; align-items: center; gap: 10px; }
	.badge { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
	.badge.danger { background: var(--danger-soft); color: var(--danger-ink); }
	.badge.ok { border: 1px solid var(--line); color: var(--ink-2); font-weight: 500; }
	.class-last { flex: 1; text-align: right; font-size: 13px; color: var(--ink-3); }
</style>
