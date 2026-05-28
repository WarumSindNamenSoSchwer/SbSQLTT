<script lang="ts">
	let {
		data,
		width = 64,
		height = 18,
		accent = true
	}: { data: number[]; width?: number; height?: number; accent?: boolean } = $props();

	let max = $derived(Math.max(...data, 1));
	let min = $derived(Math.min(...data, 0));
	let range = $derived(Math.max(1, max - min));
	let xs = $derived((i: number) => (i / (data.length - 1)) * width);
	let ys = $derived((v: number) => height - ((v - min) / range) * (height - 2) - 1);
	let points = $derived(
		data.map((v, i) => `${xs(i).toFixed(2)},${ys(v).toFixed(2)}`).join(' ')
	);
	let area = $derived.by(() => {
		const segs = points.split(' ').map((p) => p.split(','));
		return (
			`M 0 ${height} L ` +
			segs.map(([x, y]) => `${x} ${y}`).join(' L ') +
			` L ${width} ${height} Z`
		);
	});
	let stroke = $derived(accent ? 'oklch(0.62 0.13 195)' : 'rgb(var(--ink-700))');
</script>

{#if data && data.length}
	<svg {width} {height} class="block">
		<path d={area} fill={stroke} opacity="0.10" />
		<polyline
			{points}
			fill="none"
			{stroke}
			stroke-width="1.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<circle cx={xs(data.length - 1)} cy={ys(data[data.length - 1])} r="1.8" fill={stroke} />
	</svg>
{/if}
