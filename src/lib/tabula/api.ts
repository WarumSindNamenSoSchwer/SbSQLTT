/**
 * Kleiner fetch-Client fuer die Tabula-API.
 *
 * - Basis-URL: /api
 * - credentials: 'include' (Session-Cookie)
 * - JSON-Request/-Response
 * - Netzwerkfehler -> „Keine Verbindung zum Server"
 * - Deutsche Fehlermeldungen aus Server-Antworten (Feld „fehler")
 */

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

export interface RegisterStudentBody {
  role: 'student';
  username: string;
  display_name: string;
  password: string;
  email?: string;
  class_code?: string;
}

export interface RegisterTeacherBody {
  role: 'teacher';
  username: string;
  display_name: string;
  name: string;
  email: string;
  password: string;
  school?: string;
  terms_accepted: true;
}

export interface PublicUser {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  name: string | null;
  school: string | null;
  role: 'student' | 'teacher';
  created_day: string;
  last_login_at: number | null;
  /** 1 nach Passwort-Reset durch Lehrkraft: muss beim nächsten Login geändert werden */
  must_change_password?: number;
}

export interface ProgressItem {
  lesson_id: string;
  step: number;
  done: boolean;
  attempts: number;
  updated_at: number;
}

export interface AttemptItem {
  lesson_id: string;
  step: number;
  query: string;
  error_msg: string;
}

// ---------------------------------------------------------------------------
// API-Funktionen
// ---------------------------------------------------------------------------

/** POST /api/register */
export function apiRegister(body: RegisterStudentBody | RegisterTeacherBody): Promise<{ ok: true }> {
  return request('POST', '/register', body);
}

/** POST /api/login */
export function apiLogin(loginInput: string, password: string): Promise<{ ok: true }> {
  return request('POST', '/login', { login: loginInput, password });
}

/** POST /api/logout */
export function apiLogout(): Promise<{ ok: true }> {
  return request('POST', '/logout');
}

/** GET /api/me */
export function apiMe(): Promise<{ user: PublicUser }> {
  return request('GET', '/me');
}

/** PATCH /api/me */
export function apiPatchMe(body: {
  display_name?: string;
  username?: string;
  current_password?: string;
}): Promise<{ ok: true }> {
  return request('PATCH', '/me', body);
}

/** DELETE /api/me */
export function apiDeleteMe(): Promise<{ ok: true }> {
  return request('DELETE', '/me');
}

/** POST /api/me/password */
export function apiChangePassword(current_password: string, new_password: string): Promise<{ ok: true }> {
  return request('POST', '/me/password', { current_password, new_password });
}

/** POST /api/password/forgot */
export function apiPasswordForgot(email: string): Promise<{ ok: true }> {
  return request('POST', '/password/forgot', { email });
}

/** POST /api/password/reset */
export function apiPasswordReset(token: string, password: string): Promise<{ ok: true }> {
  return request('POST', '/password/reset', { token, password });
}

/** POST /api/classes/join */
export function apiJoinClass(code: string): Promise<{ ok: true; class_name: string }> {
  return request('POST', '/classes/join', { code });
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
  last_attempts: (AttemptItem & { updated_at: number })[];
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

export interface TeacherStudent {
  id: number;
  display_name: string;
  username: string;
  joined_at: number;
}

export interface DashboardStudent {
  user_id: number;
  display_name: string;
  status: 'done' | 'in_progress' | 'stuck' | 'not_started';
  step: number | null;
  total_steps: number | null;
  attempts: number;
  last_active: number | null;
}

export interface MatrixRow {
  user_id: number;
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
  query: string;
  error_msg: string;
  updated_at: number;
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

/** GET /api/teacher/classes/:id/dashboard */
export function apiTeacherDashboard(id: number): Promise<{ students: DashboardStudent[]; focus_lesson: string | null; updated_at: number }> {
  return request('GET', `/teacher/classes/${id}/dashboard`);
}

/** GET /api/teacher/classes/:id/matrix */
export function apiTeacherMatrix(id: number): Promise<{ rows: MatrixRow[]; lesson_ids: string[] }> {
  return request('GET', `/teacher/classes/${id}/matrix`);
}

/** GET /api/teacher/classes/:id/students */
export function apiTeacherGetStudents(id: number): Promise<{ students: TeacherStudent[] }> {
  return request('GET', `/teacher/classes/${id}/students`);
}

/** PATCH /api/teacher/classes/:id/students/:uid */
export function apiTeacherRenameStudent(
  classId: number,
  userId: number,
  display_name: string,
): Promise<{ ok: true }> {
  return request('PATCH', `/teacher/classes/${classId}/students/${userId}`, { display_name });
}

/** DELETE /api/teacher/classes/:id/students/:uid */
export function apiTeacherRemoveStudent(classId: number, userId: number): Promise<{ ok: true }> {
  return request('DELETE', `/teacher/classes/${classId}/students/${userId}`);
}

/** GET /api/teacher/classes/:id/students/:uid/last-attempt */
export function apiTeacherLastAttempt(
  classId: number,
  userId: number,
): Promise<{ last_attempt: LastAttempt | null }> {
  return request('GET', `/teacher/classes/${classId}/students/${userId}/last-attempt`);
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

/** POST /api/teacher/classes/:id/students/:uid/password-reset */
export function apiTeacherPasswordReset(
  classId: number,
  userId: number,
  new_password: string,
): Promise<{ ok: true }> {
  return request('POST', `/teacher/classes/${classId}/students/${userId}/password-reset`, { new_password });
}
