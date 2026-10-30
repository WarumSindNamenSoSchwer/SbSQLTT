<script lang="ts">
	// Datenschutzerklärung im Layout A5 (Inhaltsverzeichnis links, Lesespalte 680 px).
	// Inhalt: $lib/tabula/privacy.ts. Belege je Absatz (src) nur intern, Prüfprotokoll: docs/DATENSCHUTZ-QUELLEN.md
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { SECTIONS, STAND, CONTROLLER } from '$lib/tabula/privacy';

	let dark = $state(false);
	let active = $state(SECTIONS[0].id);
	const draft = !CONTROLLER.name || CONTROLLER.address.length === 0;

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		// aktiven Abschnitt im Inhaltsverzeichnis markieren
		const io = new IntersectionObserver(
			(es) => {
				const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				if (v) active = v.target.id;
			},
			{ rootMargin: '-80px 0px -60% 0px' }
		);
		document.querySelectorAll('[data-sec]').forEach((el) => io.observe(el));
		return () => {
			mo.disconnect();
			io.disconnect();
		};
	});
</script>

<svelte:head>
	<title>Datenschutzerklärung · Tabula</title>
	{#if draft}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<div class="tb page">
	<TopNav {dark} />
	<div class="wrap">
		<nav class="toc" aria-label="Inhalt">
			<span class="lbl">INHALT</span>
			{#each SECTIONS as s}
				<a href="#{s.id}" class:on={active === s.id}>{s.title}</a>
			{/each}
		</nav>
		<main class="col">
			<h1>Datenschutzerklärung</h1>
			<span class="stand">Stand: {STAND}</span>
			{#if draft}
				<p class="draft" role="note">Entwurf: Name und ladungsfähige Anschrift des Verantwortlichen werden noch ergänzt.</p>
			{/if}

			{#each SECTIONS as s, i}
				<section id={s.id} data-sec>
					<h2>{i + 1}. {s.title}</h2>
					{#each s.blocks as b}
						{#if b.p === '{{CONTROLLER}}'}
							<address>
								{#if draft}
									<span class="ph">[Vor- und Nachname]</span><br /><span class="ph">[ladungsfähige Anschrift]</span><br />
								{:else}
									{CONTROLLER.name}<br />{#each CONTROLLER.address as l}{l}<br />{/each}
								{/if}
								E-Mail: <a href="mailto:{CONTROLLER.email}">{CONTROLLER.email}</a>
							</address>
						{:else if b.needsAvv && !CONTROLLER.avv}
							<p class="ph">[Vertrag zur Auftragsverarbeitung mit Hetzner nach Art. 28 DSGVO: wird abgeschlossen]</p>
						{:else if b.p}
							<p>
								{b.p.replace(' {{AUFSICHT}}', '')}
								{#if b.p.includes('{{AUFSICHT}}')}
									{#if draft}<span class="ph">[Zuständige Behörde nach Sitz des Verantwortlichen, z. B. in Berlin: Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59-61, 10555 Berlin]</span>{:else}Für uns ist das die Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59-61, 10555 Berlin, <a href="https://www.datenschutz-berlin.de" rel="noreferrer">www.datenschutz-berlin.de</a>.{/if}
								{/if}
							</p>
						{/if}
						{#if b.list}
							<ul>
								{#each b.list as li}<li>{li}</li>{/each}
							</ul>
						{/if}
					{/each}
				</section>
			{/each}

		</main>
	</div>
	<footer style="border-top:1px solid var(--line);padding:20px clamp(16px,3vw,48px);display:flex;gap:20px;flex-wrap:wrap;font-size:14px;color:var(--ink-3)">
		<span style="margin-right:auto">Kostenlos und Open Source unter AGPL-3.0.</span>
		<a href="/impressum" style="color:var(--ink-3)">Impressum</a>
		<a href="/datenschutz" style="color:var(--ink-3)">Datenschutzerklärung</a>
	</footer>
</div>

<style>
	.page { min-height: 100dvh; background: var(--bg); color: var(--ink); display: flex; flex-direction: column; }
	.wrap { display: flex; justify-content: center; gap: 72px; padding: 48px 40px 96px; }
	.toc { width: 240px; flex: none; display: flex; flex-direction: column; gap: 2px; padding-top: 8px; position: sticky; top: 24px; align-self: flex-start; max-height: calc(100dvh - 48px); overflow: auto; }
	.toc .lbl { font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; color: var(--ink-3); padding: 0 10px 10px; }
	.toc a { padding: 6px 10px; border-radius: 6px; font-size: 14px; color: var(--ink-2); }
	.toc a:hover { background: var(--subtle); }
	.toc a.on { background: var(--accent-soft); color: var(--accent-ink); font-weight: 500; }
	.col { width: 680px; max-width: 100%; display: flex; flex-direction: column; gap: 18px; }
	h1 { margin: 0; font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; }
	.stand { font-size: 14px; color: var(--ink-3); }
	h2 { margin: 12px 0 0; font-size: 24px; line-height: 32px; font-weight: 600; }
	section { display: flex; flex-direction: column; gap: 18px; scroll-margin-top: 24px; }
	p, li, address { margin: 0; font-size: 16px; line-height: 26px; }
	address { font-style: normal; }
	ul { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 8px; }
	a { color: var(--accent-ink); }
	.col a:hover { text-decoration: underline; text-underline-offset: 3px; }
	.ph { color: var(--ink-3); }
	.draft { padding: 12px 16px; border: 1px solid var(--line-strong); border-radius: 10px; background: var(--subtle); font-size: 15px; }
	@media (max-width: 1023px) {
		.wrap { gap: 0; padding: 24px 20px 64px; }
		.toc { display: none; }
	}
	@media (max-width: 767px) {
		h1 { font-size: 28px; line-height: 34px; }
		h2 { font-size: 20px; line-height: 28px; }
		p, li, address { font-size: 15px; line-height: 24px; }
	}
</style>
