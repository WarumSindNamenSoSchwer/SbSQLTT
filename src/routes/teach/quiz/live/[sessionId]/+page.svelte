<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { quizWsUrl, type WsInMsg } from '$lib/tabula/quiz-api.js';

	let dark = $state(false);
	let ws = $state<WebSocket | null>(null);
	let phase = $state<'connecting' | 'lobby' | 'question' | 'reveal' | 'ended' | 'error'>('connecting');
	let errorMsg = $state('');

	// Lobby
	let participants = $state<string[]>([]);
	let expected = $state<number | null>(null);

	// Frage
	let qIndex = $state(0);
	let qTotal = $state(0); // wird aus lobby_state.count ermittelt -- unbekannt bis session
	let qText = $state('');
	let qCode = $state<string | null>(null);
	let qOptions = $state<string[]>([]);
	let qTimeLimit = $state(0);
	let qId = $state(0);
	let timeLeft = $state(0);

	// Auflösung
	let revealCorrectIdx = $state(0);
	let revealCounts = $state<number[]>([]);
	let rankings = $state<{ rank: number; display_name: string; points: number }[]>([]);

	// Endergebnis
	let finalRankings = $state<{ rank: number; display_name: string; points: number }[]>([]);

	let timer: ReturnType<typeof setInterval> | null = null;

	const sessionId = $derived(Number(page.params.sessionId));

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		const check = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(check, 50); return; }
			if (!session.user) { goto('/login?redirect=/teach/quiz'); return; }
			if (session.user.role !== 'teacher') { goto('/teach'); return; }
			connect();
		};
		check();
		return () => mo.disconnect();
	});

	onDestroy(() => {
		clearInterval(timer ?? undefined);
		ws?.close();
	});

	function connect() {
		const url = quizWsUrl();
		const sock = new WebSocket(url);
		ws = sock;

		sock.addEventListener('open', () => {
			// Lehrkraft tritt mit room_id (= session_id) bei
			sock.send(JSON.stringify({ type: 'teacher_join', room_id: sessionId }));
		});

		sock.addEventListener('message', (ev: MessageEvent) => {
			let msg: WsInMsg;
			try { msg = JSON.parse(ev.data as string); } catch { return; }
			handleMsg(msg);
		});

		sock.addEventListener('close', () => {
			if (phase !== 'ended') { phase = 'error'; errorMsg = 'Verbindung getrennt.'; }
		});

		sock.addEventListener('error', () => {
			phase = 'error'; errorMsg = 'WebSocket-Fehler.';
		});
	}

	function handleMsg(msg: WsInMsg) {
		if (msg.type === 'error') {
			phase = 'error';
			errorMsg = (msg as any).message;
			return;
		}
		if (msg.type === 'joined') {
			// Verbindung bestätigt — Lobby wird gleich danach durch lobby_state gesetzt
			phase = 'lobby';
		}
		if (msg.type === 'lobby_state') {
			phase = 'lobby';
			participants = (msg as any).participants;
			expected = (msg as any).expected ?? null;
		}
		if (msg.type === 'question_start') {
			const m = msg as any;
			phase = 'question';
			qIndex = m.question_index;
			qText = m.question;
			qCode = m.code ?? null;
			qOptions = m.options;
			qTimeLimit = m.time_limit;
			qId = m.question_id;
			timeLeft = m.time_limit;
			rankings = [];
			clearInterval(timer ?? undefined);
			timer = setInterval(() => {
				timeLeft = Math.max(0, timeLeft - 1);
				if (timeLeft === 0) { clearInterval(timer ?? undefined); timer = null; }
			}, 1000);
		}
		if (msg.type === 'reveal') {
			phase = 'reveal';
			revealCorrectIdx = (msg as any).correct_idx;
			revealCounts = (msg as any).answer_counts ?? [];
			clearInterval(timer ?? undefined); timer = null;
		}
		if (msg.type === 'leaderboard') {
			rankings = (msg as any).rankings ?? [];
			finalRankings = rankings;
		}
		if (msg.type === 'quiz_ended') {
			phase = 'ended';
			clearInterval(timer ?? undefined); timer = null;
		}
	}

	function send(msg: object) {
		if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
	}

	const letterLabels = ['A', 'B', 'C', 'D'];
	const qrUrl = $derived(`https://www.tabulasql.de/quiz/${sessionId}`);
