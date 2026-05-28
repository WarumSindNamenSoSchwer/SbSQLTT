<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CLASSES } from '$lib/teacher-data';
	import Surface from '$lib/components/Surface.svelte';
	import Button from '$lib/components/Button.svelte';
	import JoinCodeChip from '$lib/components/JoinCodeChip.svelte';

	let classId = $derived(page.params.class);
	let cls = $derived(CLASSES.find((c) => c.id === classId)!);

	let name = $state('');
	let term = $state('');
	$effect(() => {
		// keep the inputs synced with the class context
		void classId;
		name = cls.name;
		term = cls.term;
	});

	const inputCls =
		'w-full h-10 px-3 rounded-md input-shell text-[14px] border border-ink-200 focus:border-[oklch(0.72_0.15_195_/_0.5)] ring-accent';
</script>

<svelte:head>
	<title>Einstellungen · {cls.name} · SbSQLTT</title>
</svelte:head>

<div class="max-w-[820px] mx-auto px-6 py-10 md:py-14">
	<button
		onclick={() => goto(`/teach/${classId}`)}
		class="text-[12px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1 mb-2 font-mono"
	>
		← Zurück zur Klasse
	</button>
	<div
		class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
	>
		Klassen-Einstellungen
	</div>
	<h1
		class="mt-2 text-[28px] md:text-[32px] leading-tight tracking-[-0.02em] font-semibold"
	>
		{cls.name}
	</h1>
	<p class="mt-2 text-[13.5px] text-ink-700">
		Nur Sie sehen diese Einstellungen. Globale Konto-Einstellungen finden Sie
		<a href="/teach/settings" class="text-accent hover:underline">unter „Einstellungen"</a>.
	</p>

	<section class="mt-10 pb-10 border-b border-ink-200">
		<h2 class="text-[16px] font-semibold tracking-tight text-ink-900">
			Stammdaten
		</h2>
		<div class="mt-5 grid sm:grid-cols-2 gap-4">
			<label class="block">
				<span
					class="block text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
					>Klassenname</span
				>
				<input class={inputCls} bind:value={name} />
			</label>
			<label class="block">
				<span
					class="block text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
					>Halbjahr</span
				>
				<input class={inputCls} bind:value={term} />
			</label>
		</div>
	</section>

	<section class="mt-10 pb-10 border-b border-ink-200">
		<h2 class="text-[16px] font-semibold tracking-tight text-ink-900">
			Beitritts-Code
		</h2>
		<div class="mt-5 flex items-center gap-3 flex-wrap">
			<JoinCodeChip code={cls.joinCode} size="lg" />
			<Button variant="secondary" size="md">Code zurücksetzen</Button>
		</div>
		<p class="mt-2 text-[12px] text-ink-600">
			Beim Zurücksetzen können sich neue Schüler:innen nicht mehr mit dem alten Code anmelden.
		</p>
	</section>

	<section class="mt-10">
		<h2 class="text-[16px] font-semibold tracking-tight text-ink-900">
			Gefahrenzone
		</h2>
		<div class="mt-5 space-y-3">
			<Surface class="p-4 flex items-center justify-between gap-3 flex-wrap">
				<div>
					<div class="text-[13.5px] font-semibold text-ink-900">
						Klasse archivieren
					</div>
					<div class="text-[12.5px] text-ink-700 mt-0.5">
						Schüler:innen können der Klasse nicht mehr beitreten. Sie selbst sehen die Daten weiter.
					</div>
				</div>
				<Button variant="secondary" size="md">Archivieren</Button>
			</Surface>
			<div
				class="rounded-md border p-4 flex items-center justify-between gap-3 flex-wrap"
				style="border-color: oklch(0.55 0.18 25 / 0.25); background: oklch(0.55 0.18 25 / 0.04);"
			>
				<div>
					<div class="text-[13.5px] font-semibold text-ink-900">
						Klasse unwiderruflich löschen
					</div>
					<div class="text-[12.5px] text-ink-700 mt-0.5">
						Inklusive aller Schüler-Fortschritte. Kann nicht rückgängig gemacht werden.
					</div>
				</div>
				<Button
					variant="secondary"
					size="md"
					class="!text-err"
					style="border-color: oklch(0.55 0.18 25 / 0.3);"
				>
					Klasse löschen…
				</Button>
			</div>
		</div>
	</section>
</div>
