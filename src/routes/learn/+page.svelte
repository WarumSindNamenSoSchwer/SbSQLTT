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
	// (z.B. nach Login mit Server-Merge)
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

	const tracks = $derived(
		TRACK_INFO.map((t, i) => {
			const lessons = CATALOG.filter((l) => l.track === i + 1).map((l) => {
				const st = status(l.id);
				const hl = l.id === hlId && st !== 'locked';
				const started = st === 'started';
				return {
					...l,
					st,
					hl,
					hlLabel: started ? 'WEITER MIT' : anyProgress ? 'ALS NÄCHSTES' : 'STARTE HIER',
					cta: hl ? (started ? 'Weiter' : anyProgress ? 'Starten' : 'Los geht’s') : '',
					stepInfo: hl && started && progress[l.id]?.of ? `Schritt ${progress[l.id].step} von ${progress[l.id].of}` : '',
					focus: klasse?.focus?.id === l.id
				};
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
</script>

<svelte:head><title>Lektionen · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />
	<main class="wrap">
		<div class="inner">
			<div class="head">
				<h1 class="h1">Lektionen</h1>
				<span class="sub">Von der ersten Abfrage bis zur eigenen Datenanalyse mit Python.</span>
			</div>

			{#if !session.user}
				<div class="guest">
					<span class="gi">i</span>
					<span class="gt">Dein Fortschritt wird nur in diesem Browser gespeichert. Melde dich an, um ihn zu sichern.</span>
					<a class="ga" href="/login">Anmelden</a>
				</div>
			{:else if klasse?.focus}
				{@const f = CATALOG.find((l) => l.id === klasse?.focus?.id)}
				{#if f}
					<div class="focus">
						<Edgar pose="curious" {dark} class="focus-owl" />
						<div class="ftxt">
							<span class="lbl" style="color:var(--accent-ink)">FOKUS · KLASSE {klasse.name.toUpperCase()}</span>
							<span class="ft">Deine Klasse arbeitet gerade an: {f.title}</span>
							<span class="fs">Lektion {f.n} · ca. {f.dur} · Klasse {klasse.name}</span>
						</div>
						<a class="btn primary" href={href(f)}>Öffnen<span class="arr"></span></a>
					</div>
				{/if}
			{/if}

			{#each tracks as t}
				<section class="track">
					<div class="thead">
						<span class="tnum mono">{t.num}</span>
						<div class="tname"><span class="h2">{t.name}</span><span class="tdesc">{t.desc}</span></div>
						<div class="tprog"><span class="mono">{t.progress}</span><span class="bar"><span style="width:{t.pct}"></span></span></div>
					</div>
					<div class="list">
						{#each t.lessons as l}
							{@const locked = l.st === 'locked'}
							<a
								class="row"
								class:locked
								class:hl={l.hl}
								href={locked ? undefined : href(l)}
								aria-disabled={locked}
								title={locked ? 'Von deiner Lehrkraft noch nicht freigeschaltet' : undefined}
								onclick={(e) => pending(e, l.id)}
							>
								<span class="n mono">{l.n}</span>
								<span class="ttl">
									{#if l.hl}<span class="hll mono">{l.hlLabel}</span>{/if}
									<span class="tt">{l.title}</span>
									{#if l.stepInfo}<span class="si">{l.stepInfo}</span>{/if}
									<span class="mdur">{l.dur}</span>
								</span>
								{#if l.focus}<span class="fbadge">★ Fokus</span>{/if}
								<span class="dur">{l.dur}</span>
								<span class="stw">
									{#if l.st === 'done'}<span class="b ok">✓ Fertig</span>
									{:else if l.st === 'started'}<span class="b acc">◐ Begonnen</span>
									{:else if l.st === 'open'}<span class="b open">○ Offen</span>
									{:else}<span class="b lock"><span class="lk"><span></span><span></span></span>Gesperrt</span>{/if}
								</span>
								{#if l.cta}<span class="btn primary cta">{l.cta}<span class="arr"></span></span>
								{:else if !locked}<span class="chev">›</span>
								{:else}<span class="chev"></span>{/if}
								{#if tip === l.id}<span class="tooltip">Diese Lektion ist bald verfügbar.</span>{/if}
							</a>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</main>
</div>

<style>
	.page { min-height: 100dvh; display: flex; flex-direction: column; }
	.wrap { display: flex; justify-content: center; padding: 48px 40px 72px; }
	.inner { width: 960px; max-width: 100%; display: flex; flex-direction: column; gap: 28px; }
	.head { display: flex; flex-direction: column; gap: 6px; }
	.h1 { margin: 0; font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; }
	.sub { font-size: 16px; color: var(--ink-2); }
	.h2 { font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -0.01em; }

	.guest { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); font-size: 14px; line-height: 20px; }
	.gi { width: 22px; height: 22px; flex: none; border-radius: 999px; background: var(--subtle); color: var(--ink-2); display: grid; place-items: center; font-size: 12px; font-weight: 600; line-height: 1; }
	.gt { flex: 1; color: var(--ink-2); }
	.ga { font-weight: 500; color: var(--accent-strong) !important; }

	.focus { display: flex; align-items: center; gap: 18px; padding: 16px 20px; border-radius: 10px; border: 1px solid var(--accent-line); background: var(--accent-soft); }
	:global(.tb .focus-owl) { width: 62px; height: 56px; flex: none; }
	.ftxt { flex: 1; display: flex; flex-direction: column; gap: 2px; }
	.ft { font-size: 18px; line-height: 26px; font-weight: 600; }
	.fs { font-size: 14px; color: var(--ink-2); }

	.track { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
	.thead { display: flex; align-items: flex-end; gap: 16px; }
	.tnum { font-size: 13px; color: var(--accent-strong); line-height: 32px; align-self: flex-start; }
	.tname { flex: 1; display: flex; flex-direction: column; }
	.tdesc { font-size: 14px; color: var(--ink-2); }
	.tprog { display: flex; align-items: center; gap: 10px; padding-bottom: 3px; }
	.tprog .mono { font-size: 12px; color: var(--ink-3); }
	.bar { width: 120px; height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; display: block; }
	.bar span { display: block; height: 100%; background: var(--accent); }

	.list { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.row { position: relative; display: flex; align-items: center; gap: 16px; min-height: 60px; padding: 0 20px; border-bottom: 1px solid var(--line); }
	.row:last-child { border-bottom: 0; }
	.row:not(.locked):hover { background: var(--subtle); }
	.row:first-child { border-radius: 10px 10px 0 0; }
	.row:last-child { border-radius: 0 0 10px 10px; }
	.row.locked { cursor: default; }
	.row.hl::before { content: ''; position: absolute; inset: -1px; border: 2px solid var(--accent); border-radius: 8px; pointer-events: none; }
	.n { font-size: 13px; color: var(--ink-3); width: 24px; }
	.ttl { flex: 1; min-width: 0; display: flex; flex-direction: column; }
	.hll { font-size: 11px; letter-spacing: 0.06em; color: var(--accent-strong); line-height: 16px; }
	.tt { font-size: 16px; line-height: 24px; font-weight: 500; }
	.si { font-size: 13px; line-height: 18px; color: var(--ink-2); }
	.mdur { display: none; }
	.fbadge { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--accent-line); color: var(--accent-ink); font-size: 12px; font-weight: 500; }
	.dur { font-size: 13px; color: var(--ink-3); width: 64px; text-align: right; }
	.stw { width: 128px; display: flex; justify-content: flex-end; }
	.b { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
	.b.ok { background: var(--ok-soft); color: var(--ok-ink); }
	.b.acc { background: var(--accent-soft); color: var(--accent-ink); }
	.b.open { border: 1px solid var(--line); color: var(--ink-2); }
	.b.lock { gap: 7px; background: var(--subtle); color: var(--ink-3); }
	.lk { display: flex; flex-direction: column; align-items: center; }
	.lk span:first-child { width: 6px; height: 4px; border: 1.5px solid currentColor; border-bottom: 0; border-radius: 4px 4px 0 0; }
	.lk span:last-child { width: 10px; height: 7px; border-radius: 2px; background: currentColor; }
	.btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 6px; font-size: 15px; font-weight: 500; white-space: nowrap; }
	.btn.primary { background: var(--accent); color: #fff !important; }
	.btn.primary:hover { background: var(--accent-strong); }
	.cta { height: 40px; padding: 0 16px; }
	.chev { width: 16px; color: var(--ink-3); }
	.tooltip { position: absolute; right: 256px; top: 50%; transform: translateY(-50%); padding: 6px 10px; border-radius: 6px; background: #0f172a; color: #fff; font-size: 13px; line-height: 18px; white-space: nowrap; z-index: 2; }
	:global(html:not(.light)) .tooltip { background: #e2e8f0; color: #0f172a; }

	@media (max-width: 767px) {
		.page { font-size: 15px; line-height: 24px; }
		.wrap { padding: 24px 16px 40px; }
		.inner { gap: 18px; }
		.head { gap: 4px; }
		.h1 { font-size: 28px; line-height: 34px; letter-spacing: -0.01em; }
		.sub { font-size: 14px; line-height: 20px; }
		.guest { flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px 14px; }
		.gi { display: none; }
		.focus { flex-direction: column; align-items: stretch; gap: 10px; padding: 14px; }
		:global(.tb .focus-owl) { display: none; }
		.ft { font-size: 16px; line-height: 22px; }
		.fs { display: none; }
		.focus .btn { justify-content: center; height: 48px; font-size: 16px; }
		.track { gap: 8px; margin-top: 6px; }
		.thead { align-items: baseline; gap: 10px; }
		.tnum { font-size: 12px; line-height: normal; align-self: auto; }
		.h2 { font-size: 18px; line-height: 26px; }
		.tdesc, .bar { display: none; }
		.tprog { padding: 0; }
		.row { gap: 12px; min-height: 56px; padding: 6px 14px; }
		.n { font-size: 12px; width: 20px; }
		.hll { font-size: 10px; line-height: 14px; }
		.tt { font-size: 15px; line-height: 21px; }
		.si, .dur, .fbadge, .cta, .chev { display: none; }
		.mdur { display: block; font-size: 12px; line-height: 17px; color: var(--ink-3); }
		.stw { width: auto; }
		.b { height: auto; padding: 0; background: none !important; border: 0 !important; }
		.b.ok { color: var(--ok-ink); }
		.b.acc { color: var(--accent-ink); }
		.b.open { color: var(--ink-3); }
		.lk { display: none; }
		.tooltip { right: 14px; top: auto; bottom: -32px; transform: none; }
	}
</style>
