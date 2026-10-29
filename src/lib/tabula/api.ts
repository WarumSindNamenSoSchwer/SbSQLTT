/**
 * Kleiner fetch-Client fuer die Tabula-API.
 *
 * - Basis-URL: /api
 * - credentials: 'include' (Session-Cookie)
 * - JSON-Request/-Response
 * - Netzwerkfehler -> „Keine Verbindung zum Server"
 * - Deutsche Fehlermeldungen aus Server-Antworten (Feld „fehler")
 */

import { decryptName, decryptAttempt } from './keystore.js';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
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
    let msg = `Serverfehler (${response.status}).`;
    try {
      const data = await response.json();
      if (typeof data?.fehler === 'string' && data.fehler) {
        msg = data.fehler;
      }
    } catch {
      // ignore parse error, use default message
    }
    throw new ApiError(response.status, msg);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface TeacherKeys {
  public_key: string;
  wrapped_by_password: string;
  wrapped_by_recovery: string;
}

export interface RegisterTeacherBody {
  display_name: string;
  name: string;
  email: string;
  password: string;
  school?: string;
  terms_accepted: true;
  keys: TeacherKeys;
}

export interface StudentClassInfo {
  id: number;
  name: string;
  code: string;
  class_salt: string;
  teacher_name: string;
  public_key: string;
}

export interface TeacherUser {
  id: number;
  role: 'teacher';
  display_name: string;
  email: string;
  name: string | null;
  school: string | null;
  created_day: string;
  last_login_at: number | null;
  email_verified_at: number | null;
  needs_key_recovery: boolean;
  keys: { public_key: string | null; wrapped_by_password: string | null; wrapped_by_recovery: string | null };
}

export interface StudentUser {
  id: number;
  role: 'student';
  last_login_at: number | null;
  class: StudentClassInfo | null;
}

export type PublicUser = TeacherUser | StudentUser;

export interface ProgressItem {
  lesson_id: string;
  step: number;
  done: boolean;
  attempts: number;
  updated_at: number;
}

/** Letzte Abfrage: verschlüsselt für die Lehrkraft (sealed), dazu nur das Fehler-Kennzeichen */
export interface AttemptItem {
  lesson_id: string;
  step: number;
  sealed: string;
  has_error: boolean;
}

export interface ClassLookup {
  class_name: string;
  teacher_name: string;
  class_salt: string;
  public_key: string;
}

// ---------------------------------------------------------------------------
// API-Funktionen: Lehrkraft-Konto
// ---------------------------------------------------------------------------

/** POST /api/register (nur Lehrkräfte) */
export function apiRegister(body: RegisterTeacherBody): Promise<{ ok: true }> {
  return request('POST', '/register', body);
}

/** POST /api/login (Lehrkraft, mit E-Mail-Adresse) */
export function apiLogin(email: string, password: string): Promise<{ ok: true }> {
  return request('POST', '/login', { login: email, password });
}

/** POST /api/logout (Lehrkraft und Schüler) */
export function apiLogout(): Promise<{ ok: true }> {
  return request('POST', '/logout');
}

/** GET /api/me */
export function apiMe(): Promise<{ user: PublicUser }> {
  return request('GET', '/me');
}

/** PATCH /api/me (Lehrkraft) */
export function apiPatchMe(body: { display_name?: string; name?: string; school?: string | null }): Promise<{ ok: true }> {
  return request('PATCH', '/me', body);
}

/** DELETE /api/me (Lehrkraft, löscht auch Klassen und deren Schüler). Braucht das aktuelle Passwort. */
export function apiDeleteMe(password: string): Promise<{ ok: true }> {
  return request('DELETE', '/me', { password });
}

/** POST /api/me/password (Lehrkraft; privater Schlüssel neu verpackt) */
export function apiChangePassword(current_password: string, new_password: string, wrapped_by_password: string): Promise<{ ok: true }> {
  return request('POST', '/me/password', { current_password, new_password, wrapped_by_password });
}

/**
 * POST /api/me/keys. Nach Passwort-Reset genügt die Sitzung (Schlüssel neu verpackt oder neues Paar).
 * Sonst (z. B. neuer Wiederherstellungscode) braucht der Server das aktuelle Passwort.
 */
