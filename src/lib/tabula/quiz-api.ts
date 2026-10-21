/**
 * Quiz-API-Client fuer Tabula.
 *
 * Eigene Datei, damit api.ts unveraendert bleibt.
 * Basis-URL: /api  -- credentials: 'include' (Session-Cookie)
 * Deutsche Fehlermeldungen aus Server-Feld "fehler".
 */

import { ApiError } from '$lib/tabula/api.js';

const BASE = '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server.');
  }
  if (!response.ok) {
    let msg = `Fehler ${response.status}`;
    try {
      const j = await response.json();
      if (typeof j?.fehler === 'string') msg = j.fehler;
    } catch { /* ignore */ }
    throw new ApiError(response.status, msg);
  }
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type QuizQuestion = {
  id: number;
  position: number;
  question: string;
  code: string | null;
  options: string[];       // immer 4 Eintraege
  correct_index: number;
  time_limit: number;      // Sekunden
  points: number;
};

export type QuizSet = {
  id: number;
  title: string;
  created_at: number;
  question_count: number;
};

export type QuizSetDetail = {
  id: number;
  title: string;
  created_at: number;
  questions: QuizQuestion[];
};

export type QuizSession = {
  session_id: number;
  pin: string;
};

export type QuizSessionDetail = {
  session_id: number;
  pin: string;
  quiz_title: string;
  class_name: string | null;
  status: 'lobby' | 'question' | 'reveal' | 'ended';
  current_question: number | null;
};

export type QuizResult = {
  session_id: number;
  quiz_title: string;
  ended_at: number;
  participants: {
    display_name: string;
    total_points: number;
    correct: number;
    total: number;
  }[];
  /** Auswertung je Frage (Anteil richtig, ohne Namen) */
  question_stats?: QuizQuestionStat[];
};

export type QuizQuestionStat = {
  question_id: number;
  question: string;
  correct_idx: number;
  answer_counts: number[];
  correct_ratio: number;
  answer_count: number;
  avg_ms: number | null;
};

/** Frage im Server-Format */
type ServerQuestion = {
  id: number;
  position: number;
  question: string;
  code?: string | null;
  options: string[];
  correct_idx: number;
  time_limit: number;
};

// ---------------------------------------------------------------------------
// REST-Endpunkte (Lehrkraft)
// ---------------------------------------------------------------------------

/** Alle eigenen Fragesätze laden (Server liefert ein Array) */
export async function apiQuizList(): Promise<{ quizzes: QuizSet[] }> {
  const rows = await request<QuizSet[]>('GET', '/teacher/quizzes');
  return { quizzes: rows };
}

/** Server-Frage (correct_idx) → UI-Frage (correct_index, points) */
function toUiQuestion(q: ServerQuestion): QuizQuestion {
  return { id: q.id, position: q.position, question: q.question, code: q.code ?? null, options: q.options, correct_index: q.correct_idx, time_limit: q.time_limit, points: 1000 };
}

/** Fragensatz laden (inkl. Fragen) */
export async function apiQuizGet(id: number): Promise<{ quiz: QuizSetDetail }> {
  const s = await request<{ id: number; title: string; created_at: number; questions: ServerQuestion[] }>('GET', `/teacher/quizzes/${id}`);
  return { quiz: { id: s.id, title: s.title, created_at: s.created_at, questions: s.questions.map(toUiQuestion) } };
}

/** Neuen (leeren) Fragensatz erstellen */
export async function apiQuizCreate(title: string): Promise<{ quiz: { id: number; title: string } }> {
  const r = await request<{ id: number }>('POST', '/teacher/quizzes', { title });
  return { quiz: { id: r.id, title } };
}

/** Fragensatz umbenennen */
export function apiQuizRename(id: number, title: string): Promise<{ ok: true }> {
  return request('PATCH', `/teacher/quizzes/${id}`, { title });
}

/** Fragensatz loeschen */
export function apiQuizDelete(id: number): Promise<{ ok: true }> {
  return request('DELETE', `/teacher/quizzes/${id}`);
}

/** UI-Frage → Server-Format (correct_idx; Punkte vergibt der Server nach Zeit, max. 1000) */
function toServerQuestion(q: Partial<Omit<QuizQuestion, 'id' | 'position'>>) {
  const out: Record<string, unknown> = {};
  if (q.question !== undefined) out.question = q.question;
  if (q.code !== undefined) out.code = q.code ?? undefined;
  if (q.options !== undefined) out.options = q.options;
  if (q.correct_index !== undefined) out.correct_idx = q.correct_index;
  if (q.time_limit !== undefined) out.time_limit = q.time_limit;
  return out;
}

/** Frage hinzufügen */
export async function apiQuizAddQuestion(
  quizId: number,
  q: Omit<QuizQuestion, 'id' | 'position'>,
): Promise<{ question: QuizQuestion }> {
  const r = await request<{ question: ServerQuestion }>('POST', `/teacher/quizzes/${quizId}/questions`, toServerQuestion(q));
  return { question: toUiQuestion(r.question) };
}

