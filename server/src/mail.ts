/**
 * E-Mail-Versand: Interface, Test-Implementierung und SMTP-Sender.
 *
 * SMTP-Konfiguration (Produktion):
 * - Host:     mail.your-server.de
 * - Port:     587 (STARTTLS, requireTLS: true)
 * - Benutzer: noreply@tabulasql.de
 * - Passwort: aus /run/secrets/smtp_noreply (Docker Secret)
 *
 * Port 465 ist bei Hetzner Cloud ausgehend gesperrt.
 * Der SMTP-Sender wird nur aktiviert, wenn die Secret-Datei vorhanden ist.
 * Fehlt sie, bleibt der NoopMailSender aktiv (keine Aenderung am bisherigen Verhalten).
 */
import { readFileSync, existsSync } from 'node:fs'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

export interface MailAttachment {
  filename: string
  content: Buffer
  contentType: string
  /** Content-ID für eingebettete Bilder (im HTML als cid:…) */
  cid?: string
}

export interface MailMessage {
  to: string
  subject: string
  /** Reiner Text (immer dabei, auch als Fallback zur HTML-Fassung) */
  text: string
  /** Optional gestaltete HTML-Fassung */
  html?: string
  attachments?: MailAttachment[]
}

export interface MailSender {
  send(msg: MailMessage): Promise<void>
}

/**
 * Test-Implementierung: speichert alle Nachrichten im Speicher.
 * Wird in Tests als Stub verwendet.
 */
export class InMemoryMailSender implements MailSender {
  public readonly sent: MailMessage[] = []

  async send(msg: MailMessage): Promise<void> {
    this.sent.push(msg)
  }

  /** Leert die gesendeten Nachrichten */
  clear(): void {
    this.sent.length = 0
  }

  /** Gibt die letzte gesendete Nachricht zurueck */
  get last(): MailMessage | undefined {
    return this.sent.at(-1)
  }
}

/**
 * Platzhalter-Implementierung fuer Produktion ohne konfiguriertes SMTP.
 * Wird aktiv, wenn /run/secrets/smtp_noreply nicht vorhanden ist.
 */
export class NoopMailSender implements MailSender {
  async send(msg: MailMessage): Promise<void> {
    // Keine Empfängeradresse protokollieren (K10: keine personenbezogenen Daten im Log)
    void msg
    console.warn('[MailSender] NOOP: kein SMTP konfiguriert, Mail nicht versendet.')
  }
}

/**
 * Echter SMTP-Sender ueber Hetzner (noreply@tabulasql.de).
 * Port 587 / STARTTLS (requireTLS: true).
 */
export class SmtpMailSender implements MailSender {
  private readonly transporter: Transporter

  constructor(password: string) {
    this.transporter = nodemailer.createTransport({
      host: 'mail.your-server.de',
      port: 587,
      secure: false,       // STARTTLS, nicht direktes TLS
      requireTLS: true,    // TLS erzwingen, kein Fallback auf Plaintext
      auth: {
        user: 'noreply@tabulasql.de',
        pass: password,
      },
    })
  }

  async send(msg: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: '"Tabula" <noreply@tabulasql.de>',
      replyTo: 'kontakt@tabulasql.de',
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
      ...(msg.attachments ? { attachments: msg.attachments } : {}),
    })
  }
}

const SMTP_SECRET_PATH = '/run/secrets/smtp_noreply'

/**
 * Erstellt den passenden MailSender fuer die Laufzeitumgebung:
 * - SmtpMailSender wenn /run/secrets/smtp_noreply vorhanden
 * - NoopMailSender sonst
 *
 * Wird in Tests NICHT aufgerufen; Tests injizieren InMemoryMailSender direkt.
 */
export function createMailSender(): MailSender {
  if (!existsSync(SMTP_SECRET_PATH)) {
    console.warn('[MailSender] Secret nicht gefunden, NOOP-Sender aktiv.')
    return new NoopMailSender()
  }
  try {
    const password = readFileSync(SMTP_SECRET_PATH, 'utf8').replace(/[\r\n]+$/, '')
    return new SmtpMailSender(password)
  } catch (err) {
    console.error('[MailSender] Secret nicht lesbar:', err instanceof Error ? err.message : err)
    return new NoopMailSender()
  }
}
