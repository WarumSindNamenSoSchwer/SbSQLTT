<script lang="ts">
	import { tok } from './highlight';
	// Code-Editor nach Design B2: dunkle Flaeche, Zeilennummern, Fehlerzeile rot.
	let {
		value = $bindable(''),
		errLine = null,
		minLines = 8,
		readonly = false,
		onrun,
		size = 'md'
	}: {
		value?: string;
		errLine?: number | null;
		minLines?: number;
		readonly?: boolean;
		onrun?: () => void;
		size?: 'md' | 'sm';
	} = $props();

	let ta = $state<HTMLTextAreaElement>();
	let scroller = $state<HTMLDivElement>();


	let lines = $derived.by(() => {
		const ls = value.split('\n');
		const n = Math.max(minLines, ls.length);
		return Array.from({ length: n }, (_, i) => ({ n: i + 1, toks: tok(ls[i] ?? ''), err: errLine === i + 1 }));
	});

	export function insert(text: string) {
		if (!ta || readonly) return;
		const s = ta.selectionStart, e = ta.selectionEnd;
		const before = value.slice(0, s);
		const pad = before && !/[\s(,]$/.test(before) ? ' ' : '';
		value = before + pad + text + value.slice(e);
		const pos = s + pad.length + text.length;
		requestAnimationFrame(() => {
			ta?.focus();
			ta?.setSelectionRange(pos, pos);
		});
	}
	export function focus() {
		ta?.focus();
	}

	function onkeydown(ev: KeyboardEvent) {
		if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
			ev.preventDefault();
			onrun?.();
		} else if (ev.key === 'Tab' && !ev.shiftKey) {
			ev.preventDefault();
			insertRaw('  ');
		}
	}
	function insertRaw(t: string) {
		if (!ta) return;
		const s = ta.selectionStart, e = ta.selectionEnd;
		value = value.slice(0, s) + t + value.slice(e);
		requestAnimationFrame(() => ta?.setSelectionRange(s + t.length, s + t.length));
	}
</script>

<div class="ed {size}" bind:this={scroller}>
	<div class="inner">
		{#each lines as ln (ln.n)}
			<div class="ln" class:err={ln.err}>
				<span class="no">{ln.n}</span><span class="code">{#each ln.toks as t}<span style="color:{t.c}">{t.t}</span>{/each}{' '}</span>
			</div>
		{/each}
		<textarea
			bind:this={ta}
			bind:value
			{readonly}
			{onkeydown}
			spellcheck="false"
			autocapitalize="off"
			autocomplete="off"
			aria-label="SQL-Abfrage"
		></textarea>
	</div>
</div>

<style>
	.ed {
		box-sizing: border-box;
		height: 100%;
		overflow: auto;
		padding: 10px 0;
		font-family: var(--mono);
		font-size: 14px;
		line-height: 24px;
		--gut: 44px;
		--gp: 14px;
	}
	.ed.sm {
		font-size: 13px;
		line-height: 22px;
		padding: 8px 0;
		--gut: 32px;
		--gp: 10px;
	}
	.inner {
		position: relative;
		min-width: max-content;
	}
	.ln {
		display: flex;
	}
	.no {
		width: var(--gut);
		flex: none;
		text-align: right;
		padding-right: var(--gp);
		color: #475569;
		user-select: none;
	}
	.code {
		white-space: pre;
		padding-right: 16px;
	}
	.ln.err {
		background: rgb(248 113 113 / 0.14);
		box-shadow: inset 3px 0 #f87171;
	}
	.ln.err .no {
		color: #f87171;
	}
	.ln.err .code {
		text-decoration: underline wavy #f87171;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
	}
	textarea {
		box-sizing: border-box;
		position: absolute;
		inset: 0 0 0 calc(var(--gut) + var(--gp));
		width: calc(100% - var(--gut) - var(--gp));
		height: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		outline: none;
		resize: none;
		overflow: hidden;
		background: transparent;
		color: transparent;
		caret-color: #e2e8f0;
		font: inherit;
		line-height: inherit;
		white-space: pre;
		tab-size: 2;
	}
	textarea::selection {
		background: rgb(96 165 250 / 0.35);
	}
	textarea:focus-visible {
		outline: none;
	}
</style>
