/**
 * Passwort-Zuruecksetzen: POST /api/password/forgot, POST /api/password/reset
 *
 * Sicherheit:
 * - Immer gleiche Antwort (kein Benutzer-Enumeration)
 * - Token: 32 Byte zufaellig, NUR SHA-256 gespeichert
 * - 1 Stunde gueltig, einmalig nutzbar
 * - Rate-Limit pro E-Mail
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Db } from '../db.js'
import type { MailSender } from '../mail.js'
import type { RateLimiters } from '../plugins/ratelimit.js'
import { sha256hex } from '../db.js'
import { hashPassword } from '../password.js'

const forgotSchema = z.object({
  email: z.string().email(),
})

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
})

// 1 Stunde in Sekunden
const RESET_TTL_SECONDS = 60 * 60

export interface PasswordPluginOptions {
  db: Db
  mail: MailSender
  limits: RateLimiters
  /** Basis-URL fuer Passwort-Reset-Links, z.B. https://www.tabulasql.de */
  siteUrl: string
}

const passwordRoutes: FastifyPluginAsync<PasswordPluginOptions> = async (fastify, opts) => {
  const { db, mail, limits, siteUrl } = opts

  // POST /api/password/forgot
  fastify.post('/forgot', async (req, reply) => {
    const parsed = forgotSchema.safeParse(req.body)
    if (!parsed.success) {
      // Gleiche Antwort unabhaengig vom Fehler (kein Enumeration)
      return reply.send({ ok: true })
    }
    const { email } = parsed.data

    // Rate-Limit pro E-Mail
    if (!limits.forgot.check(email.toLowerCase())) {
      return reply.code(429).send({ fehler: 'Zu viele Versuche. Bitte warte kurz.' })
    }

    const user = db.prepare(
      'SELECT id, username, email, created_day FROM users WHERE email = ?'
    ).get(email) as { id: number; username: string; email: string; created_day: string } | undefined

    // Immer gleiche Antwort (verhindert Benutzer-Enumeration, K7)
    if (!user) return reply.send({ ok: true })

    // Bestehende Token fuer diesen Nutzer loeschen
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id)

    // Neues Token
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = sha256hex(rawToken)
    const expiresAt = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS

    db.prepare(
      'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
    ).run(tokenHash, user.id, expiresAt)

    // E-Mail versenden (Interface MailSender, vorerst In-Memory-Stub)
    await mail.send({
      to: user.email,
      subject: 'Passwort zuruecksetzen - Tabula',
      text: [
        `Hallo ${user.username},`,
        '',
        'jemand hat fuer dein Konto eine Passwort-Zuruecksetzen-Anfrage gestellt.',
        'Klicke auf den folgenden Link, um dein Passwort innerhalb einer Stunde zurueckzusetzen:',
        '',
        `${siteUrl}/passwort-zuruecksetzen?token=${rawToken}`,
        '',
        'Wenn du das nicht warst, kannst du diese E-Mail ignorieren.',
        '',
        'Tabula SQL-Trainer',
      ].join('\n'),
    })

    return reply.send({ ok: true })
  })

  // POST /api/password/reset
  fastify.post('/reset', async (req, reply) => {
    const parsed = resetSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ fehler: 'Ungültige Eingabe.' })
    }
    const { token: rawToken, password } = parsed.data

    const tokenHash = sha256hex(rawToken)
    const nowTs = Math.floor(Date.now() / 1000)

    const reset = db.prepare(
      'SELECT token_hash, user_id, expires_at, used FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?'
    ).get(tokenHash, nowTs) as { token_hash: string; user_id: number; expires_at: number; used: number } | undefined

    if (!reset) {
      return reply.code(400).send({ fehler: 'Link ungültig oder abgelaufen.' })
    }

    const user = db.prepare(
      'SELECT id, username, created_day FROM users WHERE id = ?'
    ).get(reset.user_id) as { id: number; username: string; created_day: string } | undefined

    if (!user) {
      return reply.code(400).send({ fehler: 'Konto nicht gefunden.' })
    }

    // Token als verbraucht markieren (einmalig, K7)
    db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(tokenHash)

    // Neuen Hash mit unveraendertem Benutzernamen (K3)
    const newHash = await hashPassword(password, user.username, user.created_day)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id)

    // Alle Sitzungen des Nutzers loeschen (Sicherheit: alter Hash gehoert nicht mehr)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)

    return reply.send({ ok: true })
  })
}

export default passwordRoutes
