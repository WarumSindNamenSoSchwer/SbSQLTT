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
			title: 'Interaktives Postgres im Browser',
			body: 'Jede Abfrage läuft gegen eine echte Postgres-kompatible Engine, kompiliert nach WebAssembly. Keine Konten, keine Server. Dein Laptop ist die Datenbank.'
		},
		{
			icon: 'layers' as const,
			title: 'Lerntracks: Anfänger → Fortgeschritten',
			body: 'Ein klar aufgebauter Weg von SELECT und WHERE über Joins, Subqueries bis zu Window Functions. Jeder Schritt ist eine kleine, fokussierte Übung.'
		},
		{
			icon: 'spark' as const,
			title: 'Eigenes Schema mitbringen',
			body: 'Füge ein CREATE-TABLE-Skript ein oder lade einen .sql-Dump hoch und erkunde deine eigenen Daten mit demselben Editor und Ergebnis-Panel.'
		}
	];

	const quickFacts: [string, string][] = [
		['Lizenz', 'AGPL-3.0'],
		['Betrieb', 'selbst hostbar oder kostenlos gehostet'],
		['Konto erforderlich', 'nein'],
		['Sprachen', 'Deutsch (Englisch folgt)'],
		['Backend', 'postgres-wasm im Browser'],
		['Quellcode', 'github.com/WarumSindNamenSoSchwer/SbSQLTT']
	];

	const stepLabels = [
		'Warum filtern?',
		'Aufbau von WHERE',
		'Bedingungen kombinieren',
		'Probier es: Bücher nach 2010',
		'Rückblick'
	];

	const previewRows: [number, string, number][] = [
		[1, 'Designing Data-Intensive Apps', 2017],
		[2, 'Refactoring', 2018],
		[3, 'Seven Databases in Seven Weeks', 2018],
		[4, 'Database Internals', 2019]
	];

	// Quick facts row labels we still want to render in the SQL accent color
	// (no behavioural change — purely label text).

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
					SQL lernen, indem du es schreibst.
					<span class="text-ink-700">Kostenlos, Open Source,</span>
					<br class="hidden md:block" /> ohne Anmeldung.
				</h1>

				<p
					class="mt-5 text-[16px] md:text-[17px] leading-relaxed text-ink-700 max-w-[560px]"
					style="text-wrap: pretty"
				>
					Ein moderner, fokussierter Weg, SQL im Browser zu üben. Echtes Postgres, echte
					Datensätze und Lektionen, die von
					<span class="font-mono text-ink-800">SELECT</span> bis zu Window Functions
					aufeinander aufbauen, in deinem eigenen Tempo.
				</p>

				<div class="mt-7 flex items-center gap-3">
					<Button variant="primary" size="lg" onclick={openLesson}>
						{#snippet trailing()}<Icon name="arrow" size={14} />{/snippet}
						Erste Lektion starten
					</Button>
					<Button variant="ghost" size="lg" onclick={() => goto('/learn')}>
						Alle Tracks ansehen
					</Button>
				</div>

				<div
					class="mt-5 text-[12.5px] text-ink-600 flex items-center gap-4 font-mono"
				>
					<span class="inline-flex items-center gap-1.5">
						<Icon name="check" size={12} /> 100 % Open Source
					</span>
					<span class="inline-flex items-center gap-1.5">
						<Icon name="check" size={12} /> Läuft im Browser
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
							beginner / where-filters · Schritt 4 von 5
						</div>
						<div class="font-mono text-[11px] text-ink-600">⌘↵ ausführen</div>
					</div>
					<!-- body -->
					<div class="grid grid-cols-1 md:grid-cols-[1fr_1.6fr]">
						<!-- lesson side -->
						<div class="p-6 border-r border-ink-200 hidden md:block">
							<div
								class="text-[11px] font-mono uppercase tracking-[0.14em] text-accent"
							>
								Schritt 4 / 5
							</div>
							<div class="mt-2 text-[18px] font-semibold tracking-tight text-ink-900">
								Bücher, die nach 2010 erschienen sind
							</div>
							<p class="mt-3 text-[13px] leading-relaxed text-ink-700">
								Filtere die Tabelle <span class="font-mono">books</span> so, dass nur
								Zeilen erscheinen, deren <span class="font-mono">year</span> echt größer
								als 2010 ist. Sortiere aufsteigend nach Jahr.
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
									class="tok-com">{`-- Bücher nach dem Jahr 2010 filtern & sortieren\n`}</span><span
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
									<span>4 Zeilen · 1.2 ms</span>
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
						<Badge tone="accent">Diese Lektion öffnen →</Badge>
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
	<section id="teachers" class="border-t border-ink-200 scroll-mt-20">
		<div
			class="max-w-[1280px] mx-auto px-6 py-20 md:py-24 grid md:grid-cols-[1.1fr_1fr] gap-12 md:gap-20 items-start"
		>
			<div>
				<div
					class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
				>
					Für Lehrkräfte
				</div>
				<h2
					class="mt-3 text-[28px] md:text-[34px] leading-[1.15] tracking-tight font-semibold text-ink-900"
					style="text-wrap: balance"
				>
					Entwickelt mit Lehrkräften, damit es zu Ihrem Unterricht passt.
				</h2>
				<p
					class="mt-4 text-[15px] leading-relaxed text-ink-700 max-w-[55ch]"
					style="text-wrap: pretty"
				>
					SbSQLTT entsteht in enger Abstimmung mit Informatiklehrkräften, damit Aufgaben,
					Tempo und Schwerpunkte wirklich zu dem passen, was Schülerinnen und Schüler im
					Kurs brauchen. Es läuft offline, speichert keine Schülerdaten auf einem fremden
					Server, und der gesamte Quellcode ist einsehbar. Wenn Sie mitgestalten,
					Aufgaben vorschlagen oder einen Klassensatz testen möchten, schreiben Sie kurz.
					Wir nehmen Feedback ernst.
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
				</div>
			</div>
			<Surface class="p-6">
				<div
					class="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-600"
				>
					Kurzinfo
				</div>
				<dl class="mt-4 divide-y divide-ink-200 text-[13.5px]">
					{#each quickFacts as [k, v] (k)}
						<div class="flex items-center justify-between py-2.5 gap-4">
							<dt class="text-ink-700">{k}</dt>
							<dd class="text-ink-900 font-mono text-right">{v}</dd>
						</div>
					{/each}
				</dl>
			</Surface>
		</div>
	</section>

	<Footer />
</div>
