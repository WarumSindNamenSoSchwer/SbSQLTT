<script lang="ts">
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let theme = $state<'light' | 'dark'>('dark');

	$effect(() => {
		// On mount, sync with the html class set by the pre-paint script in app.html.
		theme = document.documentElement.classList.contains('light') ? 'light' : 'dark';
	});

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.classList.toggle('light', theme === 'light');
		document.documentElement.classList.toggle('dark', theme === 'dark');
		try {
			localStorage.setItem('sbsqltt-theme', theme);
		} catch {
			// ignore (private mode etc)
		}
	}
</script>

<Button variant="ghost" size="sm" onclick={toggle} class="!px-2" aria-label="Toggle theme">
	{#if theme === 'dark'}
		<Icon name="sun" />
	{:else}
		<Icon name="moon" />
	{/if}
</Button>
