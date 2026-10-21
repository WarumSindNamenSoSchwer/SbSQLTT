<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import TopNav from '$lib/tabula/TopNav.svelte';

	// Theme
	let dark = $state(false);
	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => mo.disconnect();
	});

	// Formularfelder
	let name = $state('');
	let email = $state('');
	let schule = $state('');
	let nachricht = $state('');

	// Honeypot (fuer Menschen unsichtbar, versteckt per CSS)
	let website = $state('');
	// Zeitstempel des Seitenladens (Zeitfalle gegen Bots)
	let loadedAt = $state(0);
	onMount(() => { loadedAt = Date.now(); });

	// Zustandsmaschine
	type View = 'form' | 'success' | 'error';
	let view = $state<View>('form');
	let serverError = $state<string | null>(null);
	let busy = $state(false);
	let touched = $state(false);

	// Validierung
	const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

	const nameErr = $derived(touched && !name.trim());
	const emailErr = $derived(touched && !validEmail(email));
	const nachrichtErr = $derived(touched && (nachricht.trim().length < 10 || nachricht.trim().length > 5000));

	async function submit(e: Event) {
		e.preventDefault();
		touched = true;
		serverError = null;

		if (nameErr || emailErr || nachrichtErr) return;

		busy = true;
		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					email: email.trim(),
					schule: schule.trim() || undefined,
					nachricht: nachricht.trim(),
					website,   // Honeypot
					t: loadedAt,
				}),
			});

			if (res.ok) {
				view = 'success';
			} else {
				const json = await res.json().catch(() => ({}));
				serverError = (json as { error?: string }).error
					?? 'Nachricht konnte nicht gesendet werden. Bitte schreib direkt an kontakt@tabulasql.de.';
				view = 'error';
			}
		} catch {
			serverError = 'Nachricht konnte nicht gesendet werden. Bitte schreib direkt an kontakt@tabulasql.de.';
			view = 'error';
		} finally {
			busy = false;
		}
	}

	function tryAgain() {
		view = 'form';
		serverError = null;
		touched = false;
	}
</script>

