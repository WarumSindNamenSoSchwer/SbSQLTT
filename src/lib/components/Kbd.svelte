<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = ''
	}: { children?: Snippet; class?: string } = $props();
</script>

<span
	class={'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 ' +
		'rounded-[4px] font-mono text-[10px] leading-none ' +
		'bg-ink-200 text-ink-800 border border-ink-300 ' +
		className}
>
	{#if children}{@render children()}{/if}
</span>
