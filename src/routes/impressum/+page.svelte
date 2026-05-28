<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
</script>

<div class="min-h-[calc(100vh-3.5rem)] flex flex-col">
	<main class="flex-1">
		<article class="max-w-[720px] mx-auto px-6 pb-16">
			<h1
				class="mt-12 mb-8 text-3xl md:text-4xl font-semibold tracking-tight text-ink-900"
			>
				Impressum
			</h1>

			<section class="space-y-3">
				<h2 class="text-base font-semibold text-ink-900">Angaben gemäß § 5 TMG</h2>
				<address
					class="not-italic font-mono text-[13.5px] leading-relaxed text-ink-800 bg-ink-50 border border-ink-200 rounded-md p-4"
				>
					Murat-Can Meric<br />
					jmestudio (GbR)<br />
					Lübecker Str. 45<br />
					10559 Berlin<br />
					Deutschland
				</address>
			</section>

			<section class="mt-10 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">Kontakt</h2>
				<p class="text-[14px] leading-relaxed text-ink-700">
					E-Mail:
					<a
						href="mailto:murat.meric@jmestudio.de"
						class="font-mono text-accent hover:underline underline-offset-4"
						>murat.meric@jmestudio.de</a
					>
				</p>
			</section>

			<section class="mt-10 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">Umsatzsteuer</h2>
				<p class="text-[14px] leading-relaxed text-ink-700">
					Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen
					(Kleinunternehmerregelung).
				</p>
			</section>

			<section class="mt-10 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">
					Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
				</h2>
				<p class="text-[14px] leading-relaxed text-ink-700">
					Murat-Can Meric, Anschrift wie oben.
				</p>
			</section>

			<section class="mt-10 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">Haftungsausschluss</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Die Inhalte dieser Seite werden mit größtmöglicher Sorgfalt erstellt. Für die
					Richtigkeit, Vollständigkeit und Aktualität der Inhalte wird jedoch keine
					Gewähr übernommen. SbSQLTT ist als Open-Source-Projekt unter der AGPL-3.0
					lizenziert; der Quellcode ist auf
					<a
						href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT"
						target="_blank"
						rel="noreferrer"
						class="text-accent hover:underline underline-offset-4">GitHub</a
					> einsehbar.
				</p>
			</section>

			<section class="mt-10 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">EU-Streitschlichtung</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
					(OS) bereit:
					<a
						href="https://ec.europa.eu/consumers/odr/"
						target="_blank"
						rel="noreferrer"
						class="text-accent hover:underline underline-offset-4 font-mono"
						>https://ec.europa.eu/consumers/odr/</a
					>. Wir sind nicht verpflichtet und nicht bereit, an einem
					Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
					teilzunehmen.
				</p>
			</section>
		</article>
	</main>
	<Footer />
</div>
