<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Weiterleitung auf /learn (SQL-Referenz wurde zu den Lektionen zusammengefasst).
	// Clientseitig via goto, da adapter-static keine serverseitigen Redirects ausliefert.
	onMount(() => {
		goto('/learn', { replaceState: true });
	});
</script>
