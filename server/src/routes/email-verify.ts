/**
 * Bestätigung der E-Mail-Adresse von Lehrkräften (K7).
 *
 * - Beim Registrieren einer Lehrkraft wird ein Link verschickt (24 Stunden gültig, einmalig).
 * - POST /api/email/verify { token }   bestätigt die Adresse
 * - POST /api/email/resend              schickt einen neuen Link (angemeldet, Rate-Limit)
 * Token: 32 Byte zufällig, nur SHA-256 gespeichert. Keine IP-Speicherung.
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Db } from '../db.js'
import { sha256hex } from '../db.js'
import type { MailSender } from '../mail.js'
import { validateSession, SESSION_COOKIE_NAME } from '../session.js'
import { RateLimiter } from '../plugins/ratelimit.js'

export const VERIFY_TTL_SECONDS = 24 * 60 * 60

/** Legt ein neues Token an (alte des Nutzers werden ersetzt) und verschickt die Mail. */
export async function sendVerificationMail(
  db: Db,
  mail: MailSender,
  siteUrl: string,
  user: { id: number; email: string; display_name: string }
): Promise<void> {
  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(user.id)
  const raw = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256hex(raw), user.id, Math.floor(Date.now() / 1000) + VERIFY_TTL_SECONDS)
  await mail.send({
    to: user.email,
    subject: 'E-Mail-Adresse bestätigen · Tabula',
    text: [
      `Hallo ${user.display_name},`,
      '',
      'bitte bestätigen Sie Ihre E-Mail-Adresse für Ihr Lehrkraft-Konto bei Tabula:',
      '',
      `${siteUrl}/email-bestaetigen?token=${raw}`,
      '',
      'Der Link ist 24 Stunden gültig und kann nur einmal verwendet werden.',
      'Wenn Sie kein Konto angelegt haben, können Sie diese E-Mail ignorieren.',
      '',
      'Tabula SQL-Trainer · https://www.tabulasql.de',
    ].join('\n'),
  })
}

const verifySchema = z.object({ token: z.string().min(10).max(128) })

export interface EmailVerifyOptions {
  db: Db
  mail: MailSender
  siteUrl: string
}

const emailVerifyRoutes: FastifyPluginAsync<EmailVerifyOptions> = async (fastify, opts) => {
  const { db, mail, siteUrl } = opts
  // Höchstens 3 neue Links je Konto und Stunde (nur im Arbeitsspeicher)
  const resendLimit = new RateLimiter(3, 60 * 60 * 1000)

  fastify.post('/email/verify', async (req, reply) => {
    const parsed = verifySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ fehler: 'Ungültiger Link.' })
    const now = Math.floor(Date.now() / 1000)
    const row = db.prepare(
      'SELECT user_id FROM email_verifications WHERE token_hash = ? AND expires_at > ?'
    ).get(sha256hex(parsed.data.token), now) as { user_id: number } | undefined
    if (!row) return reply.code(400).send({ fehler: 'Link ungültig oder abgelaufen.' })
    db.transaction(() => {
      db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(now, row.user_id)
      db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(row.user_id)
    })()
    return reply.send({ ok: true })
  })

  fastify.post('/email/resend', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME]
    const session = token ? validateSession(db, token) : null
    if (!session) return reply.code(401).send({ fehler: 'Nicht angemeldet.' })
    const user = db.prepare(
      "SELECT id, email, display_name, email_verified_at FROM users WHERE id = ? AND role = 'teacher'"
    ).get(session.user_id) as { id: number; email: string | null; display_name: string; email_verified_at: number | null } | undefined
    if (!user || !user.email) return reply.code(400).send({ fehler: 'Keine E-Mail-Adresse hinterlegt.' })
    if (user.email_verified_at) return reply.send({ ok: true, already: true })
    if (!resendLimit.check(String(user.id))) {
      return reply.code(429).send({ fehler: 'Zu viele Versuche. Bitte warten Sie etwas.' })
    }
    await sendVerificationMail(db, mail, siteUrl, { id: user.id, email: user.email, display_name: user.display_name })
    return reply.send({ ok: true })
  })
}

export default emailVerifyRoutes
