<script lang="ts">
	let {
		size = 14,
		class: className = ''
	}: { size?: number; class?: string } = $props();

	const glyphSize = size * 1.25;
</script>

<span
	class={'inline-flex items-center gap-2 font-mono font-semibold tracking-tight ' + className}
	style="font-size: {size}px"
>
	<svg
		aria-hidden="true"
		width={glyphSize}
		height={glyphSize}
		viewBox="0 0 64 64"
		class="shrink-0"
	>
		<rect x="0" y="0" width="64" height="64" rx="13" fill="oklch(0.62 0.13 195)" />
		<g fill="#ffffff">
			<rect x="11" y="14" width="12" height="6" rx="1.6" />
			<rect x="26" y="14" width="12" height="6" rx="1.6" />
			<rect x="41" y="14" width="12" height="6" rx="1.6" />
			<rect x="11" y="29" width="12" height="6" rx="1.6" />
			<rect x="26" y="29" width="12" height="6" rx="1.6" />
			<rect x="41" y="29" width="12" height="6" rx="1.6" />
			<rect x="11" y="44" width="12" height="6" rx="1.6" />
			<rect x="26" y="44" width="12" height="6" rx="1.6" />
			<rect x="41" y="44" width="12" height="6" rx="1.6" />
		</g>
	</svg>
	<span>SbSQLTT</span>
</span>
