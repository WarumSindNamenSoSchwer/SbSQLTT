<script lang="ts">
	import { highlightSQL } from '$lib/data';

	let {
		value,
		onChange,
		onRun,
		dirty = false,
		class: className = ''
	}: {
		value: string;
		onChange: (v: string) => void;
		onRun?: () => void;
		dirty?: boolean;
		class?: string;
	} = $props();

	let taRef = $state<HTMLTextAreaElement>();
	let preRef = $state<HTMLPreElement>();
	let gutterRef = $state<HTMLDivElement>();

	let tokens = $derived(highlightSQL(value + '\n'));
	let lineCount = $derived(value.split('\n').length);

	function onScroll() {
		if (preRef && taRef) {
			preRef.scrollTop = taRef.scrollTop;
			preRef.scrollLeft = taRef.scrollLeft;
		}
		if (gutterRef && taRef) {
			gutterRef.scrollTop = taRef.scrollTop;
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			onRun?.();
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			const ta = taRef;
			if (!ta) return;
			const s = ta.selectionStart;
			const en = ta.selectionEnd;
			const v = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
			onChange(v);
			requestAnimationFrame(() => {
				if (ta) ta.selectionStart = ta.selectionEnd = s + 2;
			});
		}
	}
</script>

<div class={'relative flex flex-col h-full ' + className}>
	<!-- editor chrome -->
	<div
		class="flex items-center justify-between px-3 h-9 border-b border-ink-200 bg-ink-50/60 rounded-t-lg"
	>
		<div class="flex items-center gap-2 text-[11px] font-mono text-ink-700">
			<span class="dot" style="background:#3a3a47"></span>
			<span>query.sql</span>
			{#if dirty}<span class="text-accent">●</span>{/if}
		</div>
		<div class="flex items-center gap-2 text-[11px] text-ink-700">
			<span>postgres 16</span>
			<span class="text-ink-500">·</span>
			<span>schema: <span class="font-mono">library</span></span>
		</div>
	</div>

	<!-- editor body -->
	<div
		class="relative flex-1 grid grid-cols-[44px_1fr] font-mono text-[13px] leading-[20px] min-h-0"
	>
		<!-- gutter -->
		<div
			bind:this={gutterRef}
			aria-hidden="true"
			class="overflow-hidden text-right pr-2 py-3 text-ink-600 select-none border-r border-ink-200 bg-ink-50/40"
		>
			{#each Array.from({ length: lineCount }, (_, i) => i) as i (i)}
				<div class="tabular-num">{i + 1}</div>
			{/each}
		</div>

		<!-- highlight overlay + textarea -->
		<div class="relative">
			<pre
				bind:this={preRef}
				aria-hidden="true"
				class="absolute inset-0 m-0 py-3 px-3 overflow-auto whitespace-pre pointer-events-none"
				style="tab-size: 2">{#each tokens as t, i (i)}<span class={t.cls}>{t.text}</span>{/each}</pre>
			<textarea
				bind:this={taRef}
				{value}
				oninput={(e) => onChange((e.currentTarget as HTMLTextAreaElement).value)}
				onscroll={onScroll}
				onkeydown={onKeyDown}
				spellcheck="false"
				class="absolute inset-0 w-full h-full m-0 py-3 px-3 bg-transparent
                       text-transparent caret-accent resize-none outline-none
                       whitespace-pre overflow-auto"
				style="tab-size: 2; caret-color: oklch(0.72 0.15 195)"
			></textarea>
		</div>
	</div>
</div>
