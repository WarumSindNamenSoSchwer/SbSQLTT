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
import { buildSystemMail } from '../mail-templates.js'
import type { RateLimiters } from '../plugins/ratelimit.js'
import { sha256hex } from '../db.js'
import { hashPassword } from '../password.js'
import { createSession, SESSION_COOKIE_NAME, sessionCookieOptions } from '../session.js'

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
    if (!limits.forgot.check(email.trim().toLowerCase())) {
      return reply.code(429).send({ fehler: 'Zu viele Versuche. Bitte warte kurz.' })
    }

    const user = db.prepare(
      "SELECT id, username, display_name, email, created_day FROM users WHERE email = ? AND role = 'teacher'"
    ).get(email.trim().toLowerCase()) as { id: number; username: string; display_name: string; email: string; created_day: string } | undefined

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

    // E-Mail versenden. Ein Versandfehler darf nicht verraten, dass die Adresse existiert:
    // gleiche Antwort wie oben, Fehler nur ohne Adresse protokollieren.
    try {
      await mail.send(buildSystemMail({
        to: user.email,
        subject: 'Passwort zurücksetzen · Tabula',
        preheader: 'Ihr Link für ein neues Passwort, eine Stunde gültig.',
        pose: 'hint',
        greeting: `Hallo ${user.display_name},`,
        intro: [
          'für Ihr Lehrkraft-Konto bei Tabula wurde ein neues Passwort angefordert. Mit dem Button legen Sie innerhalb einer Stunde ein neues fest.',
        ],
        button: { label: 'Neues Passwort festlegen', url: `${siteUrl}/passwort-zuruecksetzen?token=${rawToken}` },
        callout: 'Halten Sie danach Ihren Wiederherstellungscode bereit, damit die Namen Ihrer Schüler sofort wieder lesbar sind.',
        notes: [
          'Der Link funktioniert nur einmal. Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren, Ihr Passwort bleibt dann unverändert.',
        ],
        siteUrl,
      }))
    } catch {
      fastify.log.warn({ event: 'reset_mail_failed' })
    }

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
      "SELECT id, username, created_day FROM users WHERE id = ? AND role = 'teacher'"
    ).get(reset.user_id) as { id: number; username: string; created_day: string } | undefined

    if (!user) {
      return reply.code(400).send({ fehler: 'Konto nicht gefunden.' })
    }

    // Token als verbraucht markieren (einmalig, K7)
    db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(tokenHash)

    // Neuer Hash mit unverändertem Benutzernamen (K3). must_change_password = 1 bedeutet hier:
    // Der private Schlüssel ist noch mit dem alten Passwort verpackt. Der Browser fragt nach dem
    // Wiederherstellungscode (oder legt ein neues Schlüsselpaar an) und schickt das Ergebnis an /api/me/keys.
    const newHash = await hashPassword(password, user.username, user.created_day)
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(newHash, user.id)
      // Alle Sitzungen beenden (Sicherheit: altes Passwort gilt nicht mehr)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
    })()

    // Direkt anmelden, damit der Schlüssel im nächsten Schritt neu gesetzt werden kann
    const token = createSession(db, user.id)
    reply.setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
    return reply.send({ ok: true, needs_key_recovery: true })
  })
}

export default passwordRoutes
