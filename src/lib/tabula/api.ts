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
