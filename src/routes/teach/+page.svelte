<script lang="ts">
	import { goto } from '$app/navigation';
	import TeacherNav from '$lib/components/TeacherNav.svelte';
	import ClassCard from '$lib/components/ClassCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import Surface from '$lib/components/Surface.svelte';
	import { TEACHER, CLASSES } from '$lib/teacher-data';

	// Demo toggle — show empty-state if user clicks the dev affordance.
	let hasClasses = $state(true);

	let lastLogin = new Date(TEACHER.lastLoginIso);
	let lastStr =
		lastLogin.toLocaleDateString('de-DE', {
			weekday: 'long',
			day: '2-digit',
			month: 'long'
		}) +
		' · ' +
		lastLogin.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) +
		' Uhr';

	let totalStudents = $derived(CLASSES.reduce((n, c) => n + c.students.length, 0));
	let activeThisWeek = $derived(CLASSES.reduce((n, c) => n + c.activeThisWeek, 0));
</script>

<svelte:head>
	<title>SbSQLTT</title>
</svelte:head>

<TeacherNav />

<div class="max-w-[1280px] mx-auto px-4 md:px-6 py-8 md:py-12">
	<div
		class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-8"
	>
		<div>
			<div
				class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
			>
				Lehrkraft · Übersicht
			</div>
			<h1
				class="mt-2 text-[28px] md:text-[36px] leading-tight tracking-[-0.02em] font-semibold"
			>
				Willkommen zurück, {TEACHER.greetingName}.
			</h1>
			<p class="mt-2 text-[13.5px] text-ink-600 font-mono">
				Letzte Anmeldung: {lastStr}
			</p>
		</div>
		<div class="flex items-center gap-3 flex-wrap">
			<button
				onclick={() => (hasClasses = !hasClasses)}
				class="hidden md:inline-flex text-[12px] font-mono text-ink-600 hover:text-ink-900 border border-dashed border-ink-300 rounded-md px-2.5 h-7 items-center"
				title="Demo: leeren Zustand zeigen"
			>
				demo: {hasClasses ? 'leere Liste zeigen' : 'Klassen anzeigen'}
			</button>
			<Button
				variant="primary"
				size="md"
				onclick={() => goto('/teach/new')}
				class="tap w-full sm:w-auto"
			>
				{#snippet leading()}
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 5v14M5 12h14" stroke-linecap="round" />
					</svg>
				{/snippet}
				Neue Klasse anlegen
			</Button>
		</div>
	</div>

	{#if hasClasses}
		<div
			class="mb-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-ink-200 border border-ink-200 rounded-lg overflow-hidden"
		>
			{#each [['Klassen', CLASSES.length], ['Schüler:innen', totalStudents], ['Diese Woche aktiv', activeThisWeek], ['Lektionen verfügbar', 14]] as [label, value] (label)}
				<div class="bg-ink-50 px-5 py-4">
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600"
					>
						{label}
					</div>
					<div
						class="mt-1 text-[22px] font-semibold font-mono tabular-num text-ink-900"
					>
						{value}
					</div>
				</div>
			{/each}
		</div>

		<section>
			<div class="flex items-baseline justify-between mb-4">
				<h2
					class="text-[15px] font-semibold tracking-tight text-ink-900"
				>
					Ihre Klassen
				</h2>
				<div class="text-[12px] text-ink-700">
					Sortiert nach Aktivität · zuletzt aktualisiert vor 30 Sek.
				</div>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
				{#each CLASSES as c (c.id)}
					<ClassCard cls={c} />
				{/each}
			</div>
		</section>
	{:else}
		<Surface class="p-10 md:p-14 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
			<div>
				<div
					class="text-[11px] font-mono uppercase tracking-[0.14em] text-accent"
				>
					Noch keine Klasse
				</div>
				<h2
					class="mt-3 text-[26px] md:text-[30px] leading-[1.1] tracking-tight font-semibold text-ink-900"
					style="text-wrap: balance"
				>
					Legen Sie Ihre erste Klasse an.
				</h2>
				<p
					class="mt-3 text-[14.5px] leading-relaxed text-ink-700 max-w-[55ch]"
				>
					Eine Klasse besteht aus einem Beitritts-Code, den Sie an Ihre Schülerinnen
					und Schüler weitergeben, und einer Auswahl an Lektions-Tracks. Sie können
					den Code jederzeit zurücksetzen oder die Klasse später archivieren.
				</p>
				<div class="mt-6 flex items-center gap-3">
					<Button variant="primary" size="lg" onclick={() => goto('/teach/new')}>
						Erste Klasse anlegen
					</Button>
					<Button variant="ghost" size="lg">Wie funktioniert das?</Button>
				</div>
			</div>
			<div class="hidden md:block">
				<Surface class="p-5">
					<div
						class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600 mb-3"
					>
						Beispiel-Code
					</div>
					<div
						class="text-[28px] font-mono tracking-tight text-ink-900"
					>
						TURM-9B-42
					</div>
					<ul class="mt-5 space-y-2 text-[13px] text-ink-700">
						<li>· 8–16 Zeichen, leicht zu diktieren</li>
						<li>· Jederzeit erneuerbar</li>
						<li>· Kein Schüler-Konto nötig</li>
					</ul>
				</Surface>
			</div>
		</Surface>
	{/if}
</div>
