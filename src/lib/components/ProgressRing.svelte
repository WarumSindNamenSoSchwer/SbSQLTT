<script lang="ts">
	let {
		value = 0,
		size = 28,
		stroke = 3,
		class: className = ''
	}: { value?: number; size?: number; stroke?: number; class?: string } = $props();

	let r = $derived((size - stroke) / 2);
	let c = $derived(2 * Math.PI * r);
	let dash = $derived(c * Math.min(Math.max(value, 0), 1));
</script>

<svg width={size} height={size} class={className}>
	<circle class="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke} />
	<circle
		class="ring-fill"
		cx={size / 2}
		cy={size / 2}
		r={r}
		fill="none"
		stroke-width={stroke}
		stroke-linecap="round"
		stroke-dasharray="{dash} {c - dash}"
		transform="rotate(-90 {size / 2} {size / 2})"
	/>
</svg>
