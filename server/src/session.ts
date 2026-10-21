/**
 * Sitzungsverwaltung (K6).
 *
 * - Token: 32 Byte kryptografisch zufaellig, als Hex-String im Cookie
 * - Gespeichert: nur SHA-256 des Tokens (sessions.id_hash)
 * - Cookie: tabula_session, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 Tage
 */
import { randomBytes } from 'node:crypto'
import type { Db } from './db.js'
import { sha256hex } from './db.js'

export const SESSION_COOKIE_NAME = 'tabula_session'
/** 30 Tage in Sekunden */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
/** 30 Tage in Millisekunden */
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000

export interface SessionRow {
  id_hash: string
  user_id: number
  expires_at: number
}

/**
 * Erzeugt eine neue Sitzung und speichert sie in der DB.
 * Gibt das rohe Token (Hex) zurueck, das als Cookie-Wert gesetzt wird.
 */
export function createSession(db: Db, userId: number, now?: number): string {
  const rawToken = randomBytes(32).toString('hex')
  const idHash = sha256hex(rawToken)
  const nowTs = Math.floor((now ?? Date.now()) / 1000)
  const expiresAt = nowTs + SESSION_TTL_SECONDS

  db.prepare(
    'INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(idHash, userId, expiresAt)

  return rawToken
}

/**
 * Prueft ein Token und gibt die Sitzungszeile zurueck, oder null wenn ungueltig/abgelaufen.
 */
export function validateSession(db: Db, rawToken: string, now?: number): SessionRow | null {
  const idHash = sha256hex(rawToken)
  const nowTs = Math.floor((now ?? Date.now()) / 1000)
  const row = db.prepare(
    'SELECT id_hash, user_id, expires_at FROM sessions WHERE id_hash = ? AND expires_at > ?'
  ).get(idHash, nowTs) as SessionRow | undefined
  return row ?? null
}

/**
 * Loescht eine Sitzung (Logout).
 */
export function deleteSession(db: Db, rawToken: string): void {
  const idHash = sha256hex(rawToken)
  db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash)
}

/**
 * Loescht alle Sitzungen eines Benutzers.
 */
export function deleteAllSessions(db: Db, userId: number): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

/**
 * Loescht abgelaufene Sitzungen (Cleanup-Job).
 */
export function deleteExpiredSessions(db: Db, now?: number): number {
  const nowTs = Math.floor((now ?? Date.now()) / 1000)
  const result = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowTs)
  return result.changes
}

/**
 * Cookie-Optionen nach K6.
 * sameSite: 'lax' erlaubt Navigation von anderen Seiten,
 * blockiert aber Cross-Site-POST (ausreichend zusammen mit CSRF-Origin-Check).
 */
export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}
