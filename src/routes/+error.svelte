<script lang="ts">
	import { LIVE as TERMS_LIVE } from '$lib/tabula/terms';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import '$lib/tabula/theme.css';

	// Design-Daten aus Frame F-404, F-500, F-OFF
	const FRAMES = {
		404: {
			kicker: 'FEHLER 404',
			title: 'Seite nicht gefunden',
			body: 'Diese Seite gibt es nicht oder nicht mehr. Vielleicht hat sich ein Tippfehler in die Adresse geschlichen.',
			primary: { label: 'Zur Startseite', href: '/' },
			secondary: { label: 'Zu den Lektionen', href: '/learn' },
			pose: 'surprised'
		},
		500: {
			kicker: 'FEHLER 500',
			title: 'Da ist etwas schiefgelaufen',
			body: 'Das liegt nicht an dir. Lade die Seite neu. Wenn es wieder passiert, versuch es in ein paar Minuten noch einmal.',
			primary: { label: '↻ Neu laden', reload: true },
			secondary: null,
			pose: 'error'
		},
		offline: {
			kicker: 'KEINE VERBINDUNG',
			title: 'Du bist offline',
			body: 'Prüfe die Internetverbindung. Sobald sie wieder steht, geht es an derselben Stelle weiter.',
			primary: { label: 'Erneut versuchen', reload: true },
			secondary: null,
			pose: 'sleep'
		}
	} as const;

	let dark = $state(false);
	let online = $state(true);

	$effect(() => {
		// Dunkelmodus: html ohne Klasse 'light' = dunkel
		const root = document.documentElement;
		const syncDark = () => { dark = !root.classList.contains('light'); };
		syncDark();
		const mo = new MutationObserver(syncDark);
		mo.observe(root, { attributes: true, attributeFilter: ['class'] });

		// Online-Status
		online = navigator.onLine;
		const onOnline = () => { online = true; };
		const onOffline = () => { online = false; };
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);

		return () => {
			mo.disconnect();
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	});

	const frame = $derived.by(() => {
		if (!online) return FRAMES.offline;
		if (page.status === 404) return FRAMES[404];
		return FRAMES[500];
	});

	function handlePrimary() {
		const f = frame;
		if ('reload' in f.primary && f.primary.reload) {
			location.reload();
		} else if ('href' in f.primary) {
			location.href = f.primary.href;
		}
	}
</script>

<div class="tb page">
	<TopNav {dark} />
	<div class="body">
		<div class="card">
			<Edgar pose={frame.pose} style="width:180px;height:162px;flex:none" {dark} />
			<span class="kicker mono lbl">{frame.kicker}</span>
			<h1 class="title">{frame.title}</h1>
			<p class="body-text">{frame.body}</p>
			<div class="actions">
				<button class="btn-primary" onclick={handlePrimary}>{frame.primary.label}</button>
				{#if frame.secondary}
					{@const sec = frame.secondary}
					<a class="btn-secondary" href={sec.href}>{sec.label}</a>
				{/if}
			</div>
		</div>
	</div>
	<footer style="border-top:1px solid var(--line);padding:20px clamp(16px,3vw,48px);display:flex;gap:20px;flex-wrap:wrap;font-size:14px;color:var(--ink-3)">
		<span style="margin-right:auto">Kostenlos und Open Source unter AGPL-3.0.</span>
		<a href="/impressum" style="color:var(--ink-3)">Impressum</a>
		<a href="/datenschutz" style="color:var(--ink-3)">Datenschutzerklärung</a>
		{#if TERMS_LIVE}<a href="/nutzungsbedingungen" style="color:var(--ink-3)">Nutzungsbedingungen</a>{/if}
	</footer>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.body {
		flex: 1;
		display: grid;
		place-items: center;
		padding: 40px 24px;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
		max-width: 520px;
		width: 100%;
	}
	.kicker {
		font-size: 13px;
		letter-spacing: 0.06em;
		color: var(--ink-3);
	}
	.title {
		font-size: 36px;
		line-height: 44px;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--ink);
		margin: 0;
	}
	.body-text {
		font-size: 16px;
		line-height: 26px;
		color: var(--ink-2);
		margin: 0;
	}
	.actions {
		display: flex;
		gap: 10px;
		margin-top: 8px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.btn-primary {
		display: inline-flex;
		align-items: center;
		height: 44px;
		padding: 0 20px;
		border-radius: 6px;
		background: var(--accent);
		color: #fff;
		font-size: 15px;
		font-weight: 500;
		font-family: var(--sans);
		cursor: pointer;
		border: 0;
	}
	.btn-primary:hover {
		background: var(--accent-strong);
	}
	.btn-secondary {
		display: inline-flex;
		align-items: center;
		height: 44px;
		padding: 0 18px;
		border-radius: 6px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		font-size: 15px;
		font-weight: 500;
		color: var(--ink);
	}
	.btn-secondary:hover {
		background: var(--subtle);
	}
	@media (max-width: 480px) {
		.title { font-size: 28px; line-height: 36px; }
	}
</style>
