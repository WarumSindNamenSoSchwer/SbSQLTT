<script lang="ts">
	import G from './owl-gen.js';

	type Mode = 'static' | 'once' | 'loop';
	let {
		pose,
		mode = 'static',
		dark = false,
		class: cls = '',
		style = ''
	}: { pose: string; mode?: Mode; dark?: boolean; class?: string; style?: string } = $props();

	let reduce = $state(false);
	let replay = $state(0);
	$effect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduce = mq.matches;
	});

	let svg = $derived.by(() => {
		void replay;
		const opt = dark ? G.DARK : {};
		let m: Mode = mode;
		if (reduce || !G.ANIMS[pose]) m = 'static';
		let s: string;
		if (m === 'static') s = pose === 'sleep' ? G.sleep(opt) : G.owl({ ...(G.STATES[pose] ?? G.STATES.idle), ...opt });
		else s = G.animSvg(pose, opt);
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
