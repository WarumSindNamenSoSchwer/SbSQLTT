<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
</script>

<div class="min-h-[calc(100vh-3.5rem)] grid place-items-center px-6">
	<div class="text-center max-w-[480px]">
		<div class="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">404</div>
		<h1
			class="mt-3 text-[40px] md:text-[48px] leading-[1.05] tracking-[-0.02em] font-semibold"
		>
			Seite nicht gefunden.
		</h1>
		<p class="mt-4 text-[15px] text-ink-700 leading-relaxed">
			Die aufgerufene URL passt zu keiner Lektion und zu keinem Track. Entweder ist der
			Link falsch, oder wir haben etwas verschoben und vergessen, umzuleiten.
		</p>

		<!-- deliberately small, mono "stack trace" feel -->
		<pre
			class="mt-7 mx-auto inline-block text-left p-3.5 rounded-md bg-ink-100/40 border border-ink-200 font-mono text-[12px] leading-[20px] text-ink-700"><span
				class="tok-com">{`-- versuchte Route\n`}</span><span class="tok-kw">SELECT</span><span
				class="tok-pun">{' * '}</span><span class="tok-kw">FROM</span><span
				class="tok-pun">{' '}</span><span class="tok-id">pages</span>{`\n`}<span
				class="tok-kw">WHERE</span><span class="tok-pun">{'  '}</span><span class="tok-id"
				>path</span><span class="tok-pun">{' = '}</span><span class="tok-str"
				>{`'/die-gesuchte-seite'`}</span><span class="tok-pun">;</span>{`\n`}<span
				class="tok-com">{`-- 0 Zeilen`}</span></pre>

		<div class="mt-7 flex items-center justify-center gap-3">
			<Button variant="primary" size="md" onclick={() => goto('/')}>Zur Startseite</Button>
			<Button variant="ghost" size="md" onclick={() => goto('/learn')}>
				Lektionen durchsuchen
			</Button>
		</div>
	</div>
</div>
