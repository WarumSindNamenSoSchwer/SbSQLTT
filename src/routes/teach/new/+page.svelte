<script lang="ts">
	import { goto } from '$app/navigation';
	import TeacherNav from '$lib/components/TeacherNav.svelte';
	import Button from '$lib/components/Button.svelte';
	import Surface from '$lib/components/Surface.svelte';
	import { randomCode } from '$lib/teacher-data';

	let name = $state('');
	let term = $state('2025/26 · 2. Halbjahr');
	let tracks = $state({ beginner: true, intermediate: false, advanced: false });
	let code = $state(randomCode());

	const inputCls =
		'w-full h-10 px-3 rounded-md input-shell text-[14px] border border-ink-200 focus:border-[oklch(0.72_0.15_195_/_0.5)] placeholder-ink-600 ring-accent';
</script>

<svelte:head>
	<title>Neue Klasse anlegen · Lehrer · SbSQLTT</title>
</svelte:head>

<TeacherNav />

<div class="max-w-[640px] mx-auto px-6 py-10 md:py-14">
	<button
		onclick={() => goto('/teach')}
		class="text-[12px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1 mb-3 font-mono"
	>
		← Alle Klassen
	</button>
	<div
		class="text-[12px] font-mono uppercase tracking-[0.16em] text-accent"
	>
		Neue Klasse
	</div>
	<h1
		class="mt-2 text-[28px] md:text-[32px] leading-tight tracking-[-0.02em] font-semibold"
	>
		Klasse anlegen
	</h1>
	<p class="mt-2 text-[13.5px] text-ink-700">
		Geben Sie Ihrer Klasse einen Namen, wählen Sie Tracks aus, und verteilen Sie den Beitritts-Code.
	</p>

	<div class="mt-8 space-y-5">
		<div>
			<label
				for="cls-name"
				class="text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700"
				>Klassenname</label
			>
			<input
				id="cls-name"
				type="text"
				bind:value={name}
				placeholder="z. B. Informatik 9b"
				class={'mt-2 ' + inputCls}
			/>
		</div>

		<div>
			<label
				for="cls-term"
				class="text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700"
			>
				Schulhalbjahr
				<span class="text-ink-600 normal-case font-sans">(optional)</span>
			</label>
			<div class="relative mt-2">
				<select
					id="cls-term"
					bind:value={term}
					class={inputCls + ' pr-8 appearance-none'}
				>
					<option>2025/26 · 1. Halbjahr</option>
					<option>2025/26 · 2. Halbjahr</option>
					<option>2026/27 · 1. Halbjahr</option>
				</select>
				<svg
					class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-600"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</div>
		</div>

		<div>
			<div
				class="text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700"
			>
				Tracks freischalten
			</div>
			<div class="mt-2 grid grid-cols-3 gap-2">
				{#each [['beginner', 'Anfänger', '5 Lektionen'], ['intermediate', 'Fortgeschritten', '5 Lektionen'], ['advanced', 'Profi', '4 Lektionen']] as [key, label, count] (key)}
					{@const on =
						tracks[key as 'beginner' | 'intermediate' | 'advanced']}
					<button
						onclick={() => {
							const k = key as 'beginner' | 'intermediate' | 'advanced';
							tracks = { ...tracks, [k]: !tracks[k] };
						}}
						class={'text-left rounded-md border p-3 transition-colors ' +
							(on
								? 'border-accent bg-accent-soft'
								: 'border-ink-200 bg-ink-100/30 hover:border-ink-300')}
					>
						<div
							class={'text-[13px] font-semibold ' +
								(on ? 'text-accent' : 'text-ink-900')}
						>
							{label}
						</div>
						<div class="text-[11px] font-mono text-ink-600 mt-0.5">
							{count}
						</div>
					</button>
				{/each}
			</div>
			<div class="mt-2 text-[11.5px] text-ink-600">
				Voreingestellt: <span class="font-mono">Anfänger</span>. Sie können
				später mehr Tracks freischalten.
			</div>
		</div>

		<div>
			<div
				class="text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-2"
			>
				Beitritts-Code
			</div>
			<div class="flex items-center gap-2">
				<div
					class="flex-1 h-12 rounded-md border border-ink-200 input-shell px-4 flex items-center font-mono text-[20px] tracking-tight text-ink-900"
				>
					{code}
				</div>
				<Button variant="secondary" size="md" onclick={() => (code = randomCode())}>
					Neu generieren
				</Button>
			</div>
		</div>

		<Surface class="p-3 !bg-ink-100/30">
			<p class="text-[11.5px] leading-relaxed text-ink-700">
				Schüler:innen, die mit diesem Code beitreten, hinterlegen nur einen anonymen
				Benutzernamen. SbSQLTT speichert Lernfortschritt und (optional) eine
				E-Mail-Adresse. Keine sozialen Tracker, keine Drittanbieter-Analytics. Sie können
				alle Daten der Klasse jederzeit exportieren oder löschen.
			</p>
		</Surface>
	</div>

	<div
		class="mt-8 pt-6 border-t border-ink-200 flex items-center justify-between"
	>
		<Button variant="ghost" size="md" onclick={() => goto('/teach')}
			>Abbrechen</Button
		>
		<Button variant="primary" size="md" onclick={() => goto('/teach')}>
			Klasse anlegen →
		</Button>
	</div>
</div>
