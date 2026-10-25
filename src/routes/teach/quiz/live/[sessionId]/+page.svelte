<script lang="ts">
	import { siteOrigin, siteHost } from '$lib/tabula/site.js';
	import '$lib/tabula/theme.css';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { tok } from '$lib/tabula/highlight.js';
	import { quizWsUrl, type WsInMsg } from '$lib/tabula/quiz-api.js';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import QRCode from 'qrcode';

	// Design-Farben ▲ ◆ ● ■
	const Q_COLORS = [
		'oklch(0.80 0.13 80)',  // q1 gelb ▲
		'oklch(0.80 0.10 240)', // q2 blau ◆
		'oklch(0.80 0.11 25)',  // q3 rot  ●
		'oklch(0.80 0.10 155)', // q4 grün ■
	];
	const Q_SYMBOLS = ['▲', '◆', '●', '■'];

	// Podium-Farben: Platz 1 = q1 (gold), Platz 2 = q2 (blau), Platz 3 = q4 (grün)
	const PODIUM_COLORS = [Q_COLORS[1], Q_COLORS[0], Q_COLORS[3]]; // idx 0=Platz2, 1=Platz1, 2=Platz3 (visuell)

	type Phase = 'connecting' | 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended' | 'error';

	let ws = $state<WebSocket | null>(null);
	let phase = $state<Phase>('connecting');
	let errorMsg = $state('');

	// Lobby
	let quizTitle = $state('');
	let participants = $state<string[]>([]);
	let expected = $state<number | null>(null);
	let pin = $state('');
	let qrDataUrl = $state('');

	// Frage
	let qIndex = $state(0);
	let qTotal = $state(0);
	let qText = $state('');
	let qCode = $state<string | null>(null);
	let qOptions = $state<string[]>([]);
	let qTimeLimit = $state(0);
	let timeLeft = $state(0);
	let answeredCount = $state(0);
	let totalParticipants = $state(0);

	// Auflösung
	let revealCorrectIdx = $state(0);
	let revealCounts = $state<number[]>([]);

	// Leaderboard / Endergebnis
	let rankings = $state<{ rank: number; display_name: string; points: number }[]>([]);
	let finalRankings = $state<{ rank: number; display_name: string; points: number }[]>([]);
	let totalQuestions = $state(0);

	let timer: ReturnType<typeof setInterval> | null = null;
	const sessionId = $derived(Number(page.params.sessionId));
	const joinUrl = $derived(`${siteOrigin()}/quiz/${pin || sessionId}`);

	// QR-Code generieren sobald pin bekannt
	$effect(() => {
		if (pin) {
			QRCode.toDataURL(joinUrl, {
				width: 440, margin: 2,
				color: { dark: '#0f172a', light: '#ffffff' }
			}).then(url => { qrDataUrl = url; }).catch(() => {});
		}
	});

	onMount(() => {
		const check = () => {
			if (!ACCOUNTS_LIVE) return;
			if (session.loading) { setTimeout(check, 50); return; }
			if (!session.user) { goto('/login?redirect=/teach/quiz'); return; }
			if (session.user.role !== 'teacher') { goto('/teach'); return; }
			connect();
		};
		check();
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
			phase = 'lobby';
			const m = msg as any;
			if (m.pin) pin = m.pin;
			if (m.quiz_title) quizTitle = m.quiz_title;
		}
		if (msg.type === 'lobby_state') {
			const m = msg as any;
			phase = 'lobby';
			participants = m.participants ?? [];
			expected = m.expected ?? null;
			if (m.pin) pin = m.pin;
			if (m.quiz_title) quizTitle = m.quiz_title;
			totalParticipants = m.expected ?? participants.length;
		}
		if (msg.type === 'question_start') {
			const m = msg as any;
			phase = 'question';
			qIndex = m.question_index;
			qTotal = m.question_total ?? qTotal;
			if (m.question_total) totalQuestions = m.question_total;
			qText = m.question;
			qCode = m.code ?? null;
			qOptions = m.options;
			qTimeLimit = m.time_limit;
			timeLeft = m.time_limit;
			answeredCount = 0;
			rankings = [];
			clearInterval(timer ?? undefined);
			timer = setInterval(() => {
				timeLeft = Math.max(0, timeLeft - 1);
				if (timeLeft === 0) { clearInterval(timer ?? undefined); timer = null; }
			}, 1000);
		}
		if (msg.type === 'answer_progress') {
			const m = msg as any;
			answeredCount = m.count ?? answeredCount;
		}
		if (msg.type === 'reveal') {
			const m = msg as any;
			phase = 'reveal';
			revealCorrectIdx = m.correct_idx;
			revealCounts = m.answer_counts ?? [];
			clearInterval(timer ?? undefined); timer = null;
		}
		if (msg.type === 'leaderboard') {
			const m = msg as any;
			rankings = m.rankings ?? [];
			finalRankings = rankings;
			// Nach reveal kommt leaderboard → zeige Zwischenstand
			if (phase === 'reveal') phase = 'leaderboard';
		}
		if (msg.type === 'quiz_ended') {
			phase = 'ended';
			clearInterval(timer ?? undefined); timer = null;
		}
	}

	function send(msg: object) {
		if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
	}

	// Für Auflösung: Prozentwert-Balken
	function revealBarWidth(idx: number): string {
		const total = revealCounts.reduce((s, n) => s + n, 0);
		if (total === 0) return '0%';
		return Math.round((revealCounts[idx] ?? 0) / total * 100) + '%';
	}

	// Podium-Anordnung: 2 – 1 – 3 (Platz 2 links, 1 mitte, 3 rechts)
	const podiumOrder = $derived(() => {
		const top3 = finalRankings.slice(0, 3);
		if (top3.length < 2) return top3;
		// Swap: Platz 2 links, Platz 1 Mitte, Platz 3 rechts
		const arr: typeof top3 = [];
		if (top3[1]) arr.push(top3[1]); // Platz 2
		if (top3[0]) arr.push(top3[0]); // Platz 1
		if (top3[2]) arr.push(top3[2]); // Platz 3
		return arr;
	});

	const podiumHeights = ['280px', '380px', '200px']; // links, mitte, rechts
	const podiumBg = [PODIUM_COLORS[0], PODIUM_COLORS[1], PODIUM_COLORS[2]]; // Platz2=blau, 1=gold, 3=grün
