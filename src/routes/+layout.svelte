<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { initSession } from '$lib/tabula/session.svelte.js';

	let { children } = $props();

	let loginOpen = $state(false);
	// Tabula-Seiten (neues Design) bringen ihre eigene Kopfleiste mit.
	let bare = $derived(
		page.url.pathname === '/' ||
		/^\/learn(\/|$)/.test(page.url.pathname) ||
		/^\/datasets(\/|$)/.test(page.url.pathname) ||
		/^\/login(\/|$)/.test(page.url.pathname) ||
		/^\/beitreten(\/|$)/.test(page.url.pathname) ||
		/^\/profil(\/|$)/.test(page.url.pathname) ||
		/^\/teach(\/|$)/.test(page.url.pathname) ||
		/^\/quiz(\/|$)/.test(page.url.pathname) ||
		/^\/passwort-zuruecksetzen(\/|$)/.test(page.url.pathname) ||
		/^\/email-bestaetigen(\/|$)/.test(page.url.pathname) ||
		page.url.pathname === '/datenschutz' ||
		page.url.pathname === '/impressum' ||
		page.url.pathname === '/kontakt' ||
		// Fehlerseite bringt eigene TopNav mit
		page.error != null
	);

	onMount(() => {
		initSession();
	});
</script>

{#if bare}
	{@render children()}
{:else}
	<div class="min-h-screen text-ink-900 bg-ink-0">
		<Navbar onOpenLogin={() => (loginOpen = true)} />
		{@render children()}
		<Footer />
		<LoginModal open={loginOpen} onClose={() => (loginOpen = false)} />
	</div>
{/if}
