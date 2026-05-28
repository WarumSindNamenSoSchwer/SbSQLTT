<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
</script>

<div class="min-h-[calc(100vh-3.5rem)] flex flex-col">
	<main class="flex-1">
		<article class="max-w-[720px] mx-auto px-6 pb-16">
			<h1
				class="mt-12 mb-8 text-3xl md:text-4xl font-semibold tracking-tight text-ink-900"
			>
				Datenschutzerklärung
			</h1>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">1. Verantwortlich</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Murat-Can Meric, Lübecker Str. 45, 10559 Berlin, E-Mail:
					<a
						href="mailto:murat.meric@jmestudio.de"
						class="font-mono text-accent hover:underline underline-offset-4"
						>murat.meric@jmestudio.de</a
					>.
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">2. Allgemeines</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Wir verarbeiten personenbezogene Daten nur, soweit das zur Bereitstellung
					dieser Webseite erforderlich ist. Wir verzichten so weit wie möglich auf das
					Setzen von Cookies und das Einbinden externer Tracker.
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">3. Server-Logs</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Beim Aufruf der Seite werden technisch notwendige Daten (IP-Adresse,
					Datum/Uhrzeit, aufgerufene URL, User-Agent) vom Hosting-Anbieter Vercel Inc.
					(340 S Lemon Ave #4133, Walnut, CA 91789, USA) für maximal 30 Tage
					gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
					Interesse an einem stabilen Betrieb).
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">4. Schriftarten</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Inter und JetBrains Mono werden lokal von unserem Server ausgeliefert. Es
					findet keine Verbindung zu Google Fonts statt.
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">5. Konto / Login (optional)</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Falls du dich anmeldest, speichern wir deine E-Mail-Adresse und deinen
					Lernfortschritt bei der Supabase Inc. (970 Toa Payoh North #07-04, Singapore
					318992) in einer Datenbank in der EU (Region Frankfurt). Anmeldung erfolgt
					per „Magic Link" — wir setzen keine Passwörter. Rechtsgrundlage: Art. 6 Abs.
					1 lit. b DSGVO. Du kannst dein Konto jederzeit per E-Mail löschen lassen.
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">6. SQL-Übungen</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Alle SQL-Abfragen, die du in den Lektionen schreibst, werden ausschließlich
					im Browser ausgeführt (Postgres-WASM). Sie verlassen niemals dein Gerät.
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">7. Cookies</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Wir setzen ausschließlich technisch notwendige Cookies (z. B. zum Speichern
					deiner Theme-Auswahl und ggf. Login-Session). Eine Einwilligung ist nach §
					25 Abs. 2 Nr. 2 TTDSG nicht erforderlich.
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">8. Deine Rechte</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Du hast jederzeit das Recht auf Auskunft, Berichtigung, Löschung,
					Einschränkung und Datenübertragbarkeit (Art. 15–20 DSGVO). Beschwerden
					richte an die zuständige Aufsichtsbehörde oder direkt an uns.
				</p>
			</section>

			<section class="mt-8 space-y-2">
				<h2 class="text-base font-semibold text-ink-900">9. Kontakt</h2>
				<p
					class="text-[14px] leading-relaxed text-ink-700"
					style="text-wrap: pretty"
				>
					Bei Fragen zum Datenschutz:
					<a
						href="mailto:murat.meric@jmestudio.de"
						class="font-mono text-accent hover:underline underline-offset-4"
						>murat.meric@jmestudio.de</a
					>.
				</p>
			</section>

			<p class="mt-10 text-[12.5px] font-mono text-ink-600">Stand: Mai 2026.</p>
		</article>
	</main>
	<Footer />
</div>
