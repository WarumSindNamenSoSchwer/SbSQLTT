<script lang="ts">
	// Impressum im Layout A5 (wie Datenschutz). Angaben: $lib/tabula/privacy.ts (CONTROLLER).
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { CONTROLLER } from '$lib/tabula/privacy';

	let dark = $state(false);
	const draft = !CONTROLLER.name || CONTROLLER.address.length === 0;
	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => mo.disconnect();
	});
</script>

<svelte:head>
	<title>Impressum · Tabula</title>
	{#if draft}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<div class="tb page">
	<TopNav {dark} />
	<div class="wrap">
		<main class="col">
			<h1>Impressum</h1>
			{#if draft}
				<p class="draft" role="note">Entwurf: Name und ladungsfähige Anschrift werden noch ergänzt.</p>
			{/if}

			<h2>Anbieter</h2>
			<!-- § 18 Abs. 1 MStV, § 5 Abs. 1 Nr. 1 DDG -->
			<address>
				{#if draft}
					<span class="ph">[Vor- und Nachname]</span><br /><span class="ph">[ladungsfähige Anschrift]</span>
				{:else}
					{CONTROLLER.name}<br />{#each CONTROLLER.address as l, i}{l}{#if i < CONTROLLER.address.length - 1}<br />{/if}{/each}
				{/if}
			</address>

			<h2>Kontakt</h2>
			<!-- § 5 Abs. 1 Nr. 2 DDG -->
			<p>E-Mail: <a href="mailto:{CONTROLLER.email}">{CONTROLLER.email}</a></p>

			<h2>Über Tabula</h2>
			<p>Tabula ist ein kostenloses, nicht kommerzielles Lernangebot für SQL im Informatikunterricht. Der Quellcode ist unter der Lizenz AGPL-3.0 öffentlich auf <a href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT" rel="noreferrer">GitHub</a> verfügbar. Alle Übungsdaten sind ausgedacht.</p>

			<h2>Datenschutz</h2>
			<p>Wie wir mit Daten umgehen, steht in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
		</main>
	</div>
</div>

<style>
	.page { min-height: 100dvh; background: var(--bg); color: var(--ink); }
	.wrap { display: flex; justify-content: center; padding: 48px 40px 96px; }
	.col { width: 680px; max-width: 100%; display: flex; flex-direction: column; gap: 18px; }
	h1 { margin: 0; font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; }
	h2 { margin: 12px 0 0; font-size: 24px; line-height: 32px; font-weight: 600; }
	p, address { margin: 0; font-size: 16px; line-height: 26px; font-style: normal; }
	a { color: var(--accent-ink); }
	a:hover { text-decoration: underline; text-underline-offset: 3px; }
	.ph { color: var(--ink-3); }
	.draft { padding: 12px 16px; border: 1px solid var(--line-strong); border-radius: 10px; background: var(--subtle); font-size: 15px; }
	@media (max-width: 767px) {
		.wrap { padding: 24px 20px 64px; }
		h1 { font-size: 28px; line-height: 34px; }
		h2 { font-size: 20px; line-height: 28px; }
	}
</style>
