<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Weiterleitung auf Abschnitt #lehrkraefte der Startseite.
	// Clientseitig via goto, da adapter-static keine serverseitigen Redirects ausliefert.
	onMount(() => {
		goto('/#lehrkraefte', { replaceState: true });
	});
</script>
