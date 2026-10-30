<!-- Fußzeile für App-Seiten (Entwurf v12, Systemseiten): Pflichtlinks immer erreichbar. -->
<script lang="ts">
	import { LIVE as TERMS_LIVE } from '$lib/tabula/terms';
</script>

<footer class="sitefoot">
	<span class="grow">Kostenlos und Open Source unter AGPL-3.0.</span>
	<a href="/impressum">Impressum</a>
	<a href="/datenschutz">Datenschutz</a>
	{#if TERMS_LIVE}<a href="/nutzungsbedingungen">Nutzungsbedingungen</a>{/if}
</footer>

<style>
	.sitefoot { border-top: 1px solid var(--line); padding: 20px clamp(16px, 3vw, 48px); display: flex; gap: 20px; flex-wrap: wrap; font-size: 14px; color: var(--ink-3); margin-top: auto; }
	.sitefoot a { color: var(--ink-3); }
	.sitefoot a:hover { color: var(--ink); }
	.grow { margin-right: auto; }
</style>
