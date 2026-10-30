<script lang="ts">
	// Nutzungsbedingungen im Layout der Datenschutzerklärung (Inhaltsverzeichnis links, Lesespalte 680 px).
	// Inhalt: $lib/tabula/terms.ts. Quellen je Absatz (src) nur intern, Protokoll: docs/NUTZUNGSBEDINGUNGEN-QUELLEN.md
	// Offline: LIVE = false in terms.ts, dann 404.
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { error } from '@sveltejs/kit';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import SiteFooter from '$lib/tabula/SiteFooter.svelte';
	import { SECTIONS, STAND, LIVE } from '$lib/tabula/terms';

	if (!LIVE) error(404, 'Nicht gefunden');

	let dark = $state(false);
	let active = $state(SECTIONS[0].id);

	// E-Mail-Adresse und Seitenverweise im Fließtext als Links
	const LINKS: [RegExp, string][] = [
		[/kontakt@tabulasql\.de/g, '<a href="mailto:kontakt@tabulasql.de">kontakt@tabulasql.de</a>'],
		[/Kontaktseite/g, '<a href="/kontakt">Kontaktseite</a>'],
		[/Datenschutzerklärung/g, '<a href="/datenschutz">Datenschutzerklärung</a>'],
		[/Impressum/g, '<a href="/impressum">Impressum</a>'],
		[/auf GitHub/g, 'auf <a href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT" rel="noreferrer">GitHub</a>']
	];
	const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
	const linkify = (s: string) => LINKS.reduce((t, [re, html]) => t.replace(re, html), esc(s));

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
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
	<title>Nutzungsbedingungen · Tabula</title>
	<meta name="description" content="Nutzungsbedingungen von Tabula, dem kostenlosen SQL-Trainer für den Informatikunterricht." />
</svelte:head>

<div class="tb page">
	<TopNav {dark} />
	<div class="wrap">
		<nav class="toc" aria-label="Inhalt">
			<span class="lbl">INHALT</span>
			{#each SECTIONS as s, i}
				<a href="#{s.id}" class:on={active === s.id}>{i + 1}. {s.title}</a>
			{/each}
		</nav>
		<main class="col">
			<h1>Nutzungsbedingungen</h1>
			<span class="stand">Stand: {STAND}</span>

			{#each SECTIONS as s, i}
				<section id={s.id} data-sec>
					<h2>{i + 1}. {s.title}</h2>
					{#each s.blocks as b}
						{#if b.p}<p>{@html linkify(b.p)}</p>{/if}
						{#if b.list}
							<ul>
								{#each b.list as li}<li>{@html linkify(li)}</li>{/each}
							</ul>
						{/if}
					{/each}
				</section>
			{/each}
		</main>
	</div>
	<SiteFooter />
</div>

<style>
	.page { min-height: 100dvh; background: var(--bg); color: var(--ink); display: flex; flex-direction: column; }
	.wrap { display: flex; justify-content: center; gap: 72px; padding: 48px 40px 96px; }
	.toc { width: 260px; flex: none; display: flex; flex-direction: column; gap: 2px; padding-top: 8px; position: sticky; top: 24px; align-self: flex-start; max-height: calc(100dvh - 48px); overflow: auto; }
	.toc .lbl { font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; color: var(--ink-3); padding: 0 10px 10px; }
	.toc a { padding: 6px 10px; border-radius: 6px; font-size: 14px; color: var(--ink-2); }
	.toc a:hover { background: var(--subtle); }
	.toc a.on { background: var(--accent-soft); color: var(--accent-ink); font-weight: 500; }
	.col { width: 680px; max-width: 100%; display: flex; flex-direction: column; gap: 18px; }
	h1 { margin: 0; font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; }
	.stand { font-size: 14px; color: var(--ink-3); }
	h2 { margin: 12px 0 0; font-size: 24px; line-height: 32px; font-weight: 600; }
	section { display: flex; flex-direction: column; gap: 18px; scroll-margin-top: 24px; }
	p, li { margin: 0; font-size: 16px; line-height: 26px; }
	ul { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 8px; }
	.col :global(a) { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
	@media (max-width: 1023px) {
		.wrap { gap: 0; padding: 24px 20px 64px; }
		.toc { display: none; }
	}
	@media (max-width: 767px) {
		h1 { font-size: 28px; line-height: 34px; }
		h2 { font-size: 20px; line-height: 28px; }
		p, li { font-size: 15px; line-height: 24px; }
	}
</style>