<svelte:head><title>Kontakt · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<main class="center">
		<div class="form-wrap">

			{#if view === 'success'}
				<!-- Erfolgszustand -->
				<div class="title-block">
					<h1>Nachricht gesendet!</h1>
					<p class="sub">Wir haben deine Nachricht erhalten und melden uns so schnell wie möglich.</p>
				</div>
				<div class="ok-banner" role="status">
					<span class="ok-ico">✓</span>
					<span>Vielen Dank. Wir melden uns per E-Mail bei dir.</span>
				</div>

			{:else if view === 'error'}
				<!-- Fehlerzustand -->
				<div class="title-block">
					<h1>Kontakt</h1>
				</div>
				<div class="err-banner" role="alert">
					<span class="err-ico">!</span>
					<span>{serverError}</span>
				</div>
				<button type="button" class="btn-secondary" onclick={tryAgain}>
					Erneut versuchen
				</button>

			{:else}
				<!-- Formular -->
				<div class="title-block">
					<h1>Kontakt</h1>
					<p class="sub">Schreib uns – wir antworten per E-Mail.</p>
				</div>

				{#if serverError}
					<div class="err-banner" role="alert">
						<span class="err-ico">!</span>
						{serverError}
					</div>
				{/if}

				<form onsubmit={submit} novalidate>
					<!-- Honeypot: Robots fuellen dieses Feld aus, Menschen sehen es nicht -->
					<div class="hp" aria-hidden="true">
						<label for="website">Website</label>
						<input id="website" name="website" type="text" tabindex="-1" autocomplete="off" bind:value={website} />
					</div>

					<div class="field">
						<label for="kf-name">Name <span class="req">*</span></label>
						<input
							id="kf-name"
							type="text"
							autocomplete="name"
							placeholder="Dein Name"
							maxlength="100"
							class:err={nameErr}
							disabled={busy}
							bind:value={name}
						/>
						{#if nameErr}
							<span class="field-hint err-hint">Bitte gib deinen Namen ein.</span>
						{/if}
					</div>

					<div class="field">
						<label for="kf-email">E-Mail <span class="req">*</span></label>
						<input
							id="kf-email"
							type="email"
							autocomplete="email"
							placeholder="deine@email.de"
							maxlength="254"
							class:err={emailErr}
							disabled={busy}
							bind:value={email}
						/>
						{#if emailErr}
							<span class="field-hint err-hint">Bitte gib eine gültige E-Mail-Adresse ein.</span>
						{/if}
					</div>

					<div class="field">
						<div class="label-row">
							<label for="kf-schule">Schule</label>
							<span class="opt-label">optional</span>
						</div>
						<input
							id="kf-schule"
							type="text"
							autocomplete="organization"
							placeholder="z. B. Muster-Gymnasium Berlin"
							maxlength="150"
							disabled={busy}
							bind:value={schule}
						/>
					</div>

					<div class="field">
						<label for="kf-nachricht">Nachricht <span class="req">*</span></label>
						<textarea
							id="kf-nachricht"
							rows="6"
							placeholder="Deine Nachricht (mind. 10 Zeichen, max. 5000)"
							maxlength="5000"
							class:err={nachrichtErr}
							disabled={busy}
							bind:value={nachricht}
						></textarea>
						{#if nachrichtErr}
							<span class="field-hint err-hint">
								{nachricht.trim().length < 10 ? 'Die Nachricht ist zu kurz (mind. 10 Zeichen).' : 'Die Nachricht ist zu lang (max. 5000 Zeichen).'}
							</span>
						{/if}
					</div>

					<p class="privacy-hint">
						Mit dem Absenden stimmst du zu, dass deine Angaben zur Bearbeitung deiner Anfrage verarbeitet werden.
						Mehr dazu in der <a href="/datenschutz#kontaktformular">Datenschutzerklärung</a>.
					</p>

					<button type="submit" class="btn-primary" disabled={busy}>
						{busy ? 'Wird gesendet …' : 'Nachricht senden'}
					</button>
				</form>
			{/if}

		</div>
	</main>
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); color: var(--ink); }

	.center {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 64px 20px 80px;
	}

	.form-wrap {
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	/* Honeypot verstecken */
	.hp { position: absolute; left: -9999px; top: -9999px; opacity: 0; pointer-events: none; }

	/* Title */
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	h1 { font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
	.sub { font-size: 15px; line-height: 22px; color: var(--ink-2); margin: 0; }

	/* Banners */
	.err-banner {
		display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 10px;
		border: 1px solid var(--danger-line); background: var(--danger-soft);
		font-size: 14px; line-height: 20px; color: var(--danger-ink);
	}
	.err-ico {
		width: 20px; height: 20px; flex: none; border-radius: 999px;
		background: var(--danger); color: #fff; display: grid; place-items: center;
		font-size: 12px; font-weight: 700; margin-top: 1px;
	}
	.ok-banner {
		display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px;
		border: 1px solid var(--ok-line); background: var(--ok-soft);
		font-size: 14px; line-height: 20px; color: var(--ok-ink);
	}
	.ok-ico {
		width: 20px; height: 20px; flex: none; border-radius: 999px;
		background: var(--ok); color: #fff; display: grid; place-items: center;
		font-size: 12px; font-weight: 700;
	}

	/* Form */
	form { display: flex; flex-direction: column; gap: 18px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	label { font-size: 14px; font-weight: 500; }
	.label-row { display: flex; align-items: baseline; gap: 8px; }
	.label-row label { flex: 1; }
	.opt-label { font-size: 13px; color: var(--ink-3); }
	.req { color: var(--danger-ink); font-weight: 400; }

	input, textarea {
		padding: 10px 12px; border-radius: 6px;
		border: 1px solid var(--line-strong); background: var(--surface);
		font-size: 15px; font-family: inherit; color: var(--ink);
		outline: none; width: 100%; box-sizing: border-box;
		resize: vertical;
	}
	input { height: 44px; }
	input::placeholder, textarea::placeholder { color: var(--ink-3); }
	input:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); border-width: 1.5px; }
	input.err, textarea.err { border-color: var(--danger); border-width: 1.5px; }
	input:disabled, textarea:disabled { opacity: 0.6; cursor: not-allowed; }

	.field-hint { font-size: 13px; line-height: 18px; color: var(--ink-3); }
	.err-hint { color: var(--danger-ink); }

	.privacy-hint { font-size: 13px; line-height: 19px; color: var(--ink-3); margin: 0; }
	.privacy-hint a { color: var(--accent-strong); }
	.privacy-hint a:hover { text-decoration: underline; }

	/* Buttons */
	.btn-primary {
		display: flex; align-items: center; justify-content: center;
		height: 48px; border-radius: 6px; background: var(--accent); color: #fff;
		font-size: 16px; font-weight: 500; cursor: pointer;
		font-family: inherit; width: 100%;
	}
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

	.btn-secondary {
		display: flex; align-items: center; justify-content: center;
		height: 44px; border-radius: 6px; background: var(--subtle);
		border: 1px solid var(--line-strong); color: var(--ink);
		font-size: 15px; font-weight: 500; cursor: pointer;
		font-family: inherit; width: 100%;
	}
	.btn-secondary:hover { background: var(--surface); }

	@media (max-width: 767px) {
		.center { padding: 24px 20px 48px; }
		h1 { font-size: 26px; line-height: 32px; }
		.form-wrap { gap: 16px; }
	}
</style>