/** Frage aktualisieren */
export async function apiQuizUpdateQuestion(
  quizId: number,
  questionId: number,
  q: Partial<Omit<QuizQuestion, 'id' | 'position'>>,
): Promise<{ question: QuizQuestion }> {
  const r = await request<{ question: ServerQuestion }>('PATCH', `/teacher/quizzes/${quizId}/questions/${questionId}`, toServerQuestion(q));
  return { question: toUiQuestion(r.question) };
}

/** Frage loeschen */
export function apiQuizDeleteQuestion(quizId: number, questionId: number): Promise<{ ok: true }> {
  return request('DELETE', `/teacher/quizzes/${quizId}/questions/${questionId}`);
}

/** Sitzung starten (eigener Fragensatz) */
export async function apiQuizStart(
  quizId: number,
  opts?: { class_id?: number },
): Promise<QuizSession> {
  const r = await request<{ id: number; pin: string }>('POST', '/teacher/quiz-sessions', { quiz_id: quizId, ...opts });
  return { session_id: r.id, pin: r.pin };
}

// ---------------------------------------------------------------------------
// Quiz-Bank (automatische Fragensaetze)
// ---------------------------------------------------------------------------

export type QuizBankEntry = {
  lesson_id: string;
  title: string;
  question_count: number;
};

/** Liste aller Lektionen mit Fragensatz aus der Quiz-Bank */
export function apiQuizBankList(): Promise<QuizBankEntry[]> {
  return request('GET', '/teacher/quiz-bank');
}

/** Auto-Quiz aus Bank starten */
export async function apiQuizStartFromBank(
  lessonId: string,
  opts?: { class_id?: number },
): Promise<QuizSession> {
  const r = await request<{ id: number; pin: string }>('POST', '/teacher/quiz-sessions', { bank_lesson_id: lessonId, ...opts });
  return { session_id: r.id, pin: r.pin };
}

/** Sitzung beenden */
export function apiQuizEnd(sessionId: number): Promise<{ ok: true }> {
  return request('POST', `/teacher/quiz-sessions/${sessionId}/end`, {});
}

/** Ergebnisse einer Sitzung laden (Server: /result) */
export async function apiQuizResults(sessionId: number): Promise<{ result: QuizResult }> {
  const r = await request<{
    id: number; title: string; ended_at: number | null; question_total: number;
    participants: { display_name: string; total_points: number; correct: number }[];
    question_stats: QuizQuestionStat[];
  }>('GET', `/teacher/quiz-sessions/${sessionId}/result`);
  return {
    result: {
      session_id: r.id,
      quiz_title: r.title,
      ended_at: r.ended_at ?? Math.floor(Date.now() / 1000),
      participants: r.participants.map((p) => ({ display_name: p.display_name, total_points: p.total_points, correct: p.correct, total: r.question_total })),
      question_stats: r.question_stats,
    },
  };
}

// ---------------------------------------------------------------------------
// WebSocket-Helfer
// ---------------------------------------------------------------------------

/**
 * WS-URL ermitteln.
 * Im Browser: wss://host/api/quiz/ws  (hinter Nginx)
 * Im Dev: ws://localhost:PORT/api/quiz/ws  (vite proxy leitet weiter)
 */
export function quizWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/api/quiz/ws`;
}

// ---------------------------------------------------------------------------
// WS-Nachrichten-Typen (Server → Client)
// ---------------------------------------------------------------------------

export type WsInMsg =
  | { type: 'error'; code: string; message: string }
  | { type: 'joined'; role: 'teacher' | 'student'; room_id?: number; display_name?: string; participant_id?: number }
  | { type: 'lobby_state'; participants: string[]; count: number; expected?: number }
  | { type: 'question_start'; question_index: number; question_total: number; question_id: number; question: string; code?: string; options: string[]; time_limit: number; started_at: number }
  | { type: 'answer_ack'; correct: boolean; points: number; total_points: number }
  | { type: 'reveal'; correct_idx: number; answer_counts: number[]; correct_ratio: number }
  | { type: 'leaderboard'; rankings: { rank: number; display_name: string; points: number }[] }
  | { type: 'quiz_ended' }
  | { type: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// WS-Nachrichten-Typen (Client → Server)
// ---------------------------------------------------------------------------

/** Lehrkraft tritt Raum bei */
export type WsMsgTeacherJoin = { type: 'teacher_join'; room_id: number; token?: string };
/** Schüler tritt per PIN bei */
export type WsMsgStudentJoin = { type: 'student_join'; pin: string; token?: string };
export type WsMsgNextQuestion = { type: 'next_question' };
export type WsMsgReveal = { type: 'reveal' };
export type WsMsgEndQuiz = { type: 'end_quiz' };
export type WsMsgAnswer = { type: 'answer'; question_id: number; chosen_idx: number };
