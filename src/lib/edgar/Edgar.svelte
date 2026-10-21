<script lang="ts">
	import G from './owl-gen.js';

	type Mode = 'static' | 'once' | 'loop';
	// Edgar ist überall animiert (Wunsch Muri, 21.10.2026). Statisch nur bei
	// „Bewegung reduzieren“ im System oder ausdrücklich mode="static".
	let {
		pose,
		mode = 'loop',
		dark = false,
		class: cls = '',
		style = ''
	}: { pose: string; mode?: Mode; dark?: boolean; class?: string; style?: string } = $props();

	// Posen ohne eigene Animation auf die passende animierte Pose abbilden
	const ANIM_ALIAS: Record<string, string> = { laptop: 'typing' };

	let reduce = $state(false);
	let replay = $state(0);
	$effect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduce = mq.matches;
		const on = (e: MediaQueryListEvent) => (reduce = e.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	let svg = $derived.by(() => {
		void replay;
		const opt = dark ? G.DARK : {};
		let m: Mode = mode;
		const animKey = G.ANIMS[pose] ? pose : ANIM_ALIAS[pose];
		if (reduce || !animKey) m = 'static';
		let s: string;
		if (m === 'static') s = pose === 'sleep' ? G.sleep(opt) : G.owl({ ...(G.STATES[pose] ?? G.STATES.idle), ...opt });
		else s = G.animSvg(animKey, opt);
		if (m === 'once') s = s.replace(/ infinite/g, ' 2');
		return s.replace('<svg ', '<svg aria-hidden="true" focusable="false" width="100%" height="100%" ');
	});
</script>

<span class="edgar block {cls}" {style}>{@html svg}</span>

<style>
	.edgar :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
