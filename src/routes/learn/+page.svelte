<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { CATALOG, TRACK_INFO, LESSONS, EXTRA_PLAYABLE, loadProgress, type Progress } from '$lib/tabula/lessons';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags';
	import { session } from '$lib/tabula/session.svelte';
	import { apiGetClasses } from '$lib/tabula/api';

	// Klassen-Fokus und Sperren: vom Server laden wenn angemeldet und Schueler.
	type KlasseInfo = { name: string; focus?: { id: string }; locked: string[] } | null;
	let klasse = $state<KlasseInfo>(null);

	let progress = $state<Progress>({});
	let dark = $state(false);
	let tip = $state<string | null>(null);

	onMount(() => {
		progress = loadProgress();
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		return () => mo.disconnect();
	});

	// Klassen-Info laden, sobald die Sitzung bekannt ist (nur ACCOUNTS_LIVE + Schüler)
	let klasseFor: number | null = null;
	$effect(() => {
		const u = session.user;
		if (!ACCOUNTS_LIVE || !u || u.role !== 'student') { klasse = null; klasseFor = null; return; }
		if (klasseFor === u.id) return;
		klasseFor = u.id;
		apiGetClasses().then(({ classes }) => {
			if (classes.length === 0) return;
			const cls = classes[0];
			const locked = cls.lessons.filter((l) => !l.unlocked).map((l) => l.lesson_id);
			const focusLesson = cls.lessons.find((l) => l.is_focus);
			klasse = {
				name: cls.name,
				focus: focusLesson ? { id: focusLesson.lesson_id } : cls.focus_lesson ? { id: cls.focus_lesson } : undefined,
				locked
			};
		}).catch(() => { /* Netzwerkfehler ignorieren */ });
	});

	// Fortschritt reaktiv aktualisieren wenn sich der Session-State aendert
	$effect(() => {
		void session.user;
		void session.progressVersion;
		progress = loadProgress();
	});

	type St = 'done' | 'started' | 'open' | 'locked';
	const status = (id: string): St => {
		if (klasse?.locked.includes(id)) return 'locked';
		const p = progress[id];
		if (p?.done) return 'done';
		if (p?.step) return 'started';
		return 'open';
	};
	const anyProgress = $derived(Object.keys(progress).length > 0);
	// Hervorgehoben: erste begonnene Lektion, sonst erste offene. Erstbesuch: Lektion 1.
	const hlId = $derived.by(() => {
		if (!anyProgress) return CATALOG[0].id;
		return (CATALOG.find((l) => status(l.id) === 'started') ?? CATALOG.find((l) => status(l.id) === 'open'))?.id;
	});
	const trackOf = (t: number) => TRACK_INFO[t - 1].id;
	const href = (l: (typeof CATALOG)[number]) => `/learn/${trackOf(l.track)}/${l.id}`;
	const playable = (id: string) => !!LESSONS[id] || EXTRA_PLAYABLE.includes(id);

	// Hero-Karte
	const heroLesson = $derived(CATALOG.find((l) => l.id === hlId));
	const heroStarted = $derived(hlId ? status(hlId) === 'started' : false);
	const heroKicker = $derived(anyProgress ? 'Weiter lernen' : 'Jetzt starten');
	const heroTitle = $derived(heroLesson?.title ?? 'Erste Abfrage mit SELECT');
	const heroCta = $derived(heroStarted ? 'Weitermachen' : anyProgress ? 'Jetzt starten' : 'Jetzt lernen');
	const heroHref = $derived(heroLesson ? href(heroLesson) : '/learn/beginner/select-basics');
	const heroProg = $derived(hlId && progress[hlId]?.of ? progress[hlId] : null);
	const heroPct = $derived(heroProg ? `${Math.round(((heroProg.step ?? 0) / heroProg.of!) * 100)}%` : '0%');
	const heroSteps = $derived(heroProg ? `${heroProg.step ?? 0} / ${heroProg.of}` : '');

	const tracks = $derived(
		TRACK_INFO.map((t, i) => {
			const lessons = CATALOG.filter((l) => l.track === i + 1).map((l) => {
				const st = status(l.id);
				return { ...l, st, focus: klasse?.focus?.id === l.id };
			});
			const done = lessons.filter((l) => l.st === 'done').length;
			return { ...t, lessons, progress: `${done} / ${lessons.length}`, pct: `${Math.round((done / lessons.length) * 100)}%` };
		})
	);
	const pending = (e: MouseEvent, id: string) => {
		if (!playable(id)) {
			e.preventDefault();
			tip = id;
			setTimeout(() => (tip === id ? (tip = null) : null), 2500);
		}
	};

	// Gast-Hinweis (tabula-guest-hint)
	let guestHintClosed = $state(false);
	onMount(() => {
		try {
			guestHintClosed = !!localStorage.getItem('tabula-guest-hint');
		} catch {
			guestHintClosed = false;
		}
	});
	function closeGuestHint() {
		guestHintClosed = true;
		try { localStorage.setItem('tabula-guest-hint', '1'); } catch { /* ignore */ }
	}
