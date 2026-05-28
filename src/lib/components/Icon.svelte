<script lang="ts" module>
	export type IconName =
		| 'arrow'
		| 'play'
		| 'check'
		| 'github'
		| 'close'
		| 'cmd'
		| 'enter'
		| 'mail'
		| 'spark'
		| 'layers'
		| 'db'
		| 'book'
		| 'search'
		| 'sun'
		| 'moon'
		| 'external';

	// path data copied verbatim from primitives.jsx
	export const ICON_PATHS: Record<IconName, string> = {
		arrow: 'M5 12h14M13 6l6 6-6 6',
		play: 'M7 5l12 7-12 7V5z',
		check: 'M5 12.5l4.5 4.5L19 7',
		github:
			'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.04 1.53 1.04.89 1.53 2.35 1.09 2.93.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.84c.85 0 1.7.11 2.5.33 1.9-1.29 2.74-1.02 2.74-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2z',
		close: 'M6 6l12 12M18 6L6 18',
		cmd: 'M8 4a3 3 0 1 0 0 6h8a3 3 0 1 0 0-6 3 3 0 0 0-3 3v10a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H8a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z',
		enter: 'M9 10l-4 4 4 4M5 14h11a4 4 0 0 0 4-4V6',
		mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
		spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
		layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
		db: 'M4 5c0-1.5 3.6-3 8-3s8 1.5 8 3v14c0 1.5-3.6 3-8 3s-8-1.5-8-3V5zM4 5c0 1.5 3.6 3 8 3s8-1.5 8-3M4 12c0 1.5 3.6 3 8 3s8-1.5 8-3',
		book: 'M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2V5zM17 3v18',
		search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
		sun: 'M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3 5 5M19 19l-1.3-1.3M6.3 17.7 5 19M19 5l-1.3 1.3M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z',
		moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
		external: 'M14 5h5v5M19 5l-9 9M5 19h7M5 19v-7'
	};

	// icons where the prototype draws them filled rather than stroked
	const FILLED_ICONS: Partial<Record<IconName, true>> = {
		play: true,
		github: true
	};
</script>

<script lang="ts">
	let {
		name,
		size = 14,
		sw,
		class: className = ''
	}: { name: IconName; size?: number; sw?: number; class?: string } = $props();

	let filled = $derived(!!FILLED_ICONS[name]);
	let strokeWidth = $derived(sw ?? (name === 'github' ? 0 : 1.6));
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? 'currentColor' : 'none'}
	stroke={filled ? 'none' : 'currentColor'}
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
>
	<path d={ICON_PATHS[name]} />
</svg>
