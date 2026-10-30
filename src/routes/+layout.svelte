<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import Navbar from '$lib/components/Navbar.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { initSession, session } from '$lib/tabula/session.svelte.js';
	import { crossHostUrl, onAppHost } from '$lib/tabula/host.js';

	let { children } = $props();

	// Website (www) und App (app.*) sind getrennte Adressen: Links über die Grenze laden die Seite
	// auf der anderen Adresse (src/lib/tabula/host.ts). Auf www nimmt app.html dabei den Fortschritt mit.
	beforeNavigate((nav) => {
		if (!nav.to || nav.type === 'leave') return;
		const target = crossHostUrl(nav.to.url);
		if (!target) return;
		nav.cancel();
		location.assign(target);
	});

	// App-Startseite app.tabulasql.de/: angemeldet direkt in den eigenen Bereich, sonst Anmelden.
	const appHome = $derived(onAppHost() && page.url.pathname === '/' && !page.url.hash);
	$effect(() => {
		if (!appHome || session.loading) return;
		const u = session.user;
		const to = !u ? '/login' : u.role === 'teacher' ? (session.needsKeyRecovery ? '/profil?schluessel=1' : '/teach') : '/learn';
		goto(to, { replaceState: true });
	});

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
		page.url.pathname === '/nutzungsbedingungen' ||
		page.url.pathname === '/impressum' ||
		page.url.pathname === '/kontakt' ||
		// Fehlerseite bringt eigene TopNav mit
		page.error != null
	);

	onMount(() => {
		initSession();
	});
</script>

{#if appHome}
	<!-- App-Startseite: leitet sofort weiter (siehe oben) -->
{:else if bare}
	{@render children()}
{:else}
	<div class="min-h-screen text-ink-900 bg-ink-0">
		<Navbar onOpenLogin={() => (loginOpen = true)} />
		{@render children()}
		<Footer />
		<LoginModal open={loginOpen} onClose={() => (loginOpen = false)} />
	</div>
{/if}
