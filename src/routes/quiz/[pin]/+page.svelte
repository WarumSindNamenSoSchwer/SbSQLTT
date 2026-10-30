<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { tok } from '$lib/tabula/highlight.js';
	import { quizWsUrl, type WsInMsg } from '$lib/tabula/quiz-api.js';
	import Edgar from '$lib/edgar/Edgar.svelte';

	// Design-Farben der 4 Antwort-Slots (q1–q4)
	const Q_COLORS = [
		'oklch(0.80 0.13 80)',   // q1 – gelb-orange ▲
		'oklch(0.80 0.10 240)',  // q2 – blau ◆
		'oklch(0.80 0.11 25)',   // q3 – rot-rosa ●
		'oklch(0.80 0.10 155)',  // q4 – grün ■
	];
	const Q_SYMBOLS = ['▲', '◆', '●', '■'];

	type Phase =
		| 'connecting'
		| 'reconnecting'  // E-H3 Verbindung unterbrochen
		| 'lobby'         // E1-H
		| 'question'      // E2-H
		| 'answered'      // E2-H2
		| 'reveal_correct' // E3-H
		| 'reveal_wrong'   // E3-H2
		| 'leaderboard'   // E4-H Zwischenstand
		| 'ended'         // E5-H
		| 'error';

	let ws = $state<WebSocket | null>(null);
	let phase = $state<Phase>('connecting');
	let errorMsg = $state('');
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectAttempts = 0;

	// Sitzungsdaten
	let displayName = $state('');
	let totalPoints = $state(0);

	// Frage
	let qIndex = $state(0);
	let qTotal = $state(0);
	let qText = $state('');
	let qCode = $state<string | null>(null);
	let qOptions = $state<string[]>([]);
	let qTimeLimit = $state(0);
	let qId = $state(0);
	let timeLeft = $state(0);
	let selectedAnswer = $state<number | null>(null);
	let selectedAnswerText = $state('');
	let selectedAnswerIdx = $state<number | null>(null);
	let answerCorrect = $state<boolean | null>(null);
	let earnedPoints = $state(0);
	let correctIdx = $state<number | null>(null);

	// Zwischenstand / Rangliste
	let myRank = $state<number | null>(null);
	let totalParticipants = $state(0);

	let timer: ReturnType<typeof setInterval> | null = null;
	const pin = $derived((page.params.pin ?? '').toUpperCase());

	// Kopfzeile links-Text je Phase
	const headerLeft = $derived(() => {
		if (phase === 'lobby' || phase === 'connecting' || phase === 'reconnecting') return 'QUIZ · JOIN';
		if (phase === 'ended') return 'QUIZ BEENDET';
		if (phase === 'leaderboard') return `NACH FRAGE ${qIndex}`;
		return `FRAGE ${qIndex} / ${qTotal || '…'}`;
	});

	// Punkte rechts (leer in Lobby)
	const headerRight = $derived(() => {
		if (phase === 'lobby' || phase === 'connecting' || phase === 'reconnecting') return '';
		return totalPoints > 0 ? totalPoints.toLocaleString('de-DE') : '';
	});

	onMount(() => {
		const check = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(check, 50); return; }
			if (!session.user) { goto(`/login?redirect=/quiz/${pin}`); return; }
			displayName = session.displayName;
			connect();
		};
		check();
	});

	onDestroy(() => {
		clearInterval(timer ?? undefined);
		clearTimeout(reconnectTimer ?? undefined);
		ws?.close();
	});

	function connect() {
		if (ws) { ws.onclose = null; ws.onerror = null; ws.close(); ws = null; }
		const url = quizWsUrl();
		const sock = new WebSocket(url);
		ws = sock;

		sock.addEventListener('open', () => {
			reconnectAttempts = 0;
			sock.send(JSON.stringify({ type: 'student_join', pin }));
		});

		sock.addEventListener('message', (ev: MessageEvent) => {
			let msg: WsInMsg;
			try { msg = JSON.parse(ev.data as string); } catch { return; }
			handleMsg(msg);
		});

		sock.addEventListener('close', () => {
			if (phase === 'ended') return;
			// Zeige E-H3, reconnecte automatisch
			phase = 'reconnecting';
			scheduleReconnect();
		});

		sock.addEventListener('error', () => {
			if (phase === 'ended') return;
			phase = 'reconnecting';
			scheduleReconnect();
		});
	}

	function scheduleReconnect() {
		clearTimeout(reconnectTimer ?? undefined);
		const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
		reconnectAttempts++;
		reconnectTimer = setTimeout(() => {
			if (phase !== 'ended') connect();
		}, delay);
	}

	function handleMsg(msg: WsInMsg) {
		if (msg.type === 'error') {
			const m = msg as { type: 'error'; code: string; message: string };
			if (m.code === 'login_required') { goto(`/login?redirect=/quiz/${pin}`); return; }
			phase = 'error';
			errorMsg = m.message;
			return;
		}
		if (msg.type === 'joined') {
			phase = 'lobby';
		}
		if (msg.type === 'lobby_state') {
			phase = 'lobby';
		}
		if (msg.type === 'question_start') {
			const m = msg as { type: 'question_start'; question_index: number; question_total: number; question_id: number; question: string; code?: string; options: string[]; time_limit: number; started_at: number };
			phase = 'question';
			qIndex = m.question_index;
			qTotal = m.question_total ?? qTotal;
			qText = m.question;
			qCode = m.code ?? null;
			qOptions = m.options;
			qTimeLimit = m.time_limit;
			qId = m.question_id;
			timeLeft = m.time_limit;
			selectedAnswer = null;
			selectedAnswerText = '';
			selectedAnswerIdx = null;
			answerCorrect = null;
			correctIdx = null;
			clearInterval(timer ?? undefined);
			timer = setInterval(() => {
				timeLeft = Math.max(0, timeLeft - 1);
				if (timeLeft === 0) { clearInterval(timer ?? undefined); timer = null; }
			}, 1000);
		}
		if (msg.type === 'answer_ack') {
			const m = msg as { type: 'answer_ack'; correct: boolean; points: number; total_points: number };
			phase = 'answered';
			answerCorrect = m.correct;
			earnedPoints = m.points;
			totalPoints = m.total_points;
			clearInterval(timer ?? undefined); timer = null;
		}
		if (msg.type === 'reveal') {
			const m = msg as { type: 'reveal'; correct_idx: number; answer_counts: number[]; correct_ratio: number };
			correctIdx = m.correct_idx;
			clearInterval(timer ?? undefined); timer = null;
			if (answerCorrect === true) {
				phase = 'reveal_correct';
			} else if (answerCorrect === false) {
				phase = 'reveal_wrong';
			} else {
				// Nicht geantwortet: zeige Auflösung als "falsch"
				phase = 'reveal_wrong';
			}
		}
		// Schüler bekommen keine Rangliste mit Namen, nur den eigenen Platz
		if (msg.type === 'my_rank') {
			const m = msg as { type: 'my_rank'; rank: number; of: number; points: number };
			myRank = m.rank;
			totalParticipants = m.of;
			totalPoints = m.points;
			// Kommt zusammen mit der Auflösung: „Richtig/Leider falsch“ bleibt sichtbar
			if (phase !== 'reveal_correct' && phase !== 'reveal_wrong') phase = 'leaderboard';
		}
		if (msg.type === 'quiz_ended') {
			phase = 'ended';
			clearInterval(timer ?? undefined); timer = null;
		}
	}

	function sendAnswer(idx: number) {
		if (phase !== 'question' || selectedAnswer !== null) return;
		selectedAnswer = idx;
		selectedAnswerIdx = idx;
		selectedAnswerText = qOptions[idx] ?? '';
		ws?.send(JSON.stringify({ type: 'answer', question_id: qId, chosen_idx: idx }));
	}

