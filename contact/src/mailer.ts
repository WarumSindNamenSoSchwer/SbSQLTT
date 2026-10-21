/**
 * SMTP-Transport fuer den Kontaktformular-Dienst.
 * Liest das Passwort aus /run/secrets/smtp_formular (Docker Secret).
 * Absender: formular@tabulasql.de, Empfaenger: kontakt@tabulasql.de
 *
 * Sicherheit:
 * - Reply-To wird bereinigt (keine Zeilenwechsel)
 * - Absender-Name wird bereinigt
 * - Alle Nutzereingaben werden im HTML-Teil escaped
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
  /** Zeitpunkt des Eingangs (Standard: jetzt) */
  receivedAt?: Date
}

/** Bereinigt einen Header-Wert: entfernt CR, LF und alle Steuerzeichen. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').trim()
}

/** HTML-Escaping fuer Nutzereingaben. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

/** Formatiert Datum und Uhrzeit deutsch in Berliner Zeit, z. B. „21.10.2026, 21:47 Uhr“. */
function formatBerlin(d: Date): string {
  const s = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
  return `${s} Uhr`
}

/** Baut Betreff, Text- und HTML-Teil der Kontaktmail. Exportiert für Tests. */
export function buildContactMail(opts: ContactMailOptions): { subject: string; text: string; html: string } {
  const name = sanitizeHeader(opts.name)
  const email = sanitizeHeader(opts.email)
  const schule = opts.schule ? sanitizeHeader(opts.schule) : ''
  const when = formatBerlin(opts.receivedAt ?? new Date())
  const nachricht = opts.nachricht.replace(/\r\n?/g, '\n').trim()

  const subject = schule ? `Kontaktformular: ${name} (${schule})` : `Kontaktformular: ${name}`

  // Text-Teil: gut lesbar auch ohne HTML
  const rule = '─'.repeat(40)
  const text = [
    'Neue Nachricht über das Kontaktformular auf tabulasql.de',
    '',
    `Name:      ${name}`,
    `E-Mail:    ${email}`,
    `Schule:    ${schule || 'nicht angegeben'}`,
    `Eingang:   ${when}`,
    '',
    rule,
    '',
    nachricht,
    '',
    rule,
    'Direkt auf diese E-Mail antworten: Die Antwort geht an die Absenderin bzw. den Absender.',
    'Bitte nach Erledigung löschen, spätestens nach 6 Monaten (Datenschutzerklärung, Abschnitt Kontaktformular).',
  ].join('\n')

  // HTML-Teil: schlicht, inline-Styles (Mail-Clients ignorieren <style>), Tabula-Farben
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td>` +
    `<td style="padding:6px 0;color:#0f172a;font-size:15px">${v}</td></tr>`
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0">
  <div style="font-size:12px;letter-spacing:.08em;color:#2563eb;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">TABULA · KONTAKTFORMULAR</div>
  <div style="margin-top:6px;font-size:20px;font-weight:600;color:#0f172a">Neue Nachricht von ${esc(name)}</div>
</td></tr>
<tr><td style="padding:16px 24px 8px">
  <table role="presentation" cellpadding="0" cellspacing="0">
    ${row('Name', esc(name))}
    ${row('E-Mail', `<a href="mailto:${esc(email)}" style="color:#2563eb;text-decoration:none">${esc(email)}</a>`)}
    ${row('Schule', schule ? esc(schule) : '<span style="color:#94a3b8">nicht angegeben</span>')}
    ${row('Eingang', esc(when))}
  </table>
</td></tr>
<tr><td style="padding:8px 24px 20px">
  <div style="font-size:12px;letter-spacing:.08em;color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:8px">NACHRICHT</div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:15px;line-height:1.55;color:#0f172a;white-space:pre-wrap">${esc(nachricht)}</div>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">
  Direkt auf diese E-Mail antworten: Die Antwort geht an ${esc(email)}.<br>
  Bitte nach Erledigung löschen, spätestens nach 6 Monaten.
</td></tr>
</table>
</td></tr></table>
</body></html>`

  return { subject, text, html }
}

/** Sendet eine Kontaktnachricht per E-Mail. */
export async function sendContactMail(
  transporter: Transporter,
  opts: ContactMailOptions
): Promise<void> {
  const safeName = sanitizeHeader(opts.name)
  const safeEmail = sanitizeHeader(opts.email)
  const { subject, text, html } = buildContactMail(opts)

  await transporter.sendMail({
    from: '"Tabula Kontaktformular" <formular@tabulasql.de>',
    to: 'kontakt@tabulasql.de',
    replyTo: { name: safeName, address: safeEmail },
    subject,
    text,
    html,
  })
}
