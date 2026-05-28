<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = '',
		style = ''
	}: { children?: Snippet; class?: string; style?: string } = $props();
</script>

<div class={'bg-ink-50 border border-ink-200 rounded-lg ' + className} {style}>
	{#if children}{@render children()}{/if}
</div>
