<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import { ACCOUNTS_LIVE } from '$lib/tabula/flags.js';
	import { session } from '$lib/tabula/session.svelte.js';
	import { tok } from '$lib/tabula/highlight.js';
	import {
		apiQuizGet,
		apiQuizRename,
		apiQuizAddQuestion,
		apiQuizUpdateQuestion,
		apiQuizDeleteQuestion,
		apiQuizStart,
		type QuizSetDetail,
		type QuizQuestion,
	} from '$lib/tabula/quiz-api.js';

	let dark = $state(false);
	let quiz = $state<QuizSetDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busy = $state(false);

	// Neues Formular
	let showAdd = $state(false);
	let editId = $state<number | null>(null); // Frage in Bearbeitung

	// Formularfelder
	let fQuestion = $state('');
	let fCode = $state('');
	let fOptions = $state(['', '', '', '']);
	let fCorrect = $state(0);
	let fTimeLimit = $state(20);
	let fPoints = $state(100);

	let quizId = $derived(Number(page.params.id));

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
			load();
		};
		check();
		return () => mo.disconnect();
	});

	async function load() {
		loading = true; error = null;
		try {
			const res = await apiQuizGet(quizId);
			quiz = res.quiz;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden.';
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		fQuestion = ''; fCode = '';
		fOptions = ['', '', '', ''];
		fCorrect = 0; fTimeLimit = 20; fPoints = 100;
		editId = null; showAdd = false;
	}

	function openEdit(q: QuizQuestion) {
		editId = q.id;
		fQuestion = q.question;
		fCode = q.code ?? '';
		fOptions = [...q.options];
		while (fOptions.length < 4) fOptions.push('');
		fCorrect = q.correct_index;
		fTimeLimit = q.time_limit;
		fPoints = q.points;
		showAdd = true;
	}

	async function saveQuestion() {
		if (!quiz) return;
		const opts = fOptions.map(o => o.trim()).filter(o => o);
		if (!fQuestion.trim()) { error = 'Frage darf nicht leer sein.'; return; }
		if (opts.length < 2) { error = 'Mindestens 2 Antwortoptionen erforderlich.'; return; }
		if (fCorrect >= opts.length) { error = 'Richtige Antwort auswählen.'; return; }
		busy = true; error = null;
		const payload = {
			question: fQuestion.trim(),
			code: fCode.trim() || null,
			options: opts,
			correct_index: fCorrect,
			time_limit: fTimeLimit,
			points: fPoints,
		};
		try {
			if (editId !== null) {
				const res = await apiQuizUpdateQuestion(quizId, editId, payload);
				quiz.questions = quiz.questions.map(q => q.id === editId ? res.question : q);
			} else {
				const res = await apiQuizAddQuestion(quizId, payload as any);
				quiz.questions = [...quiz.questions, res.question];
			}
			resetForm();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.';
		} finally {
			busy = false;
		}
	}

	async function deleteQuestion(qid: number) {
		if (!quiz) return;
		if (!confirm('Frage wirklich löschen?')) return;
		busy = true;
		try {
			await apiQuizDeleteQuestion(quizId, qid);
			quiz.questions = quiz.questions.filter(q => q.id !== qid);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Löschen fehlgeschlagen.';
		} finally {
			busy = false;
		}
	}

	async function startQuiz() {
		if (!quiz || quiz.questions.length === 0) return;
		busy = true;
		try {
			const s = await apiQuizStart(quizId);
			goto(`/teach/quiz/live/${s.session_id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Start fehlgeschlagen.';
			busy = false;
		}
	}

	const letterLabels = ['A', 'B', 'C', 'D'];
</script>

<svelte:head><title>{quiz?.title ?? 'Fragensatz'} · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	{#if !ACCOUNTS_LIVE}
		<main class="center"><div class="form-wrap narrow"><div class="title-block"><h1>Quiz</h1><p class="sub">Kommt in Kürze.</p></div></div></main>
	{:else if loading}
		<main class="center"><div class="spinner-wrap"><span class="spinner"></span></div></main>
	{:else if !quiz}
		<main class="center"><div class="form-wrap narrow"><p>{error ?? 'Nicht gefunden.'}</p><a href="/teach/quiz" class="btn-ghost">Zurück</a></div></main>
	{:else}
		<main class="teach-main">
			<div class="teach-content">

				<div class="page-header">
					<div class="page-header-left">
						<a href="/teach/quiz" class="breadcrumb">← Fragensätze</a>
						<h1 class="page-title">{quiz.title}</h1>
					</div>
					<button
						class="btn-primary"
						onclick={startQuiz}
						disabled={busy || quiz.questions.length === 0}
						title={quiz.questions.length === 0 ? 'Mindestens eine Frage erforderlich' : ''}
					>
						▶ Quiz starten
					</button>
				</div>

				{#if error}
					<div class="error-box">{error}</div>
				{/if}

				<!-- Fragenliste -->
				<div class="q-list">
					{#each quiz.questions as q, i (q.id)}
						<div class="q-card">
							<div class="q-num">{i + 1}</div>
							<div class="q-body">
								<div class="q-text">{q.question}</div>
								{#if q.code}
									<pre class="q-code" aria-label="SQL-Code">{#each q.code.split('\n') as line}<span class="code-line">{#each tok(line) as t}<span style="color:{t.c}">{t.t}</span>{/each}</span>\n{/each}</pre>
								{/if}
								<div class="q-opts">
									{#each q.options as opt, oi}
										<span class="q-opt" class:correct={oi === q.correct_index}>
											<span class="q-opt-letter">{letterLabels[oi]}</span>
											{opt}
										</span>
									{/each}
								</div>
								<div class="q-meta">{q.time_limit} s</div>
							</div>
							<div class="q-actions">
								<button class="btn-ghost sm" onclick={() => openEdit(q)} disabled={busy}>Bearbeiten</button>
								<button class="btn-danger-ghost sm" onclick={() => deleteQuestion(q.id)} disabled={busy}>Löschen</button>
							</div>
						</div>
					{/each}

					{#if !showAdd}
						<button class="btn-add" onclick={() => { resetForm(); showAdd = true; }}>+ Frage hinzufügen</button>
					{/if}
				</div>

				<!-- Formular -->
				{#if showAdd}
					<div class="add-form">
						<h2 class="add-title">{editId !== null ? 'Frage bearbeiten' : 'Neue Frage'}</h2>

						<div class="field">
							<label for="fq-question" class="field-label">Frage</label>
							<textarea id="fq-question" class="field-input ta" rows="2" bind:value={fQuestion} placeholder="Was ist ein PRIMARY KEY?"></textarea>
						</div>

						<div class="field">
							<label for="fq-code" class="field-label">SQL-Code (optional)</label>
							<textarea id="fq-code" class="field-input ta mono" rows="3" bind:value={fCode} placeholder="SELECT * FROM schueler WHERE ..."></textarea>
						</div>

						<div class="opts-grid">
							{#each fOptions as _, i}
								<div class="opt-row">
									<input
										type="radio"
										name="correct"
										value={i}
										bind:group={fCorrect}
										title="Als richtig markieren"
									/>
									<span class="opt-letter">{letterLabels[i]}</span>
									<input
										type="text"
										class="field-input"
										bind:value={fOptions[i]}
										placeholder="Antwort {letterLabels[i]}"
									/>
								</div>
							{/each}
						</div>

						<div class="settings-row">
							<div class="field">
								<label for="fq-time" class="field-label">Zeit (Sek.)</label>
								<input id="fq-time" type="number" class="field-input" min="5" max="120" bind:value={fTimeLimit} />
							</div>
							<p class="field-label" style="align-self:end;margin:0 0 10px">Punkte: bis zu 1000, je schneller die richtige Antwort, desto mehr.</p>
						</div>

						<div class="btn-row">
							<button class="btn-ghost" onclick={resetForm}>Abbrechen</button>
							<button class="btn-primary" onclick={saveQuestion} disabled={busy}>
								{busy ? 'Speichere …' : editId !== null ? 'Speichern' : 'Hinzufügen'}
							</button>
						</div>
					</div>
				{/if}

			</div>
		</main>
	{/if}
</div>

<style>
	.page { display: flex; flex-direction: column; min-height: 100svh; }
	.center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
	.form-wrap { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 20px; }
	.narrow { max-width: 440px; }
	.title-block { display: flex; flex-direction: column; gap: 6px; }
	.title-block h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
	.title-block .sub { font-size: 15px; color: var(--ink-2); }
	.spinner-wrap { display: grid; place-items: center; padding: 80px; }
	.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: tb-spin 0.8s linear infinite; }
	.teach-main { flex: 1; display: flex; justify-content: center; padding: 36px 40px; }
	@media (max-width: 767px) { .teach-main { padding: 20px 16px; } }
	.teach-content { width: 100%; max-width: 1100px; display: flex; flex-direction: column; gap: 22px; }
	.page-header { display: flex; align-items: flex-end; gap: 16px; }
	.page-header-left { flex: 1; display: flex; flex-direction: column; }
	.breadcrumb { font-size: 14px; color: var(--ink-3); text-decoration: none; }
	.breadcrumb:hover { color: var(--ink); }
	.page-title { font-size: 32px; line-height: 40px; font-weight: 600; letter-spacing: -0.01em; }
	.error-box { padding: 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; }
	/* Fragenliste */
	.q-list { display: flex; flex-direction: column; gap: 10px; }
	.q-card { display: flex; gap: 16px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); align-items: flex-start; }
	.q-num { width: 32px; height: 32px; border-radius: 6px; background: var(--subtle); display: grid; place-items: center; font-size: 13px; font-weight: 600; color: var(--ink-3); flex: none; }
	.q-body { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
	.q-text { font-size: 16px; font-weight: 500; }
	.q-code { margin: 0; padding: 10px 14px; border-radius: 8px; background: #0f172a; font-family: var(--mono); font-size: 13px; line-height: 20px; overflow-x: auto; }
	.code-line { display: block; }
	.q-opts { display: flex; flex-wrap: wrap; gap: 6px; }
	.q-opt { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-size: 13px; border: 1px solid var(--line); }
	.q-opt.correct { background: var(--success-soft, #dcfce7); border-color: var(--success-line, #86efac); color: var(--success-ink, #15803d); }
	.q-opt-letter { font-weight: 600; }
	.q-meta { font-size: 12px; color: var(--ink-3); }
	.q-actions { display: flex; gap: 6px; flex-shrink: 0; }
	.btn-add { display: flex; align-items: center; justify-content: center; height: 52px; border: 2px dashed var(--line-strong); border-radius: 10px; color: var(--accent); font-size: 15px; font-weight: 500; cursor: pointer; width: 100%; }
	.btn-add:hover { background: var(--accent-soft); }
	/* Formular */
	.add-form { display: flex; flex-direction: column; gap: 18px; padding: 24px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
	.add-title { font-size: 20px; font-weight: 600; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	.field-label { font-size: 14px; font-weight: 500; color: var(--ink-2); }
	.field-input { height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 15px; width: 100%; }
	.field-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
	.ta { height: auto; padding: 10px 14px; resize: vertical; }
	.mono { font-family: var(--mono); font-size: 13px; }
	.opts-grid { display: flex; flex-direction: column; gap: 8px; }
	.opt-row { display: flex; align-items: center; gap: 10px; }
	.opt-letter { width: 24px; font-size: 13px; font-weight: 600; color: var(--ink-3); flex: none; }
	.settings-row { display: flex; gap: 16px; }
	.settings-row .field { flex: 1; }
	.btn-row { display: flex; gap: 10px; justify-content: flex-end; }
	.btn-primary { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-ghost { display: inline-flex; align-items: center; height: 40px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; white-space: nowrap; }
	.btn-ghost:hover:not(:disabled) { background: var(--subtle); color: var(--ink); }
	.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-ghost.sm, .btn-danger-ghost.sm { height: 34px; font-size: 13px; padding: 0 12px; }
	.btn-danger-ghost { display: inline-flex; align-items: center; height: 40px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--danger-line); color: var(--danger-ink); font-size: 14px; font-weight: 500; cursor: pointer; }
	.btn-danger-ghost:hover:not(:disabled) { background: var(--danger-soft); }
	.btn-danger-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
