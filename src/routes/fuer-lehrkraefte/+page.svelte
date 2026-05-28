<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Surface from '$lib/components/Surface.svelte';
	import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>Hinweise für Lehrkräfte · SbSQLTT</title>
	<meta
		name="description"
		content="Wie SbSQLTT in den Informatikunterricht passt: Lernziele, Datenschutz, technische Voraussetzungen und Best Practices."
	/>
</svelte:head>

<main class="max-w-[820px] mx-auto px-6 pt-16 pb-24">
	<header class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<Badge tone="accent">
				<span class="font-mono text-[10.5px] tracking-wide">für Lehrkräfte</span>
			</Badge>
		</div>
		<h1
			class="text-[36px] md:text-[44px] leading-[1.1] tracking-tight font-semibold text-ink-900"
			style="text-wrap: balance"
		>
			Hinweise für Lehrkräfte
		</h1>
		<p
			class="mt-4 text-[16px] leading-relaxed text-ink-700 max-w-[60ch]"
			style="text-wrap: pretty"
		>
			Diese Seite richtet sich an Lehrerinnen und Lehrer, die SbSQLTT im
			Informatikunterricht einsetzen oder testen wollen. Stand: SbSQLTT v0.4 (öffentliche
			Alpha), Inhalt wird laufend aktualisiert.
		</p>
	</header>

	<div class="space-y-12 text-[15px] leading-relaxed text-ink-800">
		<section>
			<h2 class="text-[20px] font-semibold tracking-tight text-ink-900 mb-3">
				Idee in zwei Sätzen
			</h2>
			<p>
				SbSQLTT ist ein kostenloses, quelloffenes Werkzeug, mit dem Schülerinnen und
				Schüler SQL direkt im Browser üben. Es soll im Unterricht oder als Hausaufgabe
				eingesetzt werden, ist aber bewusst so gebaut, dass es auch ohne Lehrkraft
				funktioniert.
			</p>
		</section>

		<section>
			<h2 class="text-[20px] font-semibold tracking-tight text-ink-900 mb-3">
				Lernziele, die abgedeckt werden
			</h2>
			<p class="mb-4">
				Die Lektionen orientieren sich an den Rahmenlehrplänen für Informatik in der
				Sekundarstufe II (insbesondere Berlin, Brandenburg, NRW). Konkret:
			</p>
			<ul class="space-y-2 list-disc pl-5 text-ink-700">
				<li>Aufbau einer relationalen Datenbank verstehen.</li>
				<li>SELECT-Abfragen lesen und schreiben.</li>
				<li>Daten mit WHERE, ORDER BY, LIMIT filtern und sortieren.</li>
				<li>Aggregatfunktionen und GROUP BY sicher anwenden.</li>
				<li>Tabellen mit JOIN verknüpfen, Subqueries formulieren.</li>
				<li>Eigene Schemata entwerfen und sinnvolle Daten einfügen.</li>
			</ul>
		</section>

		<section>
			<h2 class="text-[20px] font-semibold tracking-tight text-ink-900 mb-3">
				Datenschutz und Rechtliches
			</h2>
			<p class="mb-3">
				SbSQLTT ist mit Blick auf den schulischen Datenschutz entwickelt:
			</p>
			<ul class="space-y-2 list-disc pl-5 text-ink-700">
				<li>
					<strong class="text-ink-900">SQL-Abfragen verlassen niemals den Browser.</strong>
					Die Postgres-Engine läuft als WebAssembly direkt im Browser der Schülerin oder
					des Schülers. Auf unseren Servern landen keine Eingaben.
				</li>
				<li>
					<strong class="text-ink-900">Anmeldung ist optional.</strong> Lektionen lassen
					sich ohne Konto vollständig nutzen. Nur wenn Fortschritt geräteübergreifend
					gespeichert werden soll, ist ein Login per Magic Link nötig.
				</li>
				<li>
					<strong class="text-ink-900">Keine Werbung, kein Tracking.</strong> Keine
					Drittanbieter-Analyse, keine Werbe-Cookies, keine Pixel. Details in der
					<a href="/datenschutz" class="text-accent hover:underline">Datenschutzerklärung</a>.
				</li>
				<li>
					<strong class="text-ink-900">Hosting in der EU.</strong> Anwendung läuft über
					Vercel, Datenbank über Supabase (Region Frankfurt).
				</li>
				<li>
					<strong class="text-ink-900">Auftragsverarbeitung (AVV).</strong> Eine
					Mustervereinbarung nach Art. 28 DSGVO ist auf Anfrage erhältlich.
				</li>
			</ul>
		</section>

		<section>
			<h2 class="text-[20px] font-semibold tracking-tight text-ink-900 mb-3">
				Technische Voraussetzungen
			</h2>
			<ul class="space-y-2 list-disc pl-5 text-ink-700">
				<li>
					Aktueller Browser (Chrome, Firefox, Edge oder Safari, jeweils Version aus den
					letzten zwei Jahren).
				</li>
				<li>JavaScript aktiv. Keine zusätzliche Installation, kein Plug-in.</li>
				<li>
					Internetverbindung beim ersten Aufruf einer Lektion. Danach kann sie auch
					offline weiter bearbeitet werden.
				</li>
				<li>
					Tablets ab etwa 10″ funktionieren gut, Smartphones sind eingeschränkt
					(Editor ist klein, aber bedienbar).
				</li>
			</ul>
		</section>

		<section>
			<h2 class="text-[20px] font-semibold tracking-tight text-ink-900 mb-3">
				Einsatz-Szenarien
			</h2>
			<div class="space-y-4">
				<Surface class="p-5">
					<div class="font-semibold text-ink-900 mb-1">
						1. Frontalunterricht mit Beamer
					</div>
					<p class="text-ink-700">
						Sie demonstrieren eine Lektion live an der Tafel. Schülerinnen und Schüler
						tippen die Abfrage parallel auf ihren Geräten. Anschließend Diskussion der
						Variationen.
					</p>
				</Surface>
				<Surface class="p-5">
					<div class="font-semibold text-ink-900 mb-1">
						2. Selbstlernphase im Unterricht
					</div>
					<p class="text-ink-700">
						Sie geben einen Track frei (z. B. Anfänger), die Klasse arbeitet im eigenen
						Tempo. Sie wandern durch den Raum, das Lehrer-Dashboard (in Vorbereitung)
						zeigt Ihnen später, wer wo hängt.
					</p>
				</Surface>
				<Surface class="p-5">
					<div class="font-semibold text-ink-900 mb-1">3. Hausaufgabe</div>
					<p class="text-ink-700">
						Geben Sie einen direkten Lektions-Link mit, z. B.
						<code class="font-mono text-[13px] text-accent"
							>/learn/beginner/where-filters</code
						>. Die Lektion ist in unter zehn Minuten machbar.
					</p>
				</Surface>
				<Surface class="p-5">
					<div class="font-semibold text-ink-900 mb-1">4. Klausurvorbereitung</div>
					<p class="text-ink-700">
						Schülerinnen und Schüler können beliebig oft Aufgaben wiederholen, eigene
						Schemata anlegen und realistische Abfragen üben.
					</p>
				</Surface>
			</div>
		</section>

		<section>
			<h2 class="text-[20px] font-semibold tracking-tight text-ink-900 mb-3">
				Was es noch nicht gibt
			</h2>
			<p class="mb-3 text-ink-700">
				Ehrlich gesagt: Einiges. Pre-MVP heißt Pre-MVP.
			</p>
			<ul class="space-y-2 list-disc pl-5 text-ink-700">
				<li>Lehrer-Dashboard mit Schüler-Fortschritt (Phase 3, in Arbeit).</li>
				<li>Notenvergabe oder Punktesystem (nicht geplant).</li>
				<li>Vollständige Lektions-Bibliothek (aktuell eine Beispiel-Lektion).</li>
				<li>Englische Übersetzung der Lektions-Inhalte (folgt).</li>
			</ul>
		</section>

		<section>
			<h2 class="text-[20px] font-semibold tracking-tight text-ink-900 mb-3">
				Mitmachen und Kontakt
			</h2>
			<p class="text-ink-700 mb-4">
				SbSQLTT entsteht in enger Abstimmung mit Informatik-Lehrkräften. Wenn Sie Ideen für
				Lektionen, Aufgabenformate oder Beispieldatensätze haben, freue ich mich über eine
				kurze Nachricht.
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<a
					href="mailto:teachers@jmestudio.de"
					class="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-ink-200 hover:bg-ink-300 text-ink-900 border border-ink-300 text-[14px]"
				>
					<Icon name="mail" size={14} />
					teachers@jmestudio.de
				</a>
				<a
					href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT/issues"
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1 text-[13.5px] text-ink-700 hover:text-ink-900"
				>
					Vorschlag als GitHub-Issue einreichen
					<Icon name="external" size={12} />
				</a>
			</div>
		</section>
	</div>
</main>

<Footer />
