<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { tok } from '$lib/tabula/highlight.js';
	import { quizWsUrl, type WsInMsg } from '$lib/tabula/quiz-api.js';

	let dark = $state(false);
	let ws = $state<WebSocket | null>(null);
	let phase = $state<'connecting' | 'lobby' | 'question' | 'answered' | 'reveal' | 'ended' | 'error'>('connecting');
	let errorMsg = $state('');

	// Lobby
	let participantCount = $state(0);

	// Frage
	let qIndex = $state(0);
	let qText = $state('');
	let qCode = $state<string | null>(null);
	let qOptions = $state<string[]>([]);
	let qTimeLimit = $state(0);
	let qId = $state(0); // question_id für Antwort
	let timeLeft = $state(0);
	let selectedAnswer = $state<number | null>(null);
	let answerCorrect = $state<boolean | null>(null);
	let earnedPoints = $state(0);
	let totalPoints = $state(0);

	// Auflösung
	let correctIdx = $state<number | null>(null);

	// Rangliste / Endergebnis
	let rankings = $state<{ rank: number; display_name: string; points: number }[]>([]);

	let timer: ReturnType<typeof setInterval> | null = null;

	const pin = $derived((page.params.pin ?? '').toUpperCase());

	onMount(() => {
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		const check = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(check, 50); return; }
			if (!session.user) { goto(`/login?redirect=/quiz/${pin}`); return; }
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
			sock.send(JSON.stringify({ type: 'student_join', pin }));
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
			phase = 'error'; errorMsg = 'Verbindungsfehler.';
		});
	}

	function handleMsg(msg: WsInMsg) {
		if (msg.type === 'error') {
			phase = 'error';
			errorMsg = (msg as any).message;
			if ((msg as any).code === 'login_required') goto(`/login?redirect=/quiz/${pin}`);
			return;
		}
		if (msg.type === 'joined') {
			phase = 'lobby';
		}
		if (msg.type === 'lobby_state') {
			phase = 'lobby';
			participantCount = (msg as any).count ?? 0;
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
			selectedAnswer = null;
			answerCorrect = null;
			correctIdx = null;
			clearInterval(timer ?? undefined);
			timer = setInterval(() => {
				timeLeft = Math.max(0, timeLeft - 1);
				if (timeLeft === 0) { clearInterval(timer ?? undefined); timer = null; }
			}, 1000);
		}
		if (msg.type === 'answer_ack') {
			const m = msg as any;
			phase = 'answered';
			answerCorrect = m.correct;
			earnedPoints = m.points;
			totalPoints = m.total_points;
			clearInterval(timer ?? undefined); timer = null;
		}
		if (msg.type === 'reveal') {
			// Wenn Schüler noch nicht geantwortet hat → zeige Auflösung direkt
			if (phase !== 'answered') phase = 'reveal';
			else phase = 'reveal';
			correctIdx = (msg as any).correct_idx;
			clearInterval(timer ?? undefined); timer = null;
		}
		if (msg.type === 'leaderboard') {
			rankings = (msg as any).rankings ?? [];
		}
		if (msg.type === 'quiz_ended') {
			phase = 'ended';
			clearInterval(timer ?? undefined); timer = null;
		}
	}

	function sendAnswer(idx: number) {
		if (phase !== 'question' || selectedAnswer !== null) return;
		selectedAnswer = idx;
		ws?.send(JSON.stringify({ type: 'answer', question_id: qId, chosen_idx: idx }));
	}

	const letterLabels = ['A', 'B', 'C', 'D'];
	const myRank = $derived(() => {
		if (!session.user) return null;
		const name = session.user.display_name;
		const entry = rankings.find(s => s.display_name === name);
		return entry?.rank ?? null;
	});
</script>

