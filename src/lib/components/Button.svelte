<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'link';
	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		variant?: Variant;
		size?: Size;
		class?: string;
		leading?: Snippet;
		trailing?: Snippet;
		children?: Snippet;
	} & Omit<HTMLButtonAttributes, 'class' | 'size'>;

	let {
		variant = 'secondary',
		size = 'md',
		class: className = '',
		leading,
		trailing,
		children,
		type = 'button',
		...rest
	}: Props = $props();

	const sizeClasses: Record<Size, string> = {
		sm: 'h-7 px-2.5 text-[12px] gap-1.5',
		md: 'h-8 px-3 text-[13px] gap-2',
		lg: 'h-10 px-4 text-[14px] gap-2'
	};

	const variantClasses: Record<Variant, string> = {
		primary:
			'bg-accent text-[oklch(0.16_0.04_195)] hover:brightness-110 active:brightness-95 ' +
			'shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(0,0,0,0.4)] font-medium',
		secondary:
			'bg-ink-200/80 hover:bg-ink-300 text-ink-900 border border-ink-300 ' +
			'shadow-soft',
		ghost: 'bg-transparent text-ink-800 hover:text-ink-900 hover:bg-ink-200/60',
		link: 'bg-transparent text-ink-800 hover:text-ink-900 px-0'
	};
</script>

<button
	{type}
	class={'inline-flex items-center justify-center rounded-md ring-accent transition-colors whitespace-nowrap ' +
		sizeClasses[size] +
		' ' +
		variantClasses[variant] +
		' ' +
		className}
	{...rest}
>
	{#if leading}{@render leading()}{/if}
	{#if children}{@render children()}{/if}
	{#if trailing}{@render trailing()}{/if}
</button>