export function apiSetKeys(keys: TeacherKeys, current_password?: string): Promise<{ ok: true; new_pair: boolean }> {
  return request('POST', '/me/keys', current_password ? { keys, current_password } : { keys });
}

/** POST /api/email/verify (Lehrkraft bestätigt E-Mail-Adresse, K7) */
export function apiVerifyEmail(token: string): Promise<{ ok: true }> {
  return request('POST', '/email/verify', { token });
}

/** POST /api/email/resend (neuen Bestätigungslink anfordern) */
export function apiResendVerification(): Promise<{ ok: true; already?: boolean }> {
  return request('POST', '/email/resend');
}

/** POST /api/password/forgot */
export function apiPasswordForgot(email: string): Promise<{ ok: true }> {
  return request('POST', '/password/forgot', { email });
}

/** POST /api/password/reset (meldet die Lehrkraft an; danach Schlüssel wiederherstellen) */
export function apiPasswordReset(token: string, password: string): Promise<{ ok: true; needs_key_recovery: boolean }> {
  return request('POST', '/password/reset', { token, password });
}

// ---------------------------------------------------------------------------
// API-Funktionen: Klassen-Login der Schüler (Name und Passwort verlassen den Browser nie)
// ---------------------------------------------------------------------------

/** GET /api/class-login/lookup */
export function apiClassLookup(code: string): Promise<ClassLookup> {
  return request('GET', `/class-login/lookup?code=${encodeURIComponent(code)}`);
}

/** POST /api/class-login/join */
export function apiClassJoin(code: string, key: string, enc_name: string): Promise<{ ok: true; class_name: string }> {
  return request('POST', '/class-login/join', { code, key, enc_name });
}

/** POST /api/class-login/login */
export function apiClassLogin(code: string, key: string, enc_name?: string): Promise<{ ok: true; class_name: string }> {
  return request('POST', '/class-login/login', { code, key, enc_name });
}

/** POST /api/class-login/reset (Einmal-Code der Lehrkraft) */
export function apiClassReset(code: string, reset_code: string, key: string, enc_name: string): Promise<{ ok: true; class_name: string }> {
  return request('POST', '/class-login/reset', { code, reset_code, key, enc_name });
}

/** POST /api/student/rekey (Name oder Passwort ändern) */
export function apiStudentRekey(old_key: string, new_key: string, enc_name: string): Promise<{ ok: true }> {
  return request('POST', '/student/rekey', { old_key, new_key, enc_name });
}

/** POST /api/student/leave (aus der Klasse austreten, löscht alle Daten) */
export function apiStudentLeave(): Promise<{ ok: true }> {
  return request('POST', '/student/leave');
}

/** GET /api/classes/mine */
export function apiGetClasses(): Promise<{
  classes: {
    id: number;
    name: string;
    focus_lesson: string | null;
    lessons: { lesson_id: string; unlocked: boolean; sort_order: number; is_focus: boolean }[];
  }[];
}> {
  return request('GET', '/classes/mine');
}

/** GET /api/progress */
export function apiGetProgress(): Promise<{
  progress: ProgressItem[];
  last_attempts: { lesson_id: string; step: number; has_error: number; updated_at: number }[];
}> {
  return request('GET', '/progress');
}

/** PUT /api/progress */
export function apiPutProgress(
  progress: ProgressItem[],
  last_attempts?: AttemptItem[],
): Promise<{ ok: true }> {
  return request('PUT', '/progress', { progress, last_attempts });
}

// ---------------------------------------------------------------------------
// Lehrkraft-API Typen
// ---------------------------------------------------------------------------

export interface TeacherClass {
  id: number;
  name: string;
  join_code: string;
  focus_lesson: string | null;
  archived: number;
  created_at: number;
  student_count?: number;
  stuck_count?: number;
}

/** Schüler aus Sicht der Lehrkraft: Name nur verschlüsselt (enc_name), der Browser entschlüsselt */
export interface TeacherStudent {
  id: number;
  enc_name: string | null;
  /** Im Browser der Lehrkraft entschlüsselt (Platzhalter „Schüler N“, wenn nicht lesbar) */
  display_name: string;
  joined_at: number;
  last_login_at: number | null;
}

