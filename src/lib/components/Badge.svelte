<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'accent' | 'success';

	let {
		children,
		tone = 'neutral',
		class: className = ''
	}: { children?: Snippet; tone?: Tone; class?: string } = $props();

	const tones: Record<Tone, string> = {
		neutral: 'bg-ink-200 text-ink-800 border-ink-300',
		accent: 'bg-accent-soft text-accent border-[oklch(0.72_0.15_195_/_0.3)]',
		success: 'bg-[oklch(0.72_0.13_150_/_0.15)] text-ok border-[oklch(0.72_0.13_150_/_0.35)]'
	};
</script>

<span
	class={'inline-flex items-center gap-1 px-2 h-5 rounded-full text-[11px] font-medium ' +
		'border ' +
		tones[tone] +
		' ' +
		className}
>
	{#if children}{@render children()}{/if}
</span>