</script>

<svelte:head><title>Live-Quiz · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center"><div class="notice">Kommt in Kürze.</div></main>
	{:else if phase === 'connecting'}
		<main class="center"><div class="spinner-wrap"><span class="spinner"></span></div><p class="hint">Verbinde …</p></main>
	{:else if phase === 'error'}
		<main class="center">
			<div class="error-card">
				<p class="err-msg">{errorMsg}</p>
				<a href="/teach/quiz" class="btn-ghost">Zur Fragensatz-Übersicht</a>
			</div>
		</main>
	{:else if phase === 'lobby'}
		<main class="live-main">
			<div class="live-content">
				<div class="lobby-header">
					<div class="pin-block">
						<span class="pin-label">PIN</span>
						<span class="pin-value">{sessionId}</span>
						<span class="pin-url">tabulasql.de/quiz/{sessionId}</span>
					</div>
					<div class="count-block">
						<span class="count-num">{participants.length}</span>
						{#if expected !== null}
							<span class="count-lbl">/ {expected} Schüler</span>
						{:else}
							<span class="count-lbl">Teilnehmer</span>
						{/if}
					</div>
				</div>
				{#if participants.length > 0}
					<div class="participant-chips">
						{#each participants as name}
							<span class="chip">{name}</span>
						{/each}
					</div>
				{/if}
				<button
					class="btn-start-big"
					onclick={() => send({ type: 'next_question' })}
					disabled={participants.length === 0}
				>
					Quiz starten
				</button>
			</div>
		</main>
	{:else if phase === 'question'}
		<main class="live-main">
			<div class="live-content">
				<div class="q-header">
					<span class="q-counter">Frage {qIndex}</span>
					<div class="timer" class:urgent={timeLeft <= 5}>{timeLeft}s</div>
				</div>
				<div class="q-display">
					<p class="q-text">{qText}</p>
					{#if qCode}
						<pre class="q-code">{qCode}</pre>
					{/if}
				</div>
				<div class="opts-grid-2">
					{#each qOptions as opt, i}
						<div class="opt-tile">
							<span class="opt-letter">{letterLabels[i]}</span>
							<span class="opt-text">{opt}</span>
						</div>
					{/each}
				</div>
				<div class="controls">
					<button class="btn-reveal" onclick={() => send({ type: 'reveal' })}>Auflösen</button>
				</div>
			</div>
		</main>
	{:else if phase === 'reveal'}
		<main class="live-main">
			<div class="live-content">
				<h2 class="reveal-title">Auflösung — Richtig: {letterLabels[revealCorrectIdx]}</h2>
				<div class="opts-grid-2">
					{#each qOptions as opt, i}
						<div class="opt-tile" class:correct={i === revealCorrectIdx}>
							<span class="opt-letter">{letterLabels[i]}</span>
							<span class="opt-text">{opt}</span>
							{#if revealCounts[i] !== undefined}
								<span class="opt-count">{revealCounts[i]}×</span>
							{/if}
						</div>
					{/each}
				</div>
				<div class="score-list">
					{#each rankings.slice(0, 8) as s}
						<div class="score-row">
							<span class="score-rank">#{s.rank}</span>
							<span class="score-name">{s.display_name}</span>
							<span class="score-pts">{s.points} Pkt.</span>
						</div>
					{/each}
				</div>
				<div class="controls">
					<button class="btn-next" onclick={() => send({ type: 'next_question' })}>Nächste Frage →</button>
					<button class="btn-end" onclick={() => send({ type: 'end_quiz' })}>Quiz beenden</button>
				</div>
			</div>
		</main>
	{:else if phase === 'ended'}
		<main class="live-main">
			<div class="live-content">
				<h2 class="reveal-title">Endergebnis</h2>
				<div class="score-list">
					{#each finalRankings as s}
						<div class="score-row">
							<span class="score-rank">#{s.rank}</span>
							<span class="score-name">{s.display_name}</span>
							<span class="score-pts">{s.points} Pkt.</span>
						</div>
					{/each}
				</div>
				<div class="controls">
					<a href="/teach/quiz/auswertung/{sessionId}" class="btn-next">Auswertung ansehen</a>
					<a href="/teach/quiz" class="btn-ghost">Zurück zur Übersicht</a>
				</div>
			</div>
		</main>
	{/if}
</div>

<style>
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px 20px; }
	.spinner-wrap { display: grid; place-items: center; padding: 40px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }
	.hint { font-size: 14px; color: var(--ink-3); }
	.error-card { display: flex; flex-direction: column; gap: 16px; padding: 32px; border: 1px solid var(--danger-line); border-radius: 12px; max-width: 420px; text-align: center; }
	.err-msg { color: var(--danger-ink); font-size: 15px; }
	.notice { font-size: 16px; color: var(--ink-2); }
	.live-main { flex: 1; display: flex; justify-content: center; padding: 40px 32px; }
	@media (max-width: 767px) { .live-main { padding: 20px 16px; } }
	.live-content { width: 100%; max-width: 760px; display: flex; flex-direction: column; gap: 24px; }
	.lobby-header { display: flex; align-items: flex-start; gap: 32px; flex-wrap: wrap; }
	.pin-block { display: flex; flex-direction: column; gap: 4px; }
	.pin-label { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: var(--ink-3); text-transform: uppercase; }
	.pin-value { font-size: 56px; font-weight: 700; letter-spacing: 0.12em; color: var(--accent); line-height: 1; }
	.pin-url { font-size: 13px; color: var(--ink-3); font-family: var(--mono); }
	.count-block { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; }
	.count-num { font-size: 48px; font-weight: 700; line-height: 1; }
	.count-lbl { font-size: 14px; color: var(--ink-2); }
	.participant-chips { display: flex; flex-wrap: wrap; gap: 8px; }
	.chip { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 999px; background: var(--subtle); border: 1px solid var(--line); font-size: 13px; }
	.btn-start-big { height: 56px; padding: 0 32px; border-radius: 10px; background: var(--accent); color: #fff; font-size: 18px; font-weight: 600; cursor: pointer; }
	.btn-start-big:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-start-big:disabled { opacity: 0.4; cursor: not-allowed; }
	.q-header { display: flex; align-items: center; justify-content: space-between; }
	.q-counter { font-size: 14px; font-weight: 600; color: var(--ink-3); }
	.timer { font-size: 32px; font-weight: 700; color: var(--accent); }
	.timer.urgent { color: var(--danger-ink); }
	.q-display { display: flex; flex-direction: column; gap: 14px; }
	.q-text { font-size: 24px; font-weight: 600; line-height: 1.35; }
	.q-code { margin: 0; padding: 14px 18px; border-radius: 10px; background: #0f172a; font-family: var(--mono); font-size: 14px; line-height: 22px; overflow-x: auto; color: #e2e8f0; }
	.opts-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	@media (max-width: 600px) { .opts-grid-2 { grid-template-columns: 1fr; } }
	.opt-tile { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
	.opt-tile.correct { border-color: #16a34a; background: #dcfce7; }
	.opt-letter { width: 32px; height: 32px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); font-weight: 700; display: grid; place-items: center; flex: none; }
	.opt-text { flex: 1; font-size: 16px; font-weight: 500; }
	.opt-count { font-size: 13px; color: var(--ink-3); font-weight: 600; }
	.reveal-title { font-size: 28px; font-weight: 600; }
	.score-list { display: flex; flex-direction: column; gap: 8px; }
	.score-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
	.score-rank { width: 36px; font-size: 13px; font-weight: 600; color: var(--ink-3); }
	.score-name { flex: 1; font-size: 15px; font-weight: 500; }
	.score-pts { font-size: 14px; font-weight: 600; color: var(--accent); }
	.controls { display: flex; gap: 12px; flex-wrap: wrap; }
	.btn-reveal, .btn-next { display: inline-flex; align-items: center; height: 48px; padding: 0 24px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; }
	.btn-reveal:hover, .btn-next:hover { background: var(--accent-strong); }
	.btn-end { display: inline-flex; align-items: center; height: 48px; padding: 0 24px; border-radius: 8px; border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 16px; font-weight: 500; cursor: pointer; }
	.btn-end:hover { background: var(--danger-soft); }
	.btn-ghost { display: inline-flex; align-items: center; height: 48px; padding: 0 20px; border-radius: 8px; border: 1px solid var(--line); color: var(--ink-2); font-size: 15px; font-weight: 500; text-decoration: none; cursor: pointer; }
	.btn-ghost:hover { background: var(--subtle); color: var(--ink); }
</style>