export interface DashboardStudent {
  user_id: number;
  enc_name: string | null;
  /** Im Browser der Lehrkraft entschlüsselt */
  display_name: string;
  status: 'done' | 'in_progress' | 'stuck' | 'not_started';
  /** Anzahl erledigter Uebungsschritte */
  step: number | null;
  total_steps: number | null;
  /** 0-basierter Index des aktuellen Schritts (erster offener) */
  current_step: number | null;
  attempts: number;
  last_active: number | null;
}

export interface MatrixRow {
  user_id: number;
  enc_name: string | null;
  /** Im Browser der Lehrkraft entschlüsselt */
  display_name: string;
  cells: Array<{ status: 'done' | 'started' | 'stuck' | 'open' | 'locked' }>;
  progress: string;
}

export interface LessonSetting {
  lesson_id: string;
  unlocked: boolean;
  sort_order: number;
  is_focus: boolean;
}

export interface LastAttempt {
  lesson_id: string;
  step: number;
  /** Abfrage und Fehlermeldung, verschlüsselt für die Lehrkraft */
  sealed: string;
  has_error: number;
  updated_at: number;
  /** Im Browser der Lehrkraft entschlüsselt (leer, wenn nicht lesbar) */
  query: string;
  error_msg: string;
}

// ---------------------------------------------------------------------------
// Lehrkraft-API Funktionen
// ---------------------------------------------------------------------------

/** GET /api/teacher/classes */
export function apiTeacherGetClasses(): Promise<{ classes: TeacherClass[] }> {
  return request('GET', '/teacher/classes');
}

/** POST /api/teacher/classes */
export function apiTeacherCreateClass(name: string): Promise<{ ok: true; class: TeacherClass }> {
  return request('POST', '/teacher/classes', { name });
}

/** GET /api/teacher/classes/:id */
export function apiTeacherGetClass(id: number): Promise<{ class: TeacherClass }> {
  return request('GET', `/teacher/classes/${id}`);
}

/** PATCH /api/teacher/classes/:id */
export function apiTeacherPatchClass(
  id: number,
  body: { name?: string; archived?: boolean },
): Promise<{ ok: true; class: TeacherClass }> {
  return request('PATCH', `/teacher/classes/${id}`, body);
}

/** DELETE /api/teacher/classes/:id */
export function apiTeacherDeleteClass(id: number): Promise<{ ok: true }> {
  return request('DELETE', `/teacher/classes/${id}`);
}

/** POST /api/teacher/classes/:id/code */
export function apiTeacherNewCode(id: number): Promise<{ ok: true; join_code: string }> {
  return request('POST', `/teacher/classes/${id}/code`);
}

/** GET /api/teacher/classes/:id/dashboard (Server-Antwort auf UI-Modell abgebildet) */
export async function apiTeacherDashboard(id: number): Promise<{ students: DashboardStudent[]; focus_lesson: string | null; updated_at: number }> {
  const STATUS: Record<string, DashboardStudent['status']> = {
    fertig: 'done', dran: 'in_progress', haengt_fest: 'stuck', noch_nicht_begonnen: 'not_started', kein_fokus: 'not_started',
  };
  const res = await request<{ focus_lesson: string | null; students: Array<{
    user_id: number; enc_name: string | null; status: string;
    steps_done?: number; steps_total?: number; current_step?: number | null; attempts?: number; last_active?: number | null;
  }> }>('GET', `/teacher/classes/${id}/dashboard`);
  const names = await Promise.all(res.students.map((s, i) => decryptName(s.enc_name, i + 1)));
  return {
    focus_lesson: res.focus_lesson,
    updated_at: Math.floor(Date.now() / 1000),
    students: res.students.map((s, i) => ({
      user_id: s.user_id,
      enc_name: s.enc_name,
      display_name: names[i],
      status: STATUS[s.status] ?? 'not_started',
      // step = Anzahl erledigter Übungen, total_steps = Übungen der Fokus-Lektion
      step: s.steps_total != null ? (s.steps_done ?? 0) : null,
      total_steps: s.steps_total ?? null,
      // current_step: 0-basierter Index des ersten offenen Schritts (fuer AUFGABE-Text)
      current_step: s.current_step ?? null,
      attempts: s.attempts ?? 0,
      last_active: s.last_active ?? null,
    })),
  };
}

