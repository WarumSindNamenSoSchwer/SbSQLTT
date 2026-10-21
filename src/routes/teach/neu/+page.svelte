<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { CATALOG, TRACK_INFO } from '$lib/tabula/lessons.js';
	import {
		apiTeacherCreateClass,
		type TeacherClass,
		ApiError,
	} from '$lib/tabula/api.js';
	import QRCode from 'qrcode';

	let dark = $state(false);
	let name = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let touched = $state(false);
	// Tracks freigeschaltet beim Start
	let tracksEnabled = $state<Record<string, boolean>>({
		beginner: true,
		database: false,
		python: false,
	});

	// Nach Erstellung
	let created = $state<TeacherClass | null>(null);
	let qrDataUrl = $state<string | null>(null);
	let beamerOpen = $state(false);
	let linkCopied = $state(false);

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		if (!ACCOUNTS_LIVE) return;
		if (!session.loading && !session.user) {
			goto('/login?redirect=/teach/neu');
			return;
		}
		if (!session.loading && session.user?.role !== 'teacher') {
			goto('/teach');
		}
		return () => mo.disconnect();
	});

	const nameErr = $derived(touched && !name.trim());

	async function handleCreate(e: Event) {
		e.preventDefault();
		touched = true;
		if (!name.trim()) return;
		busy = true;
		error = null;
		try {
			const res = await apiTeacherCreateClass(name.trim());
			created = res.class;
			// QR-Code erzeugen
			const url = `https://www.tabulasql.de/beitreten/${res.class.join_code}`;
			qrDataUrl = await QRCode.toDataURL(url, { width: 200, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Fehler beim Erstellen.';
		} finally {
			busy = false;
		}
	}

	function getJoinUrl(code: string) {
		return `https://www.tabulasql.de/beitreten/${code}`;
	}

	async function copyLink() {
		if (!created) return;
		await navigator.clipboard.writeText(getJoinUrl(created.join_code));
		linkCopied = true;
		setTimeout(() => (linkCopied = false), 2000);
	}

	async function openBeamer() {
		beamerOpen = true;
		if (created && !qrDataUrl) {
			const url = getJoinUrl(created.join_code);
			qrDataUrl = await QRCode.toDataURL(url, { width: 460, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
		}
	}

	function closeBeamerOnEsc(e: KeyboardEvent) {
		if (e.key === 'Escape') beamerOpen = false;
	}

	const TRACKS = [
		{ id: 'beginner', name: 'SQL-Grundlagen', meta: 'Lektion 1–8' },
		{ id: 'database', name: 'Eigene Datenbank', meta: 'Lektion 9' },
		{ id: 'python', name: 'Python & Daten', meta: 'Lektion 10 + Projekt' },
	];
</script>

<svelte:head><title>Neue Klasse · Tabula</title></svelte:head>
<svelte:window onkeydown={closeBeamerOnEsc} />

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center">
			<div class="notice-box" role="status">
				<span class="notice-ico">i</span>
				<span>Konten sind in Kürze verfügbar.</span>
			</div>
		</main>
	{:else if created}
		<!-- D2-02: Klasse erstellt -->
		<main class="center">
			<div class="created-wrap">
				<div class="created-success-icon" aria-hidden="true">✓</div>
				<h1 class="created-title">{created.name} ist bereit</h1>
				<p class="created-sub">Zeigen Sie den Code oder den QR-Code. Schüler treten damit bei.</p>

				<div class="qr-code-box">
					{#if qrDataUrl}
						<img src={qrDataUrl} alt="QR-Code für {created.name}" class="qr-img" />
					{:else}
						<div class="qr-placeholder"></div>
					{/if}
					<div class="code-info">
						<span class="lbl">BEITRITTSCODE</span>
						<span class="join-code">{created.join_code}</span>
						<span class="join-url mono">{getJoinUrl(created.join_code)}</span>
					</div>
				</div>

				<div class="created-actions">
					<button class="btn-secondary" onclick={openBeamer}>⤢ Vollbild (Beamer)</button>
					<button class="btn-secondary" onclick={copyLink}>{linkCopied ? '✓ Kopiert' : 'Link kopieren'}</button>
					<button class="btn-primary" onclick={() => goto(`/teach/${created!.id}`)}>
						Zur Klasse <span class="arr" aria-hidden="true"></span>
					</button>
				</div>
			</div>
		</main>

		{#if beamerOpen}
			<div class="beamer-overlay" role="dialog" aria-modal="true" aria-label="Vollbild Beamer-Ansicht">
				<button class="beamer-close" onclick={() => (beamerOpen = false)}>Esc · Vollbild beenden</button>
				<h2 class="beamer-classname">{created.name} beitreten</h2>
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="QR-Code" class="beamer-qr" width="460" height="460" />
				{/if}
				<div class="beamer-code">{created.join_code}</div>
				<div class="beamer-url mono">tabulasql.de/beitreten</div>
			</div>
		{/if}
	{:else}
		<!-- D2-01: Neue Klasse Formular -->
		<main class="center">
			<div class="form-outer">
				<a href="/teach" class="back-link">
					<span class="arr back" aria-hidden="true"></span>Klassen
				</a>
				<h1 class="form-title">Neue Klasse</h1>

				<form onsubmit={handleCreate} class="new-class-form">
					<div class="field">
						<label for="cls-name" class="field-label">Name</label>
						<input
							id="cls-name"
							type="text"
							bind:value={name}
							placeholder="z. B. Informatik 9b"
							class:err={nameErr}
							autocomplete="off"
						/>
						{#if nameErr}
							<span class="field-hint danger">Bitte geben Sie einen Namen ein.</span>
						{:else}
							<span class="field-hint">So sehen Ihre Schüler die Klasse.</span>
						{/if}
					</div>

					<div class="field">
						<span class="field-label">Freigeschaltet zum Start</span>
						<div class="tracks-list">
							{#each TRACKS as t}
								<label class="track-row">
									<span class="track-check" class:on={tracksEnabled[t.id]}>
										{#if tracksEnabled[t.id]}✓{/if}
									</span>
									<input
										type="checkbox"
										bind:checked={tracksEnabled[t.id]}
										class="sr-only"
									/>
									<span class="track-name">{t.name}</span>
									<span class="track-meta">{t.meta}</span>
								</label>
							{/each}
						</div>
						<span class="field-hint">Später jederzeit unter „Lektionen" änderbar.</span>
					</div>

					{#if error}
						<div class="error-box">{error}</div>
					{/if}

					<button type="submit" class="btn-primary full" disabled={busy}>
						{busy ? 'Wird erstellt …' : 'Klasse erstellen'}
					</button>
				</form>
			</div>
		</main>
	{/if}
</div>

<style>
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
	.notice-box { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; background: var(--accent-soft); border: 1px solid var(--accent-line); font-size: 14px; color: var(--accent-ink); }
	.notice-ico { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }

	/* Form */
	.form-outer { width: 100%; max-width: 520px; display: flex; flex-direction: column; gap: 18px; }
	.back-link { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: var(--ink-3); }
	.back-link:hover { color: var(--ink); }
	.form-title { font-size: 32px; line-height: 40px; font-weight: 600; letter-spacing: -0.01em; }
	.new-class-form { display: flex; flex-direction: column; gap: 18px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	.field-label { font-size: 14px; font-weight: 500; }
	.field input { height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font: inherit; font-size: 15px; }
	.field input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); outline: none; }
	.field input.err { border-color: var(--danger); }
	.field-hint { font-size: 13px; color: var(--ink-3); }
	.field-hint.danger { color: var(--danger-ink); }
	.tracks-list { display: flex; flex-direction: column; gap: 4px; }
	.track-row { display: flex; align-items: center; gap: 12px; font-size: 15px; cursor: pointer; padding: 4px 0; }
	.track-check { width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid var(--line-strong); display: grid; place-items: center; font-size: 12px; flex: none; color: #fff; }
	.track-check.on { background: var(--accent); border-color: var(--accent); }
	.track-name { flex: 1; font-weight: 500; }
	.track-meta { font-size: 13px; color: var(--ink-3); }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
	.error-box { padding: 12px 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	.btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; padding: 0 20px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.6; cursor: default; }
	.btn-primary.full { width: 100%; margin-top: 8px; }

	/* Created */
	.created-wrap { width: 100%; max-width: 600px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; }
	.created-success-icon { width: 60px; height: 60px; border-radius: 50%; background: var(--ok-soft); color: var(--ok-ink); display: grid; place-items: center; font-size: 26px; font-weight: 700; }
	.created-title { font-size: 32px; line-height: 40px; font-weight: 600; }
	.created-sub { font-size: 15px; color: var(--ink-2); }
	.qr-code-box { display: flex; align-items: center; gap: 36px; padding: 28px 36px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	@media (max-width: 600px) { .qr-code-box { flex-direction: column; gap: 16px; padding: 20px; } }
	.qr-img { width: 200px; height: 200px; border-radius: 6px; display: block; }
	.qr-placeholder { width: 200px; height: 200px; border-radius: 6px; background: var(--subtle); }
	.code-info { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
	.join-code { font-family: var(--mono); font-size: 52px; line-height: 60px; font-weight: 500; letter-spacing: 6px; }
	.join-url { font-size: 13px; color: var(--ink-3); word-break: break-all; }
	.mono { font-family: var(--mono); }
	.created-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
	.btn-secondary { display: inline-flex; align-items: center; height: 44px; padding: 0 18px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 15px; font-weight: 500; cursor: pointer; }
	.btn-secondary:hover { background: var(--subtle); }
	.arr { display: inline-block; width: 0.9em; height: 0.9em; flex: none; vertical-align: -0.1em; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M2.5%208h10.5M8.5%203.5%2013%208l-4.5%204.5%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat; mask: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M2.5%208h10.5M8.5%203.5%2013%208l-4.5%204.5%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat; margin-left: 0.2em; }
	.arr.back { transform: scaleX(-1); margin-left: 0; margin-right: 0.2em; }
	.lbl { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3); }

	/* Beamer Vollbild */
	.beamer-overlay { position: fixed; inset: 0; background: var(--surface); z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; }
	.beamer-close { position: absolute; top: 24px; right: 28px; font-size: 16px; color: var(--ink-3); cursor: pointer; }
	.beamer-close:hover { color: var(--ink); }
	.beamer-classname { font-size: 40px; line-height: 48px; font-weight: 600; }
	.beamer-qr { border-radius: 8px; }
	.beamer-code { font-family: var(--mono); font-size: 88px; line-height: 96px; font-weight: 500; letter-spacing: 10px; }
	.beamer-url { font-family: var(--mono); font-size: 28px; color: var(--ink-2); }
</style>