</script>

<svelte:head><title>Quiz · Tabula</title></svelte:head>

<div class="tb phone-wrap">
	<!-- Kopfzeile wie im Design -->
	<header class="phone-header">
		<span class="header-left mono">{headerLeft()}</span>
		<span class="header-spacer"></span>
		<span class="header-name">{displayName || ''}</span>
		{#if headerRight()}
			<span class="header-pts mono">{headerRight()}</span>
		{/if}
	</header>

	<main class="phone-main">

		{#if !ACCOUNTS_LIVE}
			<!-- Kommt bald -->
			<div class="msg-center">
				<Edgar pose="idle" style="width:120px;height:108px" />
				<p class="msg-title">Kommt bald</p>
				<p class="msg-body">Die Quiz-Funktion ist in Kürze verfügbar.</p>
			</div>

		{:else if phase === 'connecting'}
			<div class="msg-center">
				<span class="spinner"></span>
				<p class="msg-body">Verbinde …</p>
			</div>

		{:else if phase === 'reconnecting'}
			<!-- E-H3 Verbindung unterbrochen -->
			<div class="msg-center">
				<Edgar pose="loading" style="width:150px;height:135px" />
				<p class="msg-title">Verbindung unterbrochen</p>
				<p class="msg-body">Wir verbinden dich neu … Du bleibst im Quiz.</p>
			</div>

		{:else if phase === 'error'}
			<div class="msg-center">
				<Edgar pose="thinking" style="width:150px;height:135px" />
				<p class="msg-title">{errorMsg}</p>
				<a href="/quiz" class="btn-primary">Anderen PIN eingeben</a>
			</div>

		{:else if phase === 'lobby'}
			<!-- E1-H Lobby -->
			<div class="msg-center">
				<Edgar pose="wave" style="width:150px;height:135px" />
				<p class="msg-title">Du bist drin!</p>
				<p class="msg-body">Warte auf den Start. Deine Lehrkraft startet das Quiz am Beamer.</p>
			</div>

		{:else if phase === 'question' || phase === 'answered'}
			<!-- E2-H Frage / E2-H2 Antwort gespeichert -->
			{#if phase === 'answered'}
				<div class="msg-center">
					<Edgar pose="loading" style="width:150px;height:135px" />
					<p class="msg-title">Antwort gespeichert</p>
					<p class="msg-body">Warte auf die anderen.</p>
					{#if selectedAnswerIdx !== null}
						<div class="pick-pill" style="background:{Q_COLORS[selectedAnswerIdx]}">
							<span class="pick-sym">{Q_SYMBOLS[selectedAnswerIdx]}</span>
							<span class="pick-text mono">{selectedAnswerText}</span>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Frage aktiv -->
				<div class="q-wrap">
					<div class="q-top">
						<h2 class="q-text">{qText}</h2>
						<div class="timer-circle" class:urgent={timeLeft <= 5}>
							<span class="timer-num mono">{timeLeft}</span>
						</div>
					</div>
					{#if qCode}
						<pre class="q-code">{#each qCode.split('\n') as line}<span class="cl">{#each tok(line) as t}<span style="color:{t.c}">{t.t}</span>{/each}</span>
{/each}</pre>
					{/if}
					<div class="opts-list">
						{#each qOptions as opt, i}
							<button
								class="opt-tile"
								style="background:{Q_COLORS[i]}"
								onclick={() => sendAnswer(i)}
								disabled={selectedAnswer !== null}
							>
								<span class="opt-sym">{Q_SYMBOLS[i]}</span>
								<span class="opt-text mono">{opt}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

		{:else if phase === 'reveal_correct'}
			<!-- E3-H Richtig -->
			<div class="result-card result-ok">
				<Edgar pose="success" style="width:150px;height:135px" />
				<p class="result-title" style="color:var(--ok-ink)">Richtig!</p>
				<p class="result-pts" style="color:var(--ok-ink)">+{earnedPoints.toLocaleString('de-DE')} Punkte</p>
				{#if myRank !== null}
					<p class="result-rank" style="color:var(--ink-2)">Platz {myRank}</p>
				{/if}
			</div>

		{:else if phase === 'reveal_wrong'}
			<!-- E3-H2 Falsch -->
			<div class="result-card result-bad">
				<Edgar pose="thinking" style="width:150px;height:135px" />
				<p class="result-title">Leider falsch</p>
				{#if correctIdx !== null}
					<p class="result-body">Richtig war:</p>
					<div class="pick-pill" style="background:{Q_COLORS[correctIdx]}">
						<span class="pick-sym">{Q_SYMBOLS[correctIdx]}</span>
						<span class="pick-text mono">{qOptions[correctIdx]}</span>
					</div>
				{/if}
				{#if myRank !== null}
					<p class="result-rank" style="color:var(--ink-2)">Platz {myRank}</p>
				{/if}
			</div>

		{:else if phase === 'leaderboard'}
			<!-- E4-H Zwischenstand -->
			<div class="msg-center">
				<Edgar pose="idle" style="width:150px;height:135px" />
				{#if myRank !== null}
					<p class="msg-title">Platz {myRank}</p>
					<p class="msg-body">{totalPoints.toLocaleString('de-DE')} Punkte.</p>
				{:else}
					<p class="msg-title">Zwischenstand</p>
					<p class="msg-body">Gleich geht es weiter.</p>
				{/if}
			</div>

		{:else if phase === 'ended'}
			<!-- E5-H Ende -->
			<div class="msg-center">
				<Edgar pose="trophy" style="width:150px;height:135px" />
				{#if myRank !== null}
					<p class="msg-title">Platz {myRank} von {totalParticipants}</p>
				{:else}
					<p class="msg-title">Quiz beendet!</p>
				{/if}
				<p class="msg-body">Gut gemacht. Punkte zählen nur in diesem Quiz.</p>
				<div class="stats-grid">
					<div class="stat-box">
						<span class="stat-val">{totalPoints.toLocaleString('de-DE')}</span>
						<span class="stat-lbl">Punkte</span>
					</div>
				</div>
				<a href="/quiz" class="btn-primary">Weiteres Quiz</a>
			</div>
		{/if}

	</main>
</div>

<style>
	/* Vollbild, kein TopNav – wie im Design */
	:global(body) { background: var(--bg); }
	.phone-wrap {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		font-family: 'IBM Plex Sans', sans-serif;
		background: var(--bg);
		color: var(--ink);
	}

	/* Kopfzeile */
	.phone-header {
		height: 52px;
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 16px;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
		font-size: 13px;
	}
	.header-left { color: var(--ink-3); }
	.header-spacer { flex: 1; }
	.header-name { font-weight: 500; color: var(--ink); }
	.header-pts { color: var(--ink-2); }
	.mono { font-family: 'IBM Plex Mono', monospace; }

	/* Hauptbereich */
	.phone-main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	/* Nachrichten-Center (Lobby, Auflösung, Ende, etc.) */
	.msg-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		padding: 24px;
		text-align: center;
	}
	.msg-title {
		font-size: 26px;
		line-height: 32px;
		font-weight: 600;
		color: var(--ink);
	}
	.msg-title.ok { color: var(--ok-ink); }
	.msg-body {
		font-size: 15px;
		line-height: 22px;
		color: var(--ink-2);
		max-width: 300px;
	}

	/* Gewählte Antwort-Pille */
	.pick-pill {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 12px;
		color: #0f172a;
		width: 100%;
		max-width: 340px;
	}
	.pick-sym { font-size: 22px; }
	.pick-text { font-size: 14px; font-weight: 500; text-align: left; }

	/* Statistik-Grid (Ende) */
	.stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		width: 100%;
		max-width: 340px;
	}
	.stat-box {
		display: flex;
		flex-direction: column;
		padding: 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.stat-val { font-size: 26px; line-height: 32px; font-weight: 600; }
	.stat-lbl { font-size: 13px; color: var(--ink-3); }

	/* Frage-Ansicht */
	.q-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
	}
	.q-top {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.q-text {
		flex: 1;
		font-size: 18px;
		line-height: 24px;
		font-weight: 600;
	}
	.timer-circle {
		width: 48px;
		height: 48px;
		border-radius: 999px;
		border: 4px solid var(--accent);
		display: grid;
		place-items: center;
		flex: none;
	}
	.timer-circle.urgent { border-color: var(--danger); }
	.timer-num {
		font-size: 18px;
		font-weight: 500;
	}

	/* Code-Block */
	.q-code {
		margin: 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: #0f172a;
		color: #e2e8f0;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 13px;
		line-height: 20px;
		overflow-x: auto;
	}
	.cl { display: block; }

	/* Antwort-Kacheln – 4 Zeilen à volle Breite */
	.opts-list {
		flex: 1;
		display: grid;
		grid-template-rows: repeat(4, 1fr);
		gap: 10px;
	}
	.opt-tile {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 0 16px;
		border-radius: 12px;
		border: none;
		color: #0f172a;
		min-height: 64px;
		cursor: pointer;
		text-align: left;
		font-size: 15px;
	}
	.opt-tile:disabled { cursor: default; }
	.opt-sym { font-size: 26px; width: 28px; text-align: center; }
	.opt-text { font-size: 15px; font-weight: 500; }

	/* Ergebnis-Karte (richtig / falsch) */
	.result-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		padding: 28px 24px;
		text-align: center;
		border-radius: 20px;
		margin: 16px;
		animation: tb-in .3s ease-out;
	}
	/* Nur verschieben, nie ausblenden: Inhalt bleibt sichtbar, auch wenn Animationen nicht laufen */
	@keyframes tb-in { from { transform: translateY(8px); } to { transform: none; } }
	@media (prefers-reduced-motion: reduce) { .result-card { animation: none; } }
	.result-ok { background: var(--ok-soft); }
	.result-bad { background: var(--danger-soft); }
	.result-title { font-size: 28px; font-weight: 700; letter-spacing: -.02em; margin: 0; }
	.result-pts { font-size: 22px; font-weight: 600; margin: 0; }
	.result-rank { font-size: 15px; margin: 0; }
	.result-body { font-size: 15px; color: var(--ink-2); margin: 0; }

	/* Spinner */
	.spinner {
		width: 28px; height: 28px;
		border: 3px solid var(--line);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: tb-spin 0.8s linear infinite;
	}

	/* Primär-Button */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		padding: 0 24px;
		border-radius: 6px;
		background: var(--accent);
		color: #fff;
		font-size: 16px;
		font-weight: 500;
		text-decoration: none;
	}
</style>