/** POST /api/teacher/classes/:id/students/:uid/complete - Schüler-Schritt als erledigt markieren */
export function apiTeacherComplete(
  classId: number,
  userId: number,
  lesson_id: string,
  step: number,
): Promise<{ ok: true }> {
  return request('POST', `/teacher/classes/${classId}/students/${userId}/complete`, { lesson_id, step });
}

/** GET /api/teacher/classes/:id/matrix (Server-Antwort auf Zeilen abgebildet) */
export async function apiTeacherMatrix(id: number): Promise<{ rows: MatrixRow[]; lesson_ids: string[] }> {
  const CELL: Record<string, MatrixRow['cells'][number]['status']> = {
    fertig: 'done', begonnen: 'started', haengt_fest: 'stuck', nicht_begonnen: 'open',
  };
  const res = await request<{ students: Array<{ id: number; enc_name: string | null }>; lesson_ids?: string[]; matrix: Record<string, Record<string, string>> }>(
    'GET', `/teacher/classes/${id}/matrix`);
  const ids = res.lesson_ids ?? [];
  const names = await Promise.all(res.students.map((s, i) => decryptName(s.enc_name, i + 1)));
  return {
    lesson_ids: ids,
    rows: res.students.map((s, i) => {
      const cells = ids.map((lid) => ({ status: CELL[res.matrix[lid]?.[s.id] ?? ''] ?? 'open' }));
      const done = cells.filter((c) => c.status === 'done').length;
      return { user_id: s.id, enc_name: s.enc_name, display_name: names[i], cells, progress: `${done} / ${ids.length}` };
    }),
  };
}

/** GET /api/teacher/classes/:id/students (Namen im Browser entschlüsselt) */
export async function apiTeacherGetStudents(id: number): Promise<{ students: TeacherStudent[] }> {
  const res = await request<{ students: Omit<TeacherStudent, 'display_name'>[] }>('GET', `/teacher/classes/${id}/students`);
  const names = await Promise.all(res.students.map((s, i) => decryptName(s.enc_name, i + 1)));
  return { students: res.students.map((s, i) => ({ ...s, display_name: names[i] })) };
}

/** DELETE /api/teacher/classes/:id/students/:uid */
export function apiTeacherRemoveStudent(classId: number, userId: number): Promise<{ ok: true }> {
  return request('DELETE', `/teacher/classes/${classId}/students/${userId}`);
}

/** GET /api/teacher/classes/:id/students/:uid/last-attempt */
export async function apiTeacherLastAttempt(
  classId: number,
  userId: number,
): Promise<{ last_attempt: LastAttempt | null }> {
  const res = await request<{ last_attempts: Omit<LastAttempt, 'query' | 'error_msg'>[] }>('GET', `/teacher/classes/${classId}/students/${userId}/last-attempt`);
  // Server liefert neueste zuerst; Abfrage und Fehlermeldung entschlüsselt nur dieser Browser
  const la = res.last_attempts?.[0];
  if (!la) return { last_attempt: null };
  const open = await decryptAttempt(la.sealed);
  return { last_attempt: { ...la, query: open?.q ?? '', error_msg: open?.e ?? (la.has_error ? 'Fehler (nicht lesbar)' : '') } };
}

/** PUT /api/teacher/classes/:id/lessons */
export function apiTeacherPutLessons(
  classId: number,
  lessons: LessonSetting[],
): Promise<{ ok: true }> {
  return request('PUT', `/teacher/classes/${classId}/lessons`, { lessons });
}

/** GET /api/teacher/classes/:id/lessons */
export function apiTeacherGetLessons(classId: number): Promise<{ lessons: LessonSetting[] }> {
  return request('GET', `/teacher/classes/${classId}/lessons`);
}

/** POST /api/teacher/classes/:id/students/:uid/reset-code (Einmal-Code, 15 Minuten) */
export function apiTeacherResetCode(classId: number, userId: number): Promise<{ ok: true; code: string; expires_at: number }> {
  return request('POST', `/teacher/classes/${classId}/students/${userId}/reset-code`);
}
