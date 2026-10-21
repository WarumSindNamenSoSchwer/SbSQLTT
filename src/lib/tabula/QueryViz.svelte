<script lang="ts">
	// Zeigt, was eine Abfrage mit den Quelltabellen macht (Stil wie die JOIN-Vorschau der Startseite).
	import { tick } from 'svelte';
	import type { Viz } from './explain';

	let { viz }: { viz: Viz } = $props();

	let wrap = $state<HTMLDivElement>();
	let paths = $state<string[]>([]);
	const GROUP_TINT = ['#3b82f6', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2'];

	async function draw() {
		await tick();
		if (!wrap || viz.tables.length < 2) return (paths = []);
		const box = wrap.getBoundingClientRect();
		const out: string[] = [];
		for (const [a, b] of viz.links) {
			const l = wrap.querySelector<HTMLElement>(`[data-t="0"][data-rid="${a}"]`);
			const r = wrap.querySelector<HTMLElement>(`[data-t="1"][data-rid="${b}"]`);
			if (!l || !r) continue;
			const lb = l.getBoundingClientRect(), rb = r.getBoundingClientRect();
			// Von der rechten Kante der Schluesselzelle links zur linken Kante rechts; Karten liegen nebeneinander
			const lc = l.closest('.tcard')!.getBoundingClientRect(), rc = r.closest('.tcard')!.getBoundingClientRect();
			const x1 = lc.right - box.left + wrap.scrollLeft, y1 = lb.top + lb.height / 2 - box.top + wrap.scrollTop;
			const x2 = rc.left - box.left + wrap.scrollLeft, y2 = rb.top + rb.height / 2 - box.top + wrap.scrollTop;
			const mx = (x1 + x2) / 2;
			out.push(`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
		}
		paths = out;
	}
	$effect(() => {
		void viz;
		draw();
		const ro = new ResizeObserver(() => draw());
		if (wrap) ro.observe(wrap);
		return () => ro.disconnect();
	});
	const fmt = (v: unknown) => (v === null ? 'NULL' : String(v));
</script>

<div class="viz" bind:this={wrap}>
	<div class="tables" class:two={viz.tables.length === 2}>
		{#each viz.tables as t, ti}
			<div class="tcard">
				<div class="thead mono"><span class="ticon">▦</span>{t.name}{#if t.alias !== t.name}<span class="alias">{t.alias}</span>{/if}</div>
				<div class="grid" style="grid-template-columns: {viz.ordered && viz.aggregate === 'none' ? '28px ' : ''}{t.cols.map(() => 'minmax(0,auto)').join(' ')}">
					{#if viz.ordered && viz.aggregate === 'none'}<span class="ch mono"></span>{/if}
					{#each t.cols as c}<span class="ch mono" class:sel={c.sel} class:cond={c.cond}>{c.name}</span>{/each}
					{#each t.rows as r}
						{#if viz.ordered && viz.aggregate === 'none'}<span class="rank mono" class:on={r.rank}>{r.rank ?? ''}</span>{/if}
						{#each r.cells as v, ci}
							{@const isKey = viz.keys[ti] !== null && t.cols[ci].name.toLowerCase() === viz.keys[ti]?.toLowerCase()}
							<span
								class="cell mono"
								class:out={!r.kept}
								class:sel={t.cols[ci].sel && r.kept}
								class:cond={t.cols[ci].cond}
								class:key={isKey && r.kept}
								data-t={isKey ? ti : undefined}
								data-rid={isKey ? r.rid : undefined}
								style={ci === 0 && r.group !== undefined && r.group >= 0 && r.kept ? `box-shadow: inset 4px 0 ${GROUP_TINT[r.group % GROUP_TINT.length]}` : ''}
							>{fmt(v)}</span>
						{/each}
					{/each}
				</div>
			</div>
		{/each}
	</div>
	<svg class="wires" aria-hidden="true">
		{#each paths as d}<path {d} />{/each}
	</svg>
	<div class="legend">
		{#if viz.aggregate === 'groups'}
			{#each Array(viz.groups) as _, g}<span class="lg"><span class="sw" style="background:{GROUP_TINT[g % GROUP_TINT.length]};border-color:transparent"></span>Gruppe {g + 1}</span>{/each}
		{/if}
		<span class="lg"><span class="sw keep"></span>kommt ins Ergebnis</span>
		<span class="lg"><span class="sw drop"></span>fällt heraus</span>
		<span class="lg"><span class="sw sel"></span>gewählte Spalte</span>
		<span class="lg"><span class="sw cond"></span>in Bedingung</span>
	</div>
	<p class="note">{viz.note}</p>
</div>

<style>
	.viz { position: relative; flex: 1; min-height: 0; overflow: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
	.tables { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; position: relative; z-index: 1; }
	.tables.two { grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr); gap: 56px; }
	.tcard { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; align-self: start; }
	.thead { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 500; }
	.ticon { color: var(--accent); }
	.alias { font-size: 11px; padding: 0 6px; border-radius: 4px; background: var(--subtle); color: var(--ink-3); }
	.grid { display: grid; font-size: 12.5px; }
	.ch { padding: 6px 10px; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); background: var(--subtle); border-bottom: 1px solid var(--line); white-space: nowrap; }
	.ch.sel { color: var(--accent-ink); background: var(--accent-soft); }
	.ch.cond { text-decoration: underline; text-decoration-color: #d97706; text-decoration-thickness: 2px; text-underline-offset: 3px; }
	.cell { padding: 6px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity 0.25s, background 0.25s; }
	.cell.sel { background: var(--accent-soft); color: var(--ink); }
	.cell.cond:not(.out) { color: #b45309; font-weight: 500; }
	:global(html:not(.light)) .cell.cond:not(.out) { color: #fbbf24; }
	.cell.out { opacity: 0.38; text-decoration: line-through; text-decoration-color: var(--ink-3); }
	.cell.key { color: var(--accent-ink); font-weight: 600; }
	.rank { padding: 6px 0; text-align: center; border-bottom: 1px solid var(--line); font-size: 11px; color: transparent; }
	.rank.on { color: #fff; background: var(--accent); font-weight: 500; }
	.wires { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; overflow: visible; }
	.wires path { fill: none; stroke: var(--accent); stroke-width: 1.6; opacity: 0.85; }
	.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--ink-3); }
	.lg { display: inline-flex; align-items: center; gap: 6px; }
	.sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--line-strong); }
	.sw.keep { background: var(--surface); }
	.sw.drop { background: var(--subtle); opacity: 0.6; background-image: linear-gradient(to bottom right, transparent 45%, var(--ink-3) 47%, transparent 52%); }
	.sw.sel { background: var(--accent-soft); border-color: var(--accent-line); }
	.sw.cond { background: none; border: 0; border-bottom: 2px solid #d97706; border-radius: 0; height: 8px; }
	.note { margin: 0; font-size: 14px; line-height: 20px; color: var(--ink-2); }
	@media (max-width: 767px) {
		.viz { padding: 10px 12px; }
		.tables.two { grid-template-columns: minmax(0, 1fr); gap: 12px; }
		.wires { display: none; }
		.grid { font-size: 12px; }
	}
</style>
