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
	import { CATALOG } from '$lib/tabula/lessons.js';

	function lessonLabel(id: string | null | undefined): string {
		if (!id) return 'Kein Fokus';
		const e = CATALOG.find((c) => c.id === id);
		return e ? `${e.n} · ${e.title}` : id;
	}
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
					<div class="seg-tabs" role="tablist" aria-label="Filter">
						<button role="tab" aria-selected={tab === 'aktiv'} class:active={tab === 'aktiv'} onclick={() => (tab = 'aktiv')}>Aktiv</button>
						<button role="tab" aria-selected={tab === 'archiviert'} class:active={tab === 'archiviert'} onclick={() => (tab = 'archiviert')}>Archiviert</button>
					</div>
					<button class="btn-primary" onclick={() => goto('/teach/neu')}>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"></path></svg>
						Neue Klasse
					</button>
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
							<button class="btn-primary mt6" onclick={() => goto('/teach/neu')}>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"></path></svg>
								Neue Klasse
							</button>
						</div>
					{:else}
						<div class="empty-state">
							<span class="empty-title">Keine archivierten Klassen</span>
						</div>
					{/if}
				{:else}
					<div class="class-table-wrap">
						<table class="class-table">
							<thead>
								<tr>
									<th scope="col">Klasse</th>
									<th scope="col">Fokus</th>
									<th scope="col" class="th-right">Schüler</th>
									<th scope="col">Hängt fest</th>
								</tr>
							</thead>
							<tbody>
								{#each shown as cls (cls.id)}
									<tr class="class-row" onclick={() => goto(`/teach/${cls.id}`)}>
										<td>
											<button type="button" class="class-name-btn" onclick={() => goto(`/teach/${cls.id}`)}>
												{cls.name}
											</button>
										</td>
										<td class="td-focus">{lessonLabel(cls.focus_lesson)}</td>
										<td class="td-right">{cls.student_count ?? 0}</td>
										<td>
											{#if (cls.stuck_count ?? 0) > 0}
												<span class="stuck-dot red"></span><span class="stuck-txt danger">{cls.stuck_count} hängen fest</span>
											{:else}
												<span class="stuck-dot green"></span><span class="stuck-txt ok">Niemand</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
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
	.teach-content { width: 100%; max-width: 1200px; display: flex; flex-direction: column; gap: 24px; }

	.page-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.verify-banner { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--accent-soft); color: var(--accent-ink); font-size: 14px; line-height: 20px; }
	.verify-banner span { flex: 1; min-width: 220px; }
	.verify-btn { height: 34px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--accent-line); background: var(--surface); color: var(--accent-ink); font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
	.verify-btn:disabled { opacity: .7; cursor: default; }
	.page-title { flex: 1; font-size: clamp(26px, 2.2vw, 34px); font-weight: 600; letter-spacing: -0.025em; }

	.seg-tabs { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--subtle); font-size: 14px; font-weight: 500; }
	.seg-tabs button { height: 32px; padding: 0 12px; border-radius: 6px; color: var(--ink-2); cursor: pointer; }
	.seg-tabs button.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }

	.btn-primary { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
	.btn-primary:hover { background: var(--accent-strong); }

	.error-box { padding: 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }

	.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; border: 1px dashed var(--line-strong); border-radius: 16px; padding: 64px 24px; min-height: 300px; }
	:global(.empty-owl) { width: 140px; height: 126px; }
	.empty-title { font-size: 22px; font-weight: 600; }
	.empty-body { font-size: 15px; color: var(--ink-2); max-width: 44ch; line-height: 1.6; }
	.mt6 { margin-top: 6px; }

	/* Table */
	.class-table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
	.class-table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 15px; }
	.class-table thead tr { background: var(--subtle); }
	.class-table th { text-align: left; padding: 11px 20px; font: 500 12px/1 var(--mono); letter-spacing: 0.06em; color: var(--ink-3); border-bottom: 1px solid var(--line); }
	.th-right { text-align: right; }
	.class-table tbody tr.class-row { cursor: pointer; transition: background 0.1s; }
	.class-table tbody tr.class-row:hover { background: var(--subtle); }
	.class-table td { padding: 15px 20px; border-bottom: 1px solid var(--line); vertical-align: middle; }
	.class-table tbody tr:last-child td { border-bottom: none; }
	.class-name-btn { font-weight: 600; font-size: 15px; cursor: pointer; }
	.class-name-btn:hover { text-decoration: underline; color: var(--accent-ink); }
	.td-focus { color: var(--ink-2); font-size: 14px; }
	.td-right { text-align: right; font-variant-numeric: tabular-nums; }
	.stuck-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px; vertical-align: middle; flex: none; }
	.stuck-dot.red { background: var(--danger); }
	.stuck-dot.green { background: var(--ok); }
	.stuck-txt { font-size: 14px; font-weight: 500; vertical-align: middle; }
	.stuck-txt.danger { color: var(--danger-ink); }
	.stuck-txt.ok { color: var(--ink-3); font-weight: 400; }
</style>
