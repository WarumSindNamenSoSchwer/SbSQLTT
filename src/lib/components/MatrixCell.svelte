<script lang="ts">
	import type { CellState } from '$lib/teacher-data';

	let {
		state,
		percent = 0,
		stuck = false,
		size = 18,
		current = false,
		title
	}: {
		state: CellState;
		percent?: number;
		stuck?: boolean;
		size?: number;
		current?: boolean;
		title?: string;
	} = $props();

	let r = $derived(size / 2);
	let radius = $derived(r - 1.2);
	let stroke = $derived(state === 'todo' ? 1.4 : 1);

	let arcPath = $derived.by(() => {
		if (state !== 'progress') return '';
		const pct = Math.max(0, Math.min(1, percent));
		if (pct <= 0) return '';
		const cx = r;
		const cy = r;
		const angle = pct * Math.PI * 2 - Math.PI / 2;
		const x = cx + radius * Math.cos(angle);
		const y = cy + radius * Math.sin(angle);
		const large = pct > 0.5 ? 1 : 0;
		return `M ${cx} ${cy} L ${cx} ${cy - radius} A ${radius} ${radius} 0 ${large} 1 ${x} ${y} Z`;
	});
</script>

<span
	{title}
	class={'relative inline-grid place-items-center align-middle ' +
		(current ? 'rounded-md ring-1 ring-[oklch(0.72_0.15_195_/_0.4)] bg-accent-soft' : '')}
	style="width: {size + 6}px; height: {size + 6}px"
>
	<svg width={size} height={size} viewBox="0 0 {size} {size}" class="block">
		<circle
			cx={r}
			cy={r}
			r={radius}
			fill={state === 'done' ? 'oklch(0.62 0.13 195)' : 'transparent'}
			stroke={state === 'todo' ? 'rgb(var(--ink-300))' : 'oklch(0.62 0.13 195 / 0.35)'}
			stroke-width={stroke}
		/>
		{#if state === 'progress' && arcPath}
			<path d={arcPath} fill="oklch(0.62 0.13 195)" opacity="0.85" />
		{/if}
		{#if state === 'done'}
			<path
				d={`M ${size * 0.28} ${size * 0.52} L ${size * 0.45} ${size * 0.68} L ${size * 0.72} ${size * 0.36}`}
				fill="none"
				stroke="white"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{/if}
	</svg>
	{#if stuck}
		<span
			aria-label="hängt fest"
			class="absolute"
			style="top: 1px; right: 1px; width: 6px; height: 6px; border-radius: 999px; background: oklch(0.62 0.16 70); box-shadow: 0 0 0 1.5px rgb(var(--ink-0));"
		></span>
	{/if}
</span>
