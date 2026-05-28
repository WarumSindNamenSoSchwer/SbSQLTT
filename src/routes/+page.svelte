<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Surface from '$lib/components/Surface.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const features = [
		{
			icon: 'db' as const,
			title: 'Interactive Postgres in your browser',
			body: 'Every query runs against a real Postgres-compatible engine compiled to WebAssembly. No accounts, no servers — your laptop is the database.'
		},
		{
			icon: 'layers' as const,
			title: 'Lesson tracks: Beginner → Advanced',
			body: 'A deliberate progression from SELECT and WHERE through joins, subqueries, and window functions. Each step is a small, focused exercise.'
		},
		{
			icon: 'spark' as const,
			title: 'Bring your own schema',
			body: 'Paste a CREATE TABLE script or upload a .sql dump and explore your own data with the same editor and result panel.'
		}
	];

	const quickFacts: [string, string][] = [
		['License', 'AGPL-3.0'],
		['Hosting', 'self-hostable or hosted free'],
		['Account required', 'no'],
		['Languages', 'English · Deutsch'],
		['Backend', 'postgres-wasm in browser'],
		['Source', 'github.com/muri/sbsqltt']
	];

	const stepLabels = [
		'Why filter?',
		'Anatomy of WHERE',
		'Combining conditions',
		'Try it: books after 2010',
		'Recap'
	];

	const previewRows: [number, string, number][] = [
		[1, 'Designing Data-Intensive Apps', 2017],
		[2, 'Refactoring', 2018],
		[3, 'Seven Databases in Seven Weeks', 2018],
		[4, 'Database Internals', 2019]
	];

	function openLesson() {
		goto('/learn/beginner/where-filters');
	}
</script>

