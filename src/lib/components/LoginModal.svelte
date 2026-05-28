<script lang="ts">
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	let email = $state('');
	let status = $state<'idle' | 'sending' | 'sent'>('idle');
	let touched = $state(false);
	let inputRef = $state<HTMLInputElement>();

	let valid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

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
			class="relative w-full max-w-[420px] rounded-xl bg-ink-50 border border-ink-200 shadow-pop p-7"
		>
			<button
				aria-label="Close"
				onclick={onClose}
				class="absolute top-3 right-3 w-7 h-7 grid place-items-center rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100"
			>
				<Icon name="close" size={14} />
			</button>

			<div class="flex items-center gap-2">
				<Logo size={12} />
			</div>

			<h2
				id="login-title"
				class="mt-5 text-[20px] font-semibold tracking-tight text-ink-900"
			>
				{status === 'sent' ? 'Check your email.' : 'Sign in to save your progress.'}
			</h2>
			<p
				class="mt-2 text-[13.5px] leading-relaxed text-ink-700"
				style="text-wrap: pretty"
			>
				{#if status === 'sent'}
					We sent a magic link to <span class="font-mono text-ink-900">{email}</span>. Open
					it on this device to finish signing in.
				{:else}
					We use a magic link — no password to remember. You can keep using SbSQLTT
					without an account too.
				{/if}
			</p>

			{#if status !== 'sent'}
				<form onsubmit={submit} class="mt-6">
					<label
						for="email"
						class="block text-[12px] font-mono uppercase tracking-[0.14em] text-ink-700"
					>
						Email
					</label>
					<div class="mt-2 relative">
						<input
							id="email"
							bind:this={inputRef}
							type="email"
							autocomplete="email"
							bind:value={email}
							onblur={() => (touched = true)}
							placeholder="you@school.edu"
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
							Enter a valid email address.
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
						{status === 'sending' ? 'Sending link…' : 'Send me a magic link'}
					</Button>

					<p class="mt-4 text-[11.5px] leading-relaxed text-ink-600">
						We only store the email you sign in with and an opaque progress record. No
						tracking, no third-party analytics, no marketing emails — ever.
					</p>
				</form>
			{/if}

			{#if status === 'sent'}
				<div class="mt-6 flex items-center justify-between">
					<Button variant="ghost" size="md" onclick={() => (status = 'idle')}>
						Use a different email
					</Button>
					<Button variant="secondary" size="md" onclick={onClose}>Close</Button>
				</div>
			{/if}
		</div>
	</div>
{/if}
