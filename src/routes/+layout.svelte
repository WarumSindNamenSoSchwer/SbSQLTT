<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';

	let { children } = $props();

	let loginOpen = $state(false);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen text-ink-900 bg-ink-0">
	<Navbar onOpenLogin={() => (loginOpen = true)} />
	{@render children()}
	<LoginModal open={loginOpen} onClose={() => (loginOpen = false)} />
</div>
