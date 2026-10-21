/**
 * SMTP-Transport fuer den Kontaktformular-Dienst.
 * Liest das Passwort aus /run/secrets/smtp_formular (Docker Secret).
 * Absender: formular@tabulasql.de, Empfaenger: kontakt@tabulasql.de
 *
 * Sicherheit:
 * - Reply-To wird bereinigt (keine Zeilenwechsel)
 * - Absender-Name wird bereinigt
 * - Port 587 / STARTTLS (requireTLS: true) - Port 465 bei Hetzner gesperrt
 */
import { readFileSync } from 'node:fs'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'

export interface ContactMailOptions {
  name: string
  email: string
  schule?: string
  nachricht: string
}

/** Bereinigt einen Header-Wert: entfernt CR, LF und alle Steuerziffern. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').trim()
}

export function createTransporter(overrideOptions?: SMTPTransport.Options): Transporter {
  // Passwort aus Docker-Secret lesen
  let password: string
  try {
    password = readFileSync('/run/secrets/smtp_formular', 'utf8').replace(/[\r\n]+$/, '')
  } catch {
    throw new Error('SMTP-Passwort nicht verfuegbar (/run/secrets/smtp_formular)')
  }

  return nodemailer.createTransport({
    host: 'mail.your-server.de',
    port: 587,
    secure: false,          // STARTTLS, nicht direkt TLS
    requireTLS: true,       // TLS erzwingen (kein Fallback auf Plaintext)
    auth: {
      user: 'formular@tabulasql.de',
      pass: password,
    },
    ...overrideOptions,
  })
}

/** Sendet eine Kontaktnachricht per E-Mail. */
export async function sendContactMail(
  transporter: Transporter,
  opts: ContactMailOptions
): Promise<void> {
  const safeName = sanitizeHeader(opts.name)
  const safeEmail = sanitizeHeader(opts.email)
  const safeSchule = opts.schule ? sanitizeHeader(opts.schule) : ''

  const subject = safeSchule
    ? `Kontakt: ${safeName} (${safeSchule})`
    : `Kontakt: ${safeName}`

  const text = [
    `Name: ${safeName}`,
    `E-Mail: ${safeEmail}`,
    safeSchule ? `Schule: ${safeSchule}` : null,
    '',
    opts.nachricht,
  ]
    .filter((line) => line !== null)
    .join('\n')

  await transporter.sendMail({
    from: '"Tabula Kontaktformular" <formular@tabulasql.de>',
    to: 'kontakt@tabulasql.de',
    replyTo: `${safeName} <${safeEmail}>`,
    subject,
    text,
  })
}
