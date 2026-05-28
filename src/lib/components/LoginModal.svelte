<script lang="ts">
	import { goto } from '$app/navigation';
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	type Role = 'student' | 'teacher';

	let role = $state<Role>('student');
	let email = $state('');
	let status = $state<'idle' | 'sending' | 'sent'>('idle');
	let touched = $state(false);
	let inputRef = $state<HTMLInputElement>();

	let valid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
	let isTeacher = $derived(role === 'teacher');

	$effect(() => {
		if (open) {
			status = 'idle';
			email = '';
			touched = false;
			setTimeout(() => inputRef?.focus(), 50);
		}
	});

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		touched = true;
		if (!valid) return;
		status = 'sending';
		setTimeout(() => (status = 'sent'), 900);
	}

	function enterTeacherPreview() {
		onClose();
		goto('/teach');
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 grid place-items-center px-4 fade-in"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="dialog"
		aria-modal="true"
		aria-labelledby="login-title"
		tabindex="-1"
	>
		<div class="absolute inset-0 bg-black/55 backdrop"></div>

		<div
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="document"
			tabindex="-1"
			class="relative w-full max-w-[440px] rounded-xl bg-ink-50 border border-ink-200 shadow-pop p-7"
		>
			<button
				aria-label="Schließen"
				onclick={onClose}
				class="absolute top-3 right-3 w-7 h-7 grid place-items-center rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100"
			>
				<Icon name="close" size={14} />
			</button>

			<div class="flex items-center gap-2">
				<Logo size={12} />
			</div>

			<!-- role switch -->
			{#if status !== 'sent'}
				<div
					role="tablist"
					aria-label="Rolle auswählen"
					class="mt-5 inline-flex items-center bg-ink-100 border border-ink-200 rounded-md p-0.5 text-[12.5px]"
				>
					<button
						role="tab"
						aria-selected={role === 'student'}
						onclick={() => (role = 'student')}
						class={'px-3 h-7 rounded-[5px] ' +
							(role === 'student'
								? 'bg-ink-50 text-ink-900 shadow-soft border border-ink-200'
								: 'text-ink-700 hover:text-ink-900')}
					>
						Schüler:in
					</button>
					<button
						role="tab"
						aria-selected={role === 'teacher'}
						onclick={() => (role = 'teacher')}
						class={'px-3 h-7 rounded-[5px] ' +
							(role === 'teacher'
								? 'bg-ink-50 text-ink-900 shadow-soft border border-ink-200'
								: 'text-ink-700 hover:text-ink-900')}
					>
						Lehrkraft
					</button>
				</div>
			{/if}

			<h2
				id="login-title"
				class="mt-5 text-[20px] font-semibold tracking-tight text-ink-900"
			>
				{#if status === 'sent'}
					Bitte E-Mail prüfen.
				{:else if isTeacher}
					Als Lehrkraft anmelden.
				{:else}
					Anmelden, um deinen Fortschritt zu sichern.
				{/if}
			</h2>
			<p
				class="mt-2 text-[13.5px] leading-relaxed text-ink-700"
				style="text-wrap: pretty"
			>
				{#if status === 'sent'}
					Wir haben einen Magic Link an <span class="font-mono text-ink-900">{email}</span>
					geschickt. Öffnen Sie ihn auf diesem Gerät, um die Anmeldung abzuschließen.
				{:else if isTeacher}
					Mit Ihrer dienstlichen E-Mail anmelden. Wir verwenden einen Magic Link, kein
					Passwort.
				{:else}
					Wir verwenden einen Magic Link. Du musst dir also kein Passwort merken und kannst
					SbSQLTT auch ohne Konto weiter nutzen.
				{/if}
			</p>

			{#if status !== 'sent'}
				<form onsubmit={submit} class="mt-6">
					<label
						for="email"
						class="block text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700"
					>
						E-Mail
					</label>
					<div class="mt-2 relative">
						<input
							id="email"
							bind:this={inputRef}
							type="email"
							autocomplete="email"
							bind:value={email}
							onblur={() => (touched = true)}
							placeholder={isTeacher ? 'sie@schule.de' : 'du@schule.de'}
							class={'w-full h-10 pl-10 pr-3 rounded-md bg-ink-100/40 text-[14px] ' +
								'placeholder-ink-600 ring-accent ' +
								(touched && !valid
									? 'border border-[oklch(0.55_0.18_25_/_0.6)]'
									: 'border border-ink-200 focus:border-[oklch(0.72_0.15_195_/_0.5)]')}
						/>
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-600">
							<Icon name="mail" size={14} />
						</span>
					</div>
					{#if touched && !valid}
						<div class="mt-2 text-[12px] text-err font-mono">
							Bitte eine gültige E-Mail-Adresse eingeben.
						</div>
					{/if}

					<Button
						type="submit"
						variant="primary"
						size="lg"
						class="mt-4 w-full"
						disabled={status === 'sending'}
					>
						{#snippet trailing()}
							{#if status !== 'sending'}<Icon name="arrow" size={14} />{/if}
						{/snippet}
						{status === 'sending' ? 'Link wird gesendet…' : 'Magic Link senden'}
					</Button>

					{#if isTeacher}
						<button
							type="button"
							onclick={enterTeacherPreview}
							class="mt-3 w-full h-9 inline-flex items-center justify-center gap-1.5 text-[13px] text-ink-700 hover:text-ink-900 ring-accent rounded-md"
						>
							Während der Alpha ohne Anmeldung in den Lehrer-Bereich
							<Icon name="arrow" size={12} />
						</button>
					{/if}

					<p class="mt-4 text-[11.5px] leading-relaxed text-ink-600">
						{#if isTeacher}
							Wir speichern nur die E-Mail Ihres Lehrer-Kontos und die Daten der von
							Ihnen angelegten Klassen. Kein Tracking, keine Drittanbieter-Analyse.
						{:else}
							Wir speichern nur die E-Mail, mit der du dich anmeldest, und einen
							anonymen Fortschrittseintrag. Kein Tracking, keine
							Drittanbieter-Analyse, keine Werbe-Mails. Niemals.
						{/if}
					</p>
				</form>
			{/if}

			{#if status === 'sent'}
				<div class="mt-6 flex items-center justify-between">
					<Button variant="ghost" size="md" onclick={() => (status = 'idle')}>
						Andere E-Mail verwenden
					</Button>
					<Button variant="secondary" size="md" onclick={onClose}>Schließen</Button>
				</div>
			{/if}
		</div>
	</div>
{/if}
