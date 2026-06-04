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

	let mockupLoaded = $state(false);

	function openLesson() {
		goto('/learn/beginner/where-filters');
	}
</script>

<div>
	<!-- HERO -->
	<section class="relative">
		<div class="relative max-w-[1280px] mx-auto px-4 md:px-6 pt-20 pb-16 md:pt-28 md:pb-24 lg:grid lg:grid-cols-[680px_1fr] lg:gap-6 lg:items-center">
			<div class="max-w-[680px]">
				<Badge tone="accent" class="!h-6 !px-2.5">
					<span class="font-mono text-[10.5px] tracking-wide">v0.4 · public alpha</span>
				</Badge>

				<h1
					class="mt-5 text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.02em] font-semibold text-ink-900"
					style="text-wrap: balance"
				>
					SQL lernen, indem du es schreibst.
					<span class="text-accent/80">Kostenlos, Open Source,</span>
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
					class="mt-5 text-[12.5px] text-ink-600 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono"
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

			<!-- desktop-only hero illustration (theme-aware) -->
			<div class="hidden lg:block">
				<img
					src="/images/hero-illustration.png"
					alt=""
					aria-hidden="true"
					width="1200"
					height="1200"
					class="hero-light w-full h-auto select-none pointer-events-none"
				/>
				<img
					src="/images/hero-illustration-dark.png"
					alt=""
					aria-hidden="true"
					width="1200"
					height="1200"
					class="hero-dark w-full h-auto select-none pointer-events-none"
				/>
			</div>

			<!-- inline lesson mockup screenshot -->
			<div class="mt-14 md:mt-20 lg:col-span-2">
				<button
					type="button"
					onclick={openLesson}
					aria-label="Diese Lektion öffnen"
					class="group relative block w-full rounded-xl overflow-hidden cursor-pointer ring-accent"
					style="aspect-ratio: 5186 / 2874"
				>
					{#if !mockupLoaded}
						<div
							aria-hidden="true"
							class="absolute inset-0 skeleton-shimmer rounded-xl"
						></div>
					{/if}
					<img
						src="/images/lesson-mockup.png"
						alt="Vorschau der Lektion „Bücher, die nach 2010 erschienen sind“ – Schritt 4 von 5"
						width="5186"
						height="2874"
						loading="lazy"
						onload={() => (mockupLoaded = true)}
						class={'absolute inset-0 w-full h-full object-cover select-none transition-opacity duration-500 ' +
							(mockupLoaded ? 'opacity-100' : 'opacity-0')}
					/>
					<!-- hover hint (desktop only) -->
					<div
						class="hidden md:block absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition pointer-events-none"
					>
						<Badge tone="accent">Diese Lektion öffnen →</Badge>
					</div>
				</button>
			</div>
		</div>
	</section>

	<!-- 3-FEATURE ROW -->
	<section class="border-t border-ink-200">
		<div class="max-w-[1280px] mx-auto px-4 md:px-6 py-20 md:py-24">
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
			class="max-w-[1280px] mx-auto px-4 md:px-6 py-20 md:py-24 grid md:grid-cols-[1.1fr_1fr] gap-12 md:gap-20 items-start"
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
				<div class="mt-6 flex flex-wrap items-center gap-3">
					<Button variant="primary" size="md" onclick={() => goto('/teach')}>
						{#snippet trailing()}<Icon name="arrow" size={14} />{/snippet}
						Lehrer-Bereich öffnen
					</Button>
					<Button
						variant="secondary"
						size="md"
						onclick={() => (window.location.href = 'mailto:teachers@jmestudio.de')}
					>
						{#snippet leading()}<Icon name="mail" size={14} />{/snippet}
						teachers@jmestudio.de
					</Button>
					<a
						href="/fuer-lehrkraefte"
						class="text-[13px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1"
					>
						Hinweise für Lehrkräfte lesen
						<Icon name="external" size={12} />
					</a>
				</div>
				<p class="mt-3 text-[12px] text-ink-600">
					Während der öffentlichen Alpha kommen Sie ohne Anmeldung in den Bereich, um ihn
					zu testen. Echte Konten folgen mit der nächsten Version.
				</p>
			</div>
			<Surface class="p-6">
				<div
					class="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-600"
				>
					Kurzinfo
				</div>
				<dl class="mt-4 divide-y divide-ink-200 text-[13.5px]">
					{#each quickFacts as [k, v] (k)}
						<div
							class="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-1 sm:gap-4"
						>
							<dt class="text-ink-700 shrink-0">{k}</dt>
							<dd
								class="text-ink-900 font-mono sm:text-right min-w-0 break-words"
							>{v}</dd>
						</div>
					{/each}
				</dl>
			</Surface>
		</div>
	</section>

	<Footer />
</div>
