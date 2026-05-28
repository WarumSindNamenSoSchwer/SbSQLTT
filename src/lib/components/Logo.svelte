<script lang="ts">
	let {
		size = 14,
		class: className = ''
	}: { size?: number; class?: string } = $props();
</script>

<span
	class={'inline-flex items-center gap-2 font-mono font-semibold tracking-tight ' + className}
	style="font-size: {size}px"
>
	<span
		aria-hidden="true"
		class="inline-block"
		style="width: {size * 0.95}px; height: {size * 0.95}px; border-radius: 4px; background: oklch(0.72 0.15 195); box-shadow: 0 0 0 2px oklch(0.72 0.15 195 / 0.18);"
	></span>
	<span>SbSQLTT</span>
</span>
