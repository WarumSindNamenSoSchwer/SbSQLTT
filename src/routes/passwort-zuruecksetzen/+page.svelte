<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { apiPasswordReset, ApiError } from '$lib/tabula/api.js';

	let dark = $state(false);
	let token = $state('');
	let newPw = $state('');
	let newPwRepeat = $state('');
	let touched = $state(false);
	let busy = $state(false);
	let serverError = $state<string | null>(null);
	let done = $state(false);

	const pw8ok = $derived(newPw.length >= 8);
	const pwMatch = $derived(newPw.length > 0 && newPw === newPwRepeat);
	const pwErr = $derived(touched && newPw.length < 8);
	const pwRepeatErr = $derived(touched && newPw !== newPwRepeat);

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		token = page.url.searchParams.get('token') ?? '';
		return () => mo.disconnect();
	});

	async function submit(e: Event) {
		e.preventDefault();
		touched = true;
		serverError = null;
		if (newPw.length < 8 || newPw !== newPwRepeat) return;
		if (!token) {
			serverError = 'Ungültiger oder fehlender Token. Bitte fordere einen neuen Link an.';
			return;
		}

		busy = true;
		try {
			await apiPasswordReset(token, newPw);
			done = true;
		} catch (err) {
			if (err instanceof Error) {
				serverError = err.message;
			}
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Passwort zurücksetzen · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="form-wrap">
			{#if done}
				<Edgar pose="success" {dark} class="owl" />
				<div class="title-block">
					<h1>Passwort gesetzt</h1>
					<p class="sub">Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
				</div>
				<div class="ok-banner" role="status">
					<span class="ok-ico">✓</span>
					Passwort erfolgreich geändert.
				</div>
				<a href="/login" class="btn-primary">Jetzt anmelden</a>
			{:else}
				<Edgar pose="thinking" {dark} class="owl" />
				<div class="title-block">
					<h1>Neues Passwort</h1>
					<p class="sub">Gib dein neues Passwort ein.</p>
				</div>

				{#if serverError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						{serverError}
					</div>
				{/if}

				<form onsubmit={submit} novalidate>
					<div class="field">
						<label for="new-pw">Neues Passwort</label>
						<input
							id="new-pw"
							type="password"
							autocomplete="new-password"
							placeholder="••••••••"
							class:err={pwErr}
							disabled={busy}
							bind:value={newPw}
						/>
						{#if touched}
							<div class="rules">
								<span class:ok={pw8ok} class:no={!pw8ok}>{pw8ok ? '✓' : '○'} mind. 8 Zeichen</span>
							</div>
						{/if}
					</div>

					<div class="field">
						<label for="new-pw2">Passwort wiederholen</label>
						<input
							id="new-pw2"
							type="password"
							autocomplete="new-password"
							placeholder="••••••••"
							class:err={pwRepeatErr}
							disabled={busy}
							bind:value={newPwRepeat}
						/>
						{#if touched}
							<div class="rules">
								<span class:ok={pwMatch} class:no={!pwMatch}>{pwMatch ? '✓' : '○'} stimmt überein</span>
							</div>
						{/if}
					</div>

					<button type="submit" class="btn-primary" disabled={busy}>
						{busy ? 'Wird gesetzt …' : 'Passwort setzen'}
					</button>
				</form>

				<p class="foot">Zurück zur <a href="/login" class="link-foot">Anmeldung</a></p>
			{/if}
		</div>
	</main>
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; }
	.center { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 64px 20px 80px; }
	.form-wrap { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 18px; }
	:global(.owl) { width: 88px; height: 79px; display: block; }
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	h1 { font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
	.sub { font-size: 15px; line-height: 22px; color: var(--ink-2); margin: 0; }
	.err-banner { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--danger-line); background: var(--danger-soft); font-size: 14px; line-height: 20px; color: var(--danger-ink); }
	.err-ico { width: 20px; height: 20px; flex: none; border-radius: 999px; background: var(--danger); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
	.ok-banner { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--ok-line); background: var(--ok-soft); font-size: 14px; line-height: 20px; color: var(--ok-ink); }
	.ok-ico { width: 20px; height: 20px; flex: none; border-radius: 999px; background: var(--ok); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
	form { display: flex; flex-direction: column; gap: 18px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	label { font-size: 14px; font-weight: 500; }
	input { height: 44px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 15px; font-family: inherit; color: var(--ink); outline: none; width: 100%; box-sizing: border-box; }
	input::placeholder { color: var(--ink-3); }
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input.err { border-color: var(--danger); border-width: 1.5px; }
	input:disabled { opacity: 0.6; cursor: not-allowed; }
	.rules { display: flex; flex-wrap: wrap; gap: 6px 14px; }
	.rules .ok { font-size: 13px; color: var(--ok-ink); }
	.rules .no { font-size: 13px; color: var(--ink-3); }
	.btn-primary { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; font-family: inherit; width: 100%; text-decoration: none; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
	.foot { font-size: 14px; color: var(--ink-2); text-align: center; margin: 0; }
	.link-foot { font-size: 14px; font-weight: 500; color: var(--accent-strong); }
	.link-foot:hover { text-decoration: underline; }
</style>