<svelte:head><title>Quiz · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center"><p class="note">Kommt in Kürze.</p></main>
	{:else if phase === 'connecting'}
		<main class="center"><div class="spinner-wrap"><span class="spinner"></span></div><p class="hint">Verbinde …</p></main>
	{:else if phase === 'error'}
		<main class="center">
			<div class="error-card">
				<p class="err-msg">{errorMsg}</p>
				<a href="/quiz" class="btn-ghost">Anderen PIN eingeben</a>
			</div>
		</main>
	{:else if phase === 'lobby'}
		<main class="center">
			<div class="lobby-box">
				<div class="lobby-pin">
					<span class="pin-lbl">PIN</span>
					<span class="pin-val">{pin}</span>
				</div>
				<p class="lobby-name">{session.user?.display_name}</p>
				<p class="lobby-count">{participantCount} Teilnehmer beigetreten</p>
				<span class="lobby-wait">Warte auf die Lehrkraft …</span>
			</div>
		</main>
	{:else if phase === 'question' || phase === 'answered'}
		<main class="quiz-main">
			<div class="quiz-content">
				<div class="q-progress">
					<span class="q-counter">Frage {qIndex}</span>
					<span class="q-timer" class:urgent={timeLeft <= 5 && phase === 'question'}>{timeLeft}s</span>
				</div>

				<div class="q-card">
					<p class="q-text">{qText}</p>
					{#if qCode}
						<pre class="q-code" aria-label="SQL-Code">{#each qCode.split('\n') as line}<span class="cl">{#each tok(line) as t}<span style="color:{t.c}">{t.t}</span>{/each}</span>
{/each}</pre>
					{/if}
				</div>

				<div class="opts-grid">
					{#each qOptions as opt, i}
						<button
							class="opt-btn"
							class:selected={selectedAnswer === i}
							class:dimmed={selectedAnswer !== null && selectedAnswer !== i}
							onclick={() => sendAnswer(i)}
							disabled={selectedAnswer !== null}
						>
							<span class="opt-letter">{letterLabels[i]}</span>
							<span class="opt-text">{opt}</span>
						</button>
					{/each}
				</div>

				{#if phase === 'answered'}
					<div class="ack-box" class:correct={answerCorrect} class:wrong={!answerCorrect}>
						{answerCorrect ? `+${earnedPoints} Punkte` : 'Falsch'}
						<span class="total-pts">{totalPoints} gesamt</span>
					</div>
				{/if}
			</div>
		</main>
	{:else if phase === 'reveal'}
		<main class="quiz-main">
			<div class="quiz-content">
				<h2 class="section-title">Auflösung</h2>
				<div class="opts-grid">
					{#each qOptions as opt, i}
						<div
							class="opt-reveal"
							class:is-correct={i === correctIdx}
							class:was-selected={i === selectedAnswer}
						>
							<span class="opt-letter">{letterLabels[i]}</span>
							<span class="opt-text">{opt}</span>
							{#if i === correctIdx}<span class="tick">✓</span>{/if}
						</div>
					{/each}
				</div>
				<p class="wait-hint">Nächste Frage kommt …</p>
			</div>
		</main>
	{:else if phase === 'ended'}
		<main class="quiz-main">
			<div class="quiz-content">
				<h2 class="section-title">Quiz beendet!</h2>
				{#if myRank()}
					<div class="my-rank">Platz {myRank()} von {rankings.length}</div>
				{/if}
				<div class="score-list">
					{#each rankings as s}
						<div class="score-row" class:mine={s.display_name === session.user?.display_name}>
							<span class="s-rank">#{s.rank}</span>
							<span class="s-name">{s.display_name}</span>
							<span class="s-pts">{s.points} Pkt.</span>
						</div>
					{/each}
				</div>
				<a href="/quiz" class="btn-primary">Weiteres Quiz</a>
			</div>
		</main>
	{/if}
</div>

<style>
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px 20px; }
	.spinner-wrap { display: grid; place-items: center; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }
	.hint, .note { font-size: 14px; color: var(--ink-3); }
	.error-card { display: flex; flex-direction: column; gap: 16px; padding: 28px; border: 1px solid var(--danger-line); border-radius: 12px; max-width: 400px; text-align: center; }
	.err-msg { color: var(--danger-ink); font-size: 15px; }
	.lobby-box { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
	.lobby-pin { display: flex; flex-direction: column; align-items: center; gap: 4px; }
	.pin-lbl { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: var(--ink-3); text-transform: uppercase; }
	.pin-val { font-size: 40px; font-weight: 700; letter-spacing: 0.15em; color: var(--accent); font-family: var(--mono); }
	.lobby-name { font-size: 20px; font-weight: 600; }
	.lobby-count { font-size: 15px; color: var(--ink-2); }
	.lobby-wait { font-size: 14px; color: var(--ink-3); animation: pulse 2s ease-in-out infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
	.quiz-main { flex: 1; display: flex; justify-content: center; padding: 28px 20px; }
	.quiz-content { width: 100%; max-width: 700px; display: flex; flex-direction: column; gap: 20px; }
	.q-progress { display: flex; align-items: center; justify-content: space-between; }
	.q-counter { font-size: 13px; font-weight: 600; color: var(--ink-3); }
	.q-timer { font-size: 22px; font-weight: 700; color: var(--accent); }
	.q-timer.urgent { color: var(--danger-ink); }
	.q-card { padding: 20px 24px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 14px; }
	.q-text { font-size: 20px; font-weight: 600; line-height: 1.4; }
	.q-code { margin: 0; padding: 12px 16px; border-radius: 8px; background: #0f172a; font-family: var(--mono); font-size: 13px; line-height: 20px; overflow-x: auto; }
	.cl { display: block; }
	.opts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	@media (max-width: 500px) { .opts-grid { grid-template-columns: 1fr; } }
	.opt-btn { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border: 2px solid var(--line); border-radius: 10px; background: var(--surface); text-align: left; cursor: pointer; font-size: 15px; font-weight: 500; transition: border-color 0.12s, background 0.12s; }
	.opt-btn:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); }
	.opt-btn.selected { border-color: var(--accent); background: var(--accent-soft); }
	.opt-btn.dimmed { opacity: 0.4; }
	.opt-letter { width: 30px; height: 30px; border-radius: 6px; background: var(--subtle); font-weight: 700; display: grid; place-items: center; font-size: 14px; flex: none; }
	.opt-text { flex: 1; }
	.ack-box { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 18px; border-radius: 10px; font-size: 20px; font-weight: 700; }
	.ack-box.correct { background: #dcfce7; color: #15803d; }
	.ack-box.wrong { background: #fee2e2; color: #b91c1c; }
	.total-pts { font-size: 14px; font-weight: 500; opacity: 0.8; }
	.section-title { font-size: 24px; font-weight: 600; }
	.opt-reveal { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border: 2px solid var(--line); border-radius: 10px; font-size: 15px; font-weight: 500; }
	.opt-reveal.is-correct { border-color: #16a34a; background: #dcfce7; }
	.opt-reveal.was-selected:not(.is-correct) { border-color: #dc2626; background: #fee2e2; }
	.tick { margin-left: auto; font-weight: 700; color: #16a34a; }
	.wait-hint { font-size: 14px; color: var(--ink-3); text-align: center; }
	.my-rank { text-align: center; font-size: 28px; font-weight: 700; color: var(--accent); }
	.score-list { display: flex; flex-direction: column; gap: 6px; }
	.score-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
	.score-row.mine { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
	.s-rank { width: 28px; color: var(--ink-3); font-size: 13px; }
	.s-name { flex: 1; }
	.s-pts { color: var(--accent); font-weight: 600; }
	.btn-primary { display: inline-flex; align-items: center; justify-content: center; height: 48px; padding: 0 24px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; align-self: flex-start; }
	.btn-primary:hover { background: var(--accent-strong); }
	.btn-ghost { display: inline-flex; align-items: center; height: 44px; padding: 0 18px; border-radius: 8px; border: 1px solid var(--line); color: var(--ink-2); font-size: 15px; font-weight: 500; text-decoration: none; }
	.btn-ghost:hover { background: var(--subtle); color: var(--ink); }
</style>
