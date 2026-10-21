<script lang="ts">
	import { page } from '$app/state';
	let { children } = $props();
</script>

<!-- Beim Wechsel der Lektion die Seite komplett neu aufbauen (sonst bleibt Schritt/„geschafft“ stehen) -->
{#key page.params.lesson}
	{@render children()}
{/key}