</script>

<svelte:head><title>Lektionen · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />
	<main class="wrap">
		<!-- Klassen-Fokus-Banner -->
		{#if klasse?.focus}
			{@const f = CATALOG.find((l) => l.id === klasse?.focus?.id)}
			{#if f}
				<div class="focus-banner">
					<Edgar pose="raisehand" {dark} class="focus-owl" />
					<p class="focus-txt">
						Deine Klasse <strong>{klasse.name}</strong> arbeitet gerade an: <strong>{f.title}</strong>
					</p>
					<a class="focus-open" href={href(f)}>Öffnen
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
					</a>
				</div>
			{/if}
		{/if}

		<!-- Hero-Karte -->
		<section class="hero" aria-label="Weiterlernen">
			<Edgar pose={heroStarted ? 'typing' : anyProgress ? 'point' : 'idle'} {dark} class="hero-owl" />
			<div class="hero-txt">
				<p class="hero-kicker">{heroKicker}</p>
				<h1 class="hero-title">{heroTitle}</h1>
				{#if heroProg}
					<div class="hero-bar-row">
						<div class="hero-bar" role="progressbar" aria-valuemin={0} aria-valuemax={heroProg.of ?? 1} aria-valuenow={heroProg.step ?? 0} aria-label="Fortschritt in der Lektion">
							<div class="hero-bar-fill" style="width:{heroPct}"></div>
						</div>
						<span class="hero-steps mono">{heroSteps}</span>
					</div>
				{/if}
			</div>
			<a class="hero-cta" href={heroHref}>
				{heroCta}
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10.5M8.5 3.5 13 8l-4.5 4.5"></path></svg>
			</a>
		</section>

		<!-- Gast-Hinweis -->
		{#if !session.user && !guestHintClosed}
			<p class="guest-note">
				Fortschritt wird nur in diesem Browser gespeichert. Mit dem Klassencode deiner Lehrkraft kannst du einer <a href="/beitreten">Klasse beitreten</a>.
				<button class="guest-close" onclick={closeGuestHint} aria-label="Hinweis schließen">
					<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"></path></svg>
				</button>
			</p>
		{/if}

		<!-- Tracks (zwei Spalten) -->
		<div class="tracks">
			{#each tracks as t}
				<section class="track" aria-label={t.name}>
					<div class="track-head">
						<h2 class="track-name">{t.name}</h2>
						<span class="track-desc">{t.desc}</span>
						<span class="track-prog mono">{t.progress}</span>
					</div>
					<ol class="lesson-list">
						{#each t.lessons as l}
							{@const locked = l.st === 'locked'}
							{@const done = l.st === 'done'}
							{@const started = l.st === 'started'}
							<li class="lesson-item">
								<button
									type="button"
									class="lesson-row"
									class:locked
									aria-disabled={locked}
									title={locked ? 'Von deiner Lehrkraft noch nicht freigeschaltet' : undefined}
									onclick={(e) => {
										if (locked) return;
										pending(e as MouseEvent, l.id);
										if (playable(l.id)) window.location.href = href(l);
									}}
								>
									<span class="lesson-num mono" class:num-done={done} class:num-open={!done && !locked} class:num-locked={locked}>{l.n}</span>
									<span class="lesson-info">
										<span class="lesson-title" class:muted={locked}>{l.title}</span>
										<span class="lesson-dur">{l.dur}</span>
									</span>
									{#if l.focus}<span class="focus-badge">Fokus</span>{/if}
									<span class="lesson-status" class:status-done={done} class:status-started={started} class:status-locked={locked}>
										{#if locked}
											<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"></rect><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"></path></svg>
											Gesperrt
										{:else if done}
											<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 6.5 12 13 4.5"></path></svg>
											Fertig
										{:else if started}
											Begonnen
										{:else}
											Offen
										{/if}
									</span>
								</button>
								{#if tip === l.id}
									<span class="tooltip">Diese Lektion ist bald verfügbar.</span>
								{/if}
							</li>
						{/each}
					</ol>
				</section>
			{/each}
		</div>
	</main>
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; }
	.wrap { max-width: 1680px; margin: 0 auto; width: 100%; box-sizing: border-box; padding: 32px clamp(16px, 3vw, 48px) 80px; display: flex; flex-direction: column; gap: 24px; }
	.mono { font-family: var(--mono); }

	/* Fokus-Banner */
	.focus-banner { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 18px; border-radius: 12px; background: var(--accent); color: #fff; }
	:global(.tb .focus-owl) { width: 44px; height: 40px; flex: none; }
	.focus-txt { margin: 0; flex: 1 1 260px; font-size: 15px; }
	.focus-open { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 7px; background: #fff; color: #0f172a; text-decoration: none; font-size: 14px; font-weight: 600; }
	.focus-open:hover { background: #eff6ff; }

	/* Hero-Karte */
	.hero { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; padding: 24px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
	:global(.tb .hero-owl) { width: 120px; height: 108px; flex: none; }
	.hero-txt { flex: 1 1 300px; min-width: 0; }
	.hero-kicker { margin: 0 0 4px; font-size: 14px; color: var(--ink-3); }
	.hero-title { margin: 0; font-size: 28px; line-height: 1.2; font-weight: 600; letter-spacing: -0.02em; }
	.hero-bar-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; max-width: 360px; }
	.hero-bar { flex: 1; height: 6px; border-radius: 3px; background: var(--subtle); overflow: hidden; }
	.hero-bar-fill { height: 100%; background: var(--accent); border-radius: 3px; }
	.hero-steps { font-size: 12px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
	.hero-cta { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 20px; border-radius: 9px; background: var(--accent); color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; white-space: nowrap; }
	.hero-cta:hover { background: var(--accent-strong); }

	/* Gast-Hinweis */
	.guest-note { margin: -8px 0 0; font-size: 14px; color: var(--ink-2); display: flex; align-items: center; gap: 8px; }
	.guest-close { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; border: 0; background: transparent; cursor: pointer; color: var(--ink-3); flex: none; }
	.guest-close:hover { background: var(--subtle); }
	.guest-note a { color: var(--accent-ink); }
	.guest-note a:hover { color: var(--accent-strong); }

	/* Tracks-Raster */
	.tracks { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 16px clamp(24px, 3vw, 56px); align-items: start; margin-top: 8px; }
	.track { display: flex; flex-direction: column; margin-top: 16px; }
	.track-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid var(--line-strong); }
	.track-name { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
	.track-desc { font-size: 14px; color: var(--ink-3); flex: 1; }
	.track-prog { font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

	/* Lektionsliste */
	.lesson-list { list-style: none; margin: 0; padding: 0; }
	.lesson-item { border-bottom: 1px solid var(--line); position: relative; }
	.lesson-item:last-child { border-bottom: 0; }
	.lesson-row { width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 16px; min-height: 60px; padding: 10px 12px; border: 0; background: transparent; text-align: left; cursor: pointer; border-radius: 8px; margin: 2px 0; }
	.lesson-row:not(.locked):hover { background: var(--subtle); }
	.lesson-row.locked { cursor: default; }

	/* Nummern-Badge */
	.lesson-num { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 50%; font-size: 13px; font-weight: 600; border: 1.5px solid var(--line-strong); color: var(--ink-3); background: transparent; }
	.lesson-num.num-done { background: var(--ok-soft); color: var(--ok-ink); border-color: var(--ok-line); }
	.lesson-num.num-open { background: var(--accent-soft); color: var(--accent-ink); border-color: var(--accent-line); }
	.lesson-num.num-locked { background: var(--subtle); color: var(--ink-3); border-color: var(--line); }

	.lesson-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
	.lesson-title { font-size: 16px; font-weight: 500; color: var(--ink); }
	.lesson-title.muted { color: var(--ink-3); }
	.lesson-dur { font-size: 13px; color: var(--ink-3); }
	.focus-badge { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; border: 1px solid var(--accent-line); color: var(--accent-ink); font-size: 11px; font-weight: 500; }

	.lesson-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--ink-3); white-space: nowrap; }
	.lesson-status.status-done { color: var(--ok-ink); }
	.lesson-status.status-started { color: var(--accent-ink); }
	.lesson-status.status-locked { color: var(--ink-3); }

	.tooltip { position: absolute; right: 16px; bottom: -30px; padding: 5px 10px; border-radius: 6px; background: #0f172a; color: #fff; font-size: 13px; white-space: nowrap; z-index: 5; pointer-events: none; }
	:global(html:not(.light)) .tooltip { background: var(--surface); color: var(--ink); border: 1px solid var(--line); }

	@media (max-width: 767px) {
		.wrap { padding: 20px 16px 40px; gap: 18px; }
		:global(.tb .hero-owl) { width: 80px; height: 72px; }
		.hero { gap: 16px; padding: 18px; }
		.hero-title { font-size: 20px; }
		.hero-cta { height: 44px; font-size: 14px; }
		.focus-banner { gap: 10px; padding: 12px 14px; }
		:global(.tb .focus-owl) { display: none; }
		.track-desc { display: none; }
		.lesson-row { gap: 12px; min-height: 56px; padding: 8px 10px; }
		.lesson-num { width: 30px; height: 30px; font-size: 12px; }
		.lesson-title { font-size: 15px; }
	}
</style>
