<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = ''
	}: { children?: Snippet; class?: string } = $props();
</script>

<div class={'bg-ink-50 border border-ink-200 rounded-lg ' + className}>
	{#if children}{@render children()}{/if}
</div>
