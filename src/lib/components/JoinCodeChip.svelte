<script lang="ts">
	let { code, size = 'md' }: { code: string; size?: 'sm' | 'md' | 'lg' } = $props();

	let copied = $state(false);

	const sizes: Record<'sm' | 'md' | 'lg', string> = {
		sm: 'h-6 px-2 text-[11px]',
		md: 'h-7 px-2.5 text-[12px]',
		lg: 'h-8 px-3 text-[13px]'
	};

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => (copied = false), 1400);
		} catch {
			// ignore
		}
	}
</script>

<button
	onclick={onCopy}
	class={'inline-flex items-center gap-1.5 rounded-md font-mono ' +
		'bg-ink-100 hover:bg-ink-200 border border-ink-200 text-ink-900 transition-colors ' +
		sizes[size]}
	title="Beitritts-Code kopieren"
>
	<span>{code}</span>
	<span class="text-ink-600 text-[10px]">
		{copied ? '✓ kopiert' : '⧉'}
	</span>
</button>
