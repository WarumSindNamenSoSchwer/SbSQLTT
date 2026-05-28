<script lang="ts">
	import TeacherNav from '$lib/components/TeacherNav.svelte';
	import Button from '$lib/components/Button.svelte';
	import { TEACHER, CLASSES } from '$lib/teacher-data';

	let theme = $state<'light' | 'dark' | 'system'>('light');
	let language = $state<'de' | 'en'>('de');
	let confirmDelete = $state(false);

	$effect(() => {
		if (typeof document === 'undefined') return;
		const t = theme === 'system' ? 'light' : theme;
		document.documentElement.classList.toggle('light', t === 'light');
		document.documentElement.classList.toggle('dark', t === 'dark');
		try {
			localStorage.setItem('sbsqltt-theme', t);
		} catch {
			// ignore
		}
	});

	const inputCls =
		'w-full h-10 px-3 rounded-md input-shell text-[14px] border border-ink-200 focus:border-[oklch(0.72_0.15_195_/_0.5)] ring-accent';
</script>

<svelte:head>
	<title>SbSQLTT</title>
</svelte:head>

<TeacherNav />

<div class="max-w-[820px] mx-auto px-6 py-10 md:py-14">
	<div class="mb-10">
		<div
			class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
		>
			Einstellungen
		</div>
		<h1
			class="mt-2 text-[32px] md:text-[36px] leading-tight tracking-[-0.02em] font-semibold"
		>
			Konto und Datenschutz
		</h1>
	</div>

	<section class="mb-10 pb-10 border-b border-ink-200">
		<h2 class="text-[16px] font-semibold tracking-tight text-ink-900">Profil</h2>
		<p class="mt-1 text-[13px] text-ink-700">
			Diese Angaben sehen nur Sie. Schüler:innen sehen nichts davon.
		</p>
		<div class="mt-5 grid sm:grid-cols-2 gap-4">
			<label class="block">
				<span
					class="block text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
					>Name</span
				>
				<input class={inputCls} value="Rebecca Hartmann" />
			</label>
			<label class="block">
				<span
					class="block text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
					>E-Mail</span
				>
				<input class={inputCls} value={TEACHER.email} />
			</label>
			<label class="block sm:col-span-2">
				<span
					class="block text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
					>Schule (frei)</span
				>
				<input class={inputCls} value={TEACHER.school} />
			</label>
		</div>
	</section>

	<section class="mb-10 pb-10 border-b border-ink-200">
		<h2 class="text-[16px] font-semibold tracking-tight text-ink-900">
			Sprache der Oberfläche
		</h2>
		<div class="mt-5 inline-flex p-0.5 bg-ink-100 border border-ink-200 rounded-md">
			{#each [{ id: 'de', label: 'Deutsch', sub: 'Standard', disabled: false }, { id: 'en', label: 'English', sub: 'in Vorbereitung', disabled: true }] as o (o.id)}
				{@const active = o.id === language}
				<button
					disabled={o.disabled}
					onclick={() => !o.disabled && (language = o.id as 'de' | 'en')}
					class={'h-8 px-3.5 rounded-[5px] text-[12.5px] font-medium transition-colors disabled:opacity-50 ' +
						(active
							? 'bg-ink-50 text-ink-900 shadow-soft border border-ink-200'
							: 'text-ink-700 hover:text-ink-900')}
				>
					{o.label}
					<span class="ml-1.5 text-[10.5px] font-mono text-ink-600">({o.sub})</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="mb-10 pb-10 border-b border-ink-200">
		<h2 class="text-[16px] font-semibold tracking-tight text-ink-900">
			Erscheinungsbild
		</h2>
		<div class="mt-5 inline-flex p-0.5 bg-ink-100 border border-ink-200 rounded-md">
			{#each [{ id: 'light', label: 'Hell' }, { id: 'dark', label: 'Dunkel' }, { id: 'system', label: 'System' }] as o (o.id)}
				{@const active = o.id === theme}
				<button
					onclick={() => (theme = o.id as 'light' | 'dark' | 'system')}
					class={'h-8 px-3.5 rounded-[5px] text-[12.5px] font-medium transition-colors ' +
						(active
							? 'bg-ink-50 text-ink-900 shadow-soft border border-ink-200'
							: 'text-ink-700 hover:text-ink-900')}
				>
					{o.label}
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="text-[16px] font-semibold tracking-tight text-ink-900">
			Datenschutz / DSGVO
		</h2>
		<p class="mt-1 text-[13px] text-ink-700">
			SbSQLTT speichert nur Lernfortschritt und Konto-Daten. Sie haben jederzeit volle Kontrolle.
		</p>
		<div class="mt-5 space-y-3">
			<div
				class="rounded-md border border-ink-200 bg-ink-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
			>
				<div>
					<div class="text-[13.5px] font-semibold text-ink-900">
						Alle Klassen-Daten exportieren
					</div>
					<div class="text-[12.5px] text-ink-700 mt-0.5">
						Sie erhalten ein .zip mit CSVs aller Klassen, Schüler:innen und Lernpfade.
					</div>
				</div>
				<Button variant="secondary" size="md">Export herunterladen</Button>
			</div>
			<div
				class="rounded-md border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
				style="border-color: oklch(0.55 0.18 25 / 0.25); background: oklch(0.55 0.18 25 / 0.04);"
			>
				<div>
					<div class="text-[13.5px] font-semibold text-ink-900">
						Alle Daten unwiderruflich löschen
					</div>
					<div class="text-[12.5px] text-ink-700 mt-0.5">
						Inklusive aller Klassen, Schüler-Fortschritte und Konto. Diese Aktion kann nicht rückgängig gemacht werden.
					</div>
				</div>
				<Button
					variant="secondary"
					size="md"
					onclick={() => (confirmDelete = true)}
					class="!text-err whitespace-nowrap shrink-0"
					style="border-color: oklch(0.55 0.18 25 / 0.3);"
				>
					Konto löschen…
				</Button>
			</div>
		</div>
	</section>
</div>

{#if confirmDelete}
	<div class="fixed inset-0 z-50 grid place-items-center px-4 fade-in">
		<button
			aria-label="Schließen"
			class="absolute inset-0 bg-black/55 backdrop cursor-default"
			onclick={() => (confirmDelete = false)}
		></button>
		<div
			class="relative w-full max-w-[420px] rounded-xl bg-ink-50 border border-ink-200 shadow-pop p-6"
		>
			<h3 class="text-[18px] font-semibold tracking-tight text-ink-900">
				Konto wirklich löschen?
			</h3>
			<p class="mt-2 text-[13.5px] leading-relaxed text-ink-700">
				Alle Ihre Klassen ({CLASSES.length}) und {CLASSES.reduce(
					(n, c) => n + c.students.length,
					0
				)} Schüler-Fortschritte werden permanent entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
			</p>
			<div class="mt-5 flex items-center justify-end gap-2">
				<Button variant="ghost" onclick={() => (confirmDelete = false)}
					>Abbrechen</Button
				>
				<Button
					variant="secondary"
					class="!text-err"
					style="border-color: oklch(0.55 0.18 25 / 0.3);"
					onclick={() => (confirmDelete = false)}
				>
					Endgültig löschen
				</Button>
			</div>
		</div>
	</div>
{/if}
