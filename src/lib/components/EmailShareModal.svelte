<script lang="ts">
	import type { TeacherClass } from '$lib/teacher-data';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import JoinCodeChip from './JoinCodeChip.svelte';

	let {
		open,
		cls,
		onClose
	}: { open: boolean; cls: TeacherClass; onClose: () => void } = $props();

	let emails = $state('');
	let subject = $state('');
	let message = $state('');
	let sent = $state<'idle' | 'sending' | 'done'>('idle');

	$effect(() => {
		if (!open) return;
		sent = 'idle';
		emails = '';
		subject = `Einladung zur Klasse ${cls.name}`;
		message = `Hallo,

ich richte gerade unsere Klasse auf SbSQLTT ein — eine Plattform, mit der wir gemeinsam SQL üben werden.

So tritt ihr bei:
1. Geht auf sbsqltt.de
2. Tippt auf „Einer Klasse beitreten"
3. Gebt den Code ${cls.joinCode} ein

Ihr braucht kein eigenes Konto. Bitte tut das bis zur nächsten Stunde, damit wir direkt mit der ersten Lektion loslegen können.

Bis bald,
Frau Hartmann`;
	});

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	let recipients = $derived(
		emails
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter(Boolean)
	);
	let validRecipients = $derived(
		recipients.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
	);
	let invalidCount = $derived(recipients.length - validRecipients.length);
	let canSend = $derived(validRecipients.length > 0);

	function send() {
		if (!canSend) return;
		sent = 'sending';
		setTimeout(() => (sent = 'done'), 600);
	}
</script>

{#if open}
	<div
		class="ms-overlay fade-in"
		role="dialog"
		aria-modal="true"
		aria-labelledby="share-email-title"
	>
		<button
			aria-label="Schließen"
			class="absolute inset-0 bg-black/55 backdrop cursor-default"
			onclick={onClose}
		></button>
		<div class="ms-card ms-w-md">
			<span class="ms-handle"></span>
			<div>
				<div class="flex items-start justify-between p-6 border-b border-ink-200">
					<div>
						<div
							class="text-[11px] font-mono uppercase tracking-[0.14em] text-accent"
						>
							Teilen
						</div>
						<h2
							id="share-email-title"
							class="mt-1 text-[20px] font-semibold tracking-tight text-ink-900"
						>
							{sent === 'done' ? 'Einladungen versendet' : 'Beitritts-Code teilen'}
						</h2>
					</div>
					<button
						onclick={onClose}
						class="w-8 h-8 grid place-items-center rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100"
						aria-label="Schließen"
					>
						<Icon name="close" size={14} />
					</button>
				</div>

				{#if sent === 'done'}
					<div class="p-6">
						<div class="flex items-start gap-3">
							<span
								class="shrink-0 mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full text-ok"
								style="background: oklch(0.72 0.13 150 / 0.15);"
							>
								<Icon name="check" size={18} sw={2.4} />
							</span>
							<div class="flex-1">
								<p class="text-[15px] text-ink-900">
									<span class="font-mono">{validRecipients.length}</span>
									{validRecipients.length === 1 ? 'Einladung' : 'Einladungen'} versendet.
								</p>
								<p class="mt-1 text-[13px] text-ink-700">
									Sobald die ersten Schüler:innen beitreten, erscheinen sie in der Matrix.
								</p>
								<details class="mt-3">
									<summary
										class="text-[12px] font-mono text-ink-600 cursor-pointer hover:text-ink-900"
									>
										Empfänger anzeigen
									</summary>
									<ul class="mt-2 space-y-0.5">
										{#each validRecipients as e (e)}
											<li class="text-[12px] font-mono text-ink-700">{e}</li>
										{/each}
									</ul>
								</details>
							</div>
						</div>
						<div class="mt-6 flex justify-end">
							<Button variant="primary" size="md" onclick={onClose}>Schließen</Button>
						</div>
					</div>
				{:else}
					<div class="p-6 space-y-5">
						<div
							class="flex items-center justify-between gap-3 rounded-md bg-ink-100/40 border border-ink-200 p-3"
						>
							<div class="min-w-0">
								<div
									class="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-600"
								>
									Code für {cls.name}
								</div>
								<div
									class="mt-1 text-[20px] font-mono tracking-tight text-ink-900"
								>
									{cls.joinCode}
								</div>
							</div>
							<JoinCodeChip code={cls.joinCode} size="sm" />
						</div>

						<p class="text-[13px] text-ink-700">
							Ich schicke jetzt eine Einladungs-Mail an die Klasse.
						</p>

						<div>
							<label
								for="se-emails"
								class="block text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
							>
								E-Mail-Adressen
							</label>
							<textarea
								id="se-emails"
								rows={3}
								bind:value={emails}
								placeholder="max.mustermann@goethe.de, anna.schmidt@goethe.de …"
								class="w-full px-3 py-2 rounded-md input-shell text-[13px] leading-[20px] font-mono border border-ink-200 focus:border-[oklch(0.72_0.15_195_/_0.5)] placeholder-ink-600 ring-accent resize-none"
							></textarea>
							<div
								class="mt-1.5 flex items-center justify-between text-[11.5px] font-mono"
							>
								<span class={canSend ? 'text-accent' : 'text-ink-600'}>
									{validRecipients.length}
									{validRecipients.length === 1 ? 'Adresse' : 'Adressen'} erkannt
								</span>
								{#if invalidCount > 0}
									<span class="text-err">
										{invalidCount} ungültig
									</span>
								{/if}
							</div>
						</div>

						<div>
							<label
								for="se-subject"
								class="block text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
							>
								Betreff
							</label>
							<input
								id="se-subject"
								type="text"
								bind:value={subject}
								class="w-full h-10 px-3 rounded-md input-shell text-[14px] border border-ink-200 focus:border-[oklch(0.72_0.15_195_/_0.5)] ring-accent"
							/>
						</div>

						<div>
							<label
								for="se-msg"
								class="block text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700 mb-1.5"
							>
								Nachricht
							</label>
							<textarea
								id="se-msg"
								rows={9}
								bind:value={message}
								class="w-full px-3 py-2 rounded-md input-shell text-[13px] leading-[20px] border border-ink-200 focus:border-[oklch(0.72_0.15_195_/_0.5)] ring-accent resize-none"
							></textarea>
						</div>

						<p class="text-[11.5px] text-ink-600 leading-relaxed">
							Die E-Mail wird über unseren Versand verschickt. Eingegebene Adressen
							werden danach nicht gespeichert.
						</p>
					</div>

					<div
						class="p-5 border-t border-ink-200 flex items-center justify-between gap-3 flex-wrap"
					>
						<Button variant="ghost" size="md" onclick={onClose} class="tap">Abbrechen</Button>
						{#if canSend}
							<Button
								variant="primary"
								size="md"
								onclick={send}
								disabled={sent === 'sending'}
								class="tap"
							>
								{sent === 'sending'
									? 'Senden…'
									: `Einladung senden${validRecipients.length > 1 ? ` (${validRecipients.length})` : ''}`}
							</Button>
						{:else}
							<span class="text-[12.5px] text-ink-600">
								Mindestens eine E-Mail-Adresse eingeben.
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