<div>
	<!-- HERO -->
	<section class="relative">
		<div class="absolute inset-0 grid-bg pointer-events-none"></div>
		<div class="absolute inset-0 hero-glow pointer-events-none"></div>

		<div class="relative max-w-[1280px] mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
			<div class="max-w-[680px]">
				<Badge tone="accent" class="!h-6 !px-2.5">
					<span class="font-mono text-[10.5px] tracking-wide">v0.4 · public alpha</span>
				</Badge>

				<h1
					class="mt-5 text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.02em] font-semibold text-ink-900"
					style="text-wrap: balance"
				>
					Learn SQL by doing —
					<span class="text-ink-700">free, open source,</span>
					<br class="hidden md:block" /> no signup required.
				</h1>

				<p
					class="mt-5 text-[16px] md:text-[17px] leading-relaxed text-ink-700 max-w-[560px]"
					style="text-wrap: pretty"
				>
					A modern, focused way to practice SQL in your browser. Real Postgres, real
					datasets, and lessons that build from
					<span class="font-mono text-ink-800">SELECT</span> to window functions — at your
					own pace.
				</p>

				<div class="mt-7 flex items-center gap-3">
					<Button variant="primary" size="lg" onclick={openLesson}>
						{#snippet trailing()}<Icon name="arrow" size={14} />{/snippet}
						Try the first lesson
					</Button>
					<Button variant="ghost" size="lg" onclick={() => goto('/learn')}>
						Browse all tracks
					</Button>
				</div>

				<div
					class="mt-5 text-[12.5px] text-ink-600 flex items-center gap-4 font-mono"
				>
					<span class="inline-flex items-center gap-1.5">
						<Icon name="check" size={12} /> 100% open source
					</span>
					<span class="inline-flex items-center gap-1.5">
						<Icon name="check" size={12} /> Runs in your browser
					</span>
					<span class="inline-flex items-center gap-1.5">
						<Icon name="check" size={12} /> AGPL-3.0
					</span>
				</div>
			</div>

			<!-- inline editor screenshot -->
			<div class="mt-14 md:mt-20">
				<div
					role="button"
					tabindex="0"
					onclick={openLesson}
					onkeydown={(e) => {
						if (e.key === 'Enter') openLesson();
					}}
					class="group relative rounded-xl border border-ink-200 bg-ink-50 shadow-pop overflow-hidden cursor-pointer ring-accent"
				>
					<!-- window chrome -->
					<div
						class="h-9 px-4 flex items-center justify-between border-b border-ink-200 bg-ink-100/40"
					>
						<div class="flex items-center gap-1.5">
							<span class="dot" style="background:#3a3a47"></span>
							<span class="dot" style="background:#3a3a47"></span>
							<span class="dot" style="background:#3a3a47"></span>
						</div>
						<div class="font-mono text-[11px] text-ink-600">
							beginner / where-filters · step 4 of 5
						</div>
						<div class="font-mono text-[11px] text-ink-600">⌘↵ run</div>
					</div>
					<!-- body -->
					<div class="grid grid-cols-1 md:grid-cols-[1fr_1.6fr]">
						<!-- lesson side -->
						<div class="p-6 border-r border-ink-200 hidden md:block">
							<div
								class="text-[11px] font-mono uppercase tracking-[0.14em] text-accent"
							>
								Step 4 / 5
							</div>
							<div class="mt-2 text-[18px] font-semibold tracking-tight text-ink-900">
								Books published after 2010
							</div>
							<p class="mt-3 text-[13px] leading-relaxed text-ink-700">
								Filter the <span class="font-mono">books</span> table to only include
								rows whose
								<span class="font-mono">year</span> is strictly greater than 2010. Sort
								by year ascending.
							</p>
							<ol class="mt-5 space-y-2 text-[12.5px] text-ink-700">
								{#each stepLabels as s, i (i)}
									<li class="flex items-center gap-2">
										<span
											class={'w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-mono ' +
												(i < 3
													? 'bg-accent text-[oklch(0.16_0.04_195)]'
													: i === 3
														? 'bg-accent-soft text-accent border border-[oklch(0.72_0.15_195_/_0.4)]'
														: 'bg-ink-200 text-ink-700')}
										>
											{i < 3 ? '✓' : i + 1}
										</span>
										<span class={i === 3 ? 'text-ink-900' : ''}>{s}</span>
									</li>
								{/each}
							</ol>
						</div>
						<!-- code + result -->
						<div class="grid grid-rows-[1fr_auto]">
							<pre
								class="m-0 p-5 font-mono text-[13px] leading-[20px] whitespace-pre overflow-x-auto bg-ink-50"><span
									class="tok-com">{`-- filter & order books published after the year 2010\n`}</span><span
									class="tok-kw">SELECT</span><span class="tok-pun">{' '}</span><span
									class="tok-id">title</span><span class="tok-pun">,</span><span
									class="tok-pun">{' '}</span><span class="tok-id">year</span>{`\n`}<span
									class="tok-kw">FROM</span><span class="tok-pun">{'   '}</span><span
									class="tok-id">books</span>{`\n`}<span class="tok-kw">WHERE</span><span
									class="tok-pun">{'  '}</span><span class="tok-id">year</span><span
									class="tok-pun">{' '}</span><span class="tok-pun">{'>'}</span><span
									class="tok-pun">{' '}</span><span class="tok-num">2010</span>{`\n`}<span
									class="tok-kw">ORDER BY</span><span class="tok-pun">{' '}</span><span
									class="tok-id">year</span><span class="tok-pun">{' '}</span><span
									class="tok-kw">ASC</span><span class="tok-pun">;</span><span
									class="caret tok-pun"
									style="border-right: 1.5px solid oklch(0.72 0.15 195); margin-left: 2px"
									>&nbsp;</span></pre>
							<div class="border-t border-ink-200 bg-ink-0/40">
								<div
									class="px-4 h-8 flex items-center justify-between text-[11px] font-mono text-ink-700"
								>
									<span>4 rows · 1.2 ms</span>
									<span class="text-accent">● ok</span>
								</div>
								<div class="overflow-hidden">
									<table class="w-full font-mono text-[12px] tabular-num">
										<thead class="border-t border-ink-200">
											<tr class="text-left text-ink-700">
												<th class="px-4 py-1.5 w-8 text-right text-ink-600">#</th>
												<th class="px-4 py-1.5">title</th>
												<th class="px-4 py-1.5 w-24">year</th>
											</tr>
										</thead>
										<tbody>
											{#each previewRows as [i, t, y] (i)}
												<tr class="border-t border-ink-100">
													<td class="px-4 py-1.5 text-right text-ink-600">{i}</td>
													<td class="px-4 py-1.5 text-ink-900">{t}</td>
													<td class="px-4 py-1.5 text-ink-900">{y}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>

					<!-- hover hint -->
					<div
						class="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition pointer-events-none"
					>
						<Badge tone="accent">Open this lesson →</Badge>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- 3-FEATURE ROW -->
	<section class="border-t border-ink-200">
		<div class="max-w-[1280px] mx-auto px-6 py-20 md:py-24">
			<div class="grid md:grid-cols-3 gap-px bg-ink-200">
				{#each features as f (f.title)}
					<div class="bg-ink-0 p-7 md:p-8">
						<div
							class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-accent-soft text-accent border border-[oklch(0.72_0.15_195_/_0.25)]"
						>
							<Icon name={f.icon} size={18} />
						</div>
						<h3
							class="mt-5 text-[16px] font-semibold tracking-tight text-ink-900"
						>
							{f.title}
						</h3>
						<p
							class="mt-2 text-[14px] leading-relaxed text-ink-700 max-w-[36ch]"
							style="text-wrap: pretty"
						>
							{f.body}
						</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FOR TEACHERS -->
	<section class="border-t border-ink-200">
		<div
			class="max-w-[1280px] mx-auto px-6 py-20 md:py-24 grid md:grid-cols-[1.1fr_1fr] gap-12 md:gap-20 items-start"
		>
			<div>
				<div
					class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
				>
					For teachers
				</div>
				<h2
					class="mt-3 text-[28px] md:text-[34px] leading-[1.15] tracking-tight font-semibold text-ink-900"
					style="text-wrap: balance"
				>
					A serious tool you can recommend with a straight face.
				</h2>
				<p
					class="mt-4 text-[15px] leading-relaxed text-ink-700 max-w-[55ch]"
					style="text-wrap: pretty"
				>
					SbSQLTT is used in computer science courses at several German Gymnasien. It
					works offline, keeps no student data on a server, and the entire codebase is
					auditable. If you'd like a class set up, a custom schema, or just a chat about
					how it could fit your curriculum — send a short email.
				</p>
				<div class="mt-6 flex items-center gap-3">
					<Button
						variant="secondary"
						size="md"
						onclick={() => (window.location.href = 'mailto:teachers@jmestudio.de')}
					>
						{#snippet leading()}<Icon name="mail" size={14} />{/snippet}
						teachers@jmestudio.de
					</Button>
					<a
						href="#"
						class="text-[13px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1"
					>
						Read the educator notes
						<Icon name="external" size={12} />
					</a>
				</div>
			</div>
			<Surface class="p-6">
				<div
					class="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-600"
				>
					Quick facts
				</div>
				<dl class="mt-4 divide-y divide-ink-200 text-[13.5px]">
					{#each quickFacts as [k, v] (k)}
						<div class="flex items-center justify-between py-2.5">
							<dt class="text-ink-700">{k}</dt>
							<dd class="text-ink-900 font-mono">{v}</dd>
						</div>
					{/each}
				</dl>
			</Surface>
		</div>
	</section>

	<Footer />
</div>