</script>

<svelte:head><title>Live-Quiz · Tabula</title></svelte:head>

<!-- Beamer: Vollbild, kein TopNav, kein Scrolling -->
<div class="beamer">

	{#if !ACCOUNTS_LIVE}
		<div class="center-msg">
			<p class="note">Kommt in Kürze.</p>
		</div>

	{:else if phase === 'connecting'}
		<div class="center-msg">
			<span class="spinner"></span>
			<p class="note">Verbinde …</p>
		</div>

	{:else if phase === 'error'}
		<div class="center-msg">
			<p class="err-msg">{errorMsg}</p>
			<a href="/teach/quiz" class="btn-ghost">Zur Fragensatz-Übersicht</a>
		</div>

	{:else if phase === 'lobby'}
		<!-- E1-B Lobby -->
		<div class="lobby-header">
			<Edgar pose="wave" class="lobby-edgar" style="width:56px;height:50px" />
			<span class="lobby-title">{quizTitle || 'Quiz'}</span>
			<span class="spacer"></span>
			<button class="btn-end-quiz" onclick={() => send({ type: 'end_quiz' })}>Quiz beenden</button>
		</div>
		<div class="lobby-body">
			<!-- QR + PIN -->
			<div class="qr-card">
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="QR-Code" class="qr-img" />
				{:else}
					<div class="qr-placeholder"></div>
				{/if}
				<span class="pin-mono">{pin || String(sessionId)}</span>
				<span class="join-url mono">{siteHost()}/quiz/{pin || sessionId}</span>
			</div>
			<!-- Teilnehmer -->
			<div class="lobby-right">
				<div class="count-row">
					<span class="count-big">{participants.length}</span>
					<span class="count-label">
						{#if expected !== null}von {expected} sind dabei{:else}Teilnehmer{/if}
					</span>
					<span class="spacer"></span>
					<Edgar pose="wave" style="width:220px;height:198px" />
				</div>
				<div class="chips">
					{#each participants as name}
						<span class="chip">{name}</span>
					{/each}
				</div>
				<div class="lobby-actions">
					<button
						class="btn-los"
						onclick={() => send({ type: 'next_question' })}
						disabled={participants.length === 0}
					>
						Los <span class="arrow-icon" aria-hidden="true">→</span>
					</button>
				</div>
			</div>
		</div>

	{:else if phase === 'question'}
		<!-- E2-B Frage -->
		<div class="q-header">
			<span class="q-label mono">FRAGE {qIndex} VON {qTotal || '…'}</span>
			<div class="progress-bar-wrap">
				<div class="progress-bar-fill" style="width:{qTotal ? Math.round((qIndex - 1) / qTotal * 100) + '%' : '0%'}"></div>
			</div>
			<span class="answered-label"><b>{answeredCount}</b> / {totalParticipants || participants.length} geantwortet</span>
			<div class="timer-circle">
				<span class="timer-num mono">{timeLeft}</span>
			</div>
			<button class="btn-skip" onclick={() => send({ type: 'reveal' })}>Überspringen</button>
		</div>
		<div class="q-body">
			<h2 class="q-text">{qText}</h2>
			{#if qCode}
				<pre class="q-code">{#each qCode.split('\n') as line}<span class="cl">{#each tok(line) as t}<span style="color:{t.c}">{t.t}</span>{/each}</span>
{/each}</pre>
			{/if}
			<div class="opts-grid">
				{#each qOptions as opt, i}
					<div class="opt-tile" style="background:{Q_COLORS[i]}">
						<span class="opt-sym">{Q_SYMBOLS[i]}</span>
						<span class="opt-text mono">{opt}</span>
					</div>
				{/each}
			</div>
		</div>

	{:else if phase === 'reveal'}
		<!-- E3-B Auflösung -->
		<div class="reveal-header">
			<span class="q-label mono">FRAGE {qIndex} VON {qTotal || '…'} · AUFLÖSUNG</span>
			<span class="spacer"></span>
			<span class="answered-label">{revealCounts.reduce((s, n) => s + n, 0)} Antworten</span>
		</div>
		<div class="reveal-body">
			<!-- Balken-Liste links -->
			<div class="reveal-bars">
				{#each qOptions as opt, i}
					<div class="reveal-row">
						<span class="rev-sym">{Q_SYMBOLS[i]}</span>
						<span class="rev-text mono">{opt}</span>
						<div class="rev-bar-wrap">
							<div class="rev-bar-fill" style="width:{revealBarWidth(i)};background:{Q_COLORS[i]}"></div>
						</div>
						<span class="rev-count mono">{revealCounts[i] ?? 0}</span>
					</div>
				{/each}
			</div>
			<!-- Info-Box rechts -->
			<div class="reveal-info">
				<p class="rev-correct-label">✓ Richtig: {Q_SYMBOLS[revealCorrectIdx]}</p>
				<p class="rev-correct-text mono">{qOptions[revealCorrectIdx]}</p>
				<button class="btn-weiter" onclick={() => { send({ type: 'next_question' }); }}>
					Weiter <span aria-hidden="true">→</span>
				</button>
			</div>
		</div>

	{:else if phase === 'leaderboard'}
		<!-- E4-B Zwischenstand -->
		<div class="lb-header">
			<h2 class="lb-title">Zwischenstand nach Frage {qIndex}</h2>
			<button class="btn-naechste" onclick={() => send({ type: 'next_question' })}>
				Nächste Frage <span aria-hidden="true">→</span>
			</button>
		</div>
		<div class="lb-body">
			{#each rankings.slice(0, 5) as r}
				<div class="lb-row">
					<span class="lb-rank mono">{r.rank}</span>
					<span class="lb-name">{r.display_name}</span>
					<span class="spacer"></span>
					<span class="lb-pts mono">{r.points.toLocaleString('de-DE')}</span>
				</div>
			{/each}
		</div>

	{:else if phase === 'ended'}
		<!-- E5-B Ende · Podium -->
		<div class="end-header">
			<h2 class="end-title">Geschafft! {totalQuestions || qTotal} Fragen, {finalRankings.length} Schüler</h2>
			<a href="/teach/quiz/auswertung/{sessionId}" class="btn-auswertung">Auswertung</a>
		</div>
		<Edgar pose="trophy" style="width:260px;height:234px;display:block;margin:0 auto" />
		<div class="podium">
			{#each podiumOrder() as p, vi}
				<div class="podium-col">
					<span class="podium-name">{p.display_name}</span>
					<span class="podium-pts mono">{p.points.toLocaleString('de-DE')}</span>
					<div class="podium-bar" style="height:{podiumHeights[vi]};background:{podiumBg[vi]}">
						<span class="podium-rank mono">{p.rank}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

</div>

<style>
	/* Vollbild Beamer */
	:global(html, body) {
		height: 100%;
		margin: 0;
		overflow: hidden;
	}
	.beamer {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--ink);
		font-family: 'IBM Plex Sans', sans-serif;
		overflow: hidden;
	}

	.spacer { flex: 1; }
	.mono { font-family: 'IBM Plex Mono', monospace; }

	/* ---- Verbinden / Fehler ---- */
	.center-msg {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}
	.note { font-size: 18px; color: var(--ink-2); }
	.err-msg { color: var(--danger-ink); font-size: 18px; text-align: center; }
	.spinner {
		width: 36px; height: 36px;
		border: 4px solid var(--line);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: tb-spin 0.8s linear infinite;
	}
	.btn-ghost {
		display: inline-flex; align-items: center;
		height: 48px; padding: 0 24px; border-radius: 8px;
		border: 1px solid var(--line); color: var(--ink-2);
		font-size: 16px; font-weight: 500; text-decoration: none;
	}

	/* ---- Lobby ---- */
	.lobby-header {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 36px 64px;
	}
	.lobby-title {
		font-size: 40px;
		line-height: 48px;
		font-weight: 600;
	}
	.btn-end-quiz {
		font-size: 24px;
		color: var(--ink-3);
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}
	.lobby-body {
		flex: 1;
		display: grid;
		grid-template-columns: 640px minmax(0, 1fr);
		gap: 72px;
		padding: 12px 64px 64px;
		min-height: 0;
	}
	.qr-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
		padding: 40px;
		border: 1px solid var(--line);
		border-radius: 16px;
		background: var(--surface);
	}
	.qr-img { width: 440px; height: 440px; border-radius: 8px; display: block; }
	.qr-placeholder {
		width: 440px; height: 440px;
		border-radius: 8px;
		background: repeating-conic-gradient(var(--ink) 0 25%, transparent 0 50%) 0 0 / 40px 40px;
		outline: 16px solid var(--surface);
	}
	.pin-mono {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 88px;
		line-height: 96px;
		font-weight: 500;
		letter-spacing: 10px;
	}
	.join-url {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 28px;
		color: var(--ink-2);
	}
	.lobby-right {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}
	.count-row {
		display: flex;
		align-items: flex-end;
		gap: 24px;
	}
	.count-big {
		font-size: 160px;
		line-height: 0.9;
		font-weight: 600;
		color: var(--accent-strong);
		letter-spacing: -4px;
	}
	.count-label {
		font-size: 48px;
		line-height: 56px;
		color: var(--ink-2);
		padding-bottom: 10px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		align-content: flex-start;
		flex: 1;
	}
	.chip {
		height: 64px;
		padding: 0 26px;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		display: inline-flex;
		align-items: center;
		font-size: 32px;
		font-weight: 500;
	}
	.lobby-actions { display: flex; justify-content: flex-end; }
	.btn-los {
		display: inline-flex;
		align-items: center;
		gap: 14px;
		height: 104px;
		padding: 0 64px;
		border-radius: 12px;
		background: var(--accent);
		color: #fff;
		font-size: 44px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}
	.btn-los:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-los:disabled { opacity: 0.4; cursor: not-allowed; }
	.arrow-icon { font-size: 40px; }

	/* ---- Frage ---- */
	.q-header {
		display: flex;
		align-items: center;
		gap: 32px;
		padding: 36px 64px;
	}
	.q-label { font-size: 32px; color: var(--ink-2); }
	.progress-bar-wrap {
		flex: 1;
		height: 10px;
		border-radius: 999px;
		background: var(--line);
		overflow: hidden;
	}
	.progress-bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
		transition: width 0.4s ease;
	}
	.answered-label { font-size: 32px; color: var(--ink-2); }
	.answered-label b { color: var(--ink); }
	.timer-circle {
		width: 120px;
		height: 120px;
		border-radius: 999px;
		border: 10px solid var(--accent);
		display: grid;
		place-items: center;
		flex: none;
	}
	.timer-num { font-size: 52px; font-weight: 500; }
	.btn-skip {
		font-size: 26px;
		color: var(--ink-3);
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}
	.q-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 36px;
		padding: 8px 64px 64px;
		min-height: 0;
	}
	.q-text {
		font-size: 64px;
		line-height: 76px;
		font-weight: 600;
		letter-spacing: -1px;
	}
	.q-code {
		margin: 0;
		padding: 28px 36px;
		border-radius: 16px;
		background: #0f172a;
		color: #e2e8f0;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 44px;
		line-height: 64px;
		overflow-x: auto;
	}
	.cl { display: block; }
	.opts-grid {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		min-height: 0;
	}
	.opt-tile {
		display: flex;
		align-items: center;
		gap: 28px;
		padding: 0 36px;
		border-radius: 16px;
		color: #0f172a;
	}
	.opt-sym { font-size: 52px; width: 60px; text-align: center; }
	.opt-text { font-size: 44px; font-weight: 500; }

	/* ---- Auflösung ---- */
	.reveal-header {
		display: flex;
		align-items: center;
		gap: 32px;
		padding: 36px 64px;
	}
	.reveal-body {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 520px;
		gap: 64px;
		padding: 8px 64px 64px;
		min-height: 0;
	}
	.reveal-bars {
		display: flex;
		flex-direction: column;
		gap: 22px;
		justify-content: center;
	}
	.reveal-row {
		display: grid;
		grid-template-columns: 72px 560px minmax(0, 1fr) 80px;
		align-items: center;
		gap: 20px;
	}
	.rev-sym { font-size: 48px; text-align: center; }
	.rev-text { font-size: 40px; font-weight: 500; }
	.rev-bar-wrap {
		height: 72px;
		border-radius: 12px;
		background: var(--subtle);
		overflow: hidden;
	}
	.rev-bar-fill { height: 100%; border-radius: 12px; transition: width 0.6s ease; }
	.rev-count { font-size: 44px; font-weight: 500; text-align: right; }
	.reveal-info {
		display: flex;
		flex-direction: column;
		gap: 24px;
		justify-content: center;
		padding: 40px;
		border-radius: 16px;
		border: 2px solid var(--ok);
		background: var(--ok-soft);
	}
	.rev-correct-label {
		font-size: 40px;
		font-weight: 600;
		color: var(--ok-ink);
	}
	.rev-correct-text {
		font-size: 40px;
		line-height: 52px;
	}
	.btn-weiter {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		height: 96px;
		padding: 0 52px;
		border-radius: 12px;
		background: var(--accent);
		color: #fff;
		font-size: 40px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		margin-top: 16px;
		font-family: inherit;
	}
	.btn-weiter:hover { background: var(--accent-strong); }

	/* ---- Zwischenstand ---- */
	.lb-header {
		display: flex;
		align-items: center;
		padding: 36px 64px;
	}
	.lb-title {
		flex: 1;
		font-size: 56px;
		line-height: 64px;
		font-weight: 600;
	}
	.btn-naechste {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 96px;
		padding: 0 52px;
		border-radius: 12px;
		background: var(--accent);
		color: #fff;
		font-size: 40px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}
	.btn-naechste:hover { background: var(--accent-strong); }
	.lb-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 16px 280px 64px;
	}
	.lb-row {
		display: grid;
		grid-template-columns: 100px minmax(0, 1fr) 220px;
		align-items: center;
		gap: 24px;
		height: 128px;
		padding: 0 40px;
		border-radius: 16px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.lb-rank { font-size: 56px; font-weight: 500; color: var(--accent-strong); }
	.lb-name { font-size: 48px; font-weight: 600; }
	.lb-pts { font-size: 52px; font-weight: 500; text-align: right; }

	/* ---- Ende / Podium ---- */
	.end-header {
		width: 100%;
		display: flex;
		align-items: center;
		padding: 36px 64px;
	}
	.end-title {
		flex: 1;
		font-size: 56px;
		line-height: 64px;
		font-weight: 600;
	}
	.btn-auswertung {
		display: inline-flex;
		align-items: center;
		height: 96px;
		padding: 0 52px;
		border-radius: 12px;
		border: 2px solid var(--line-strong);
		background: var(--surface);
		font-size: 40px;
		font-weight: 600;
		text-decoration: none;
		color: var(--ink);
	}
	.podium {
		flex: 1;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 24px;
		padding-bottom: 0;
	}
	.podium-col {
		width: 420px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}
	.podium-name { font-size: 48px; font-weight: 600; }
	.podium-pts { font-size: 36px; color: var(--ink-2); }
	.podium-bar {
		width: 100%;
		border-radius: 16px 16px 0 0;
		display: grid;
		place-items: center;
		color: #0f172a;
	}
	.podium-rank { font-size: 96px; font-weight: 500; }
</style>
