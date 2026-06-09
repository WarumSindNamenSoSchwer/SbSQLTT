<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import ConsentBanner from '$lib/components/ConsentBanner.svelte';

	let { children } = $props();

	let loginOpen = $state(false);
</script>

<div class="min-h-screen text-ink-900 bg-ink-0">
	<Navbar onOpenLogin={() => (loginOpen = true)} />
	{@render children()}
	<LoginModal open={loginOpen} onClose={() => (loginOpen = false)} />
	<ConsentBanner />
</div>
