<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<span
	class={'ml-2 px-2 h-5 inline-flex items-center rounded border border-ink-300 ' +
		'text-[11px] font-mono uppercase tracking-[0.14em] text-ink-700 ' +
		className}
>
	Lehrer
</span>
