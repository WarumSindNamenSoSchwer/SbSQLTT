/**
 * E-Mail-Versand: Interface und Test-Implementierung.
 *
 * Die echte SMTP-Implementierung folgt spaeter (SMTP via Hetzner,
 * Absender noreply@tabulasql.de, Passwort aus /run/secrets/smtp_noreply).
 */

export interface MailMessage {
  to: string
  subject: string
  /** Reiner Text (kein HTML) */
  text: string
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
 * Platzhalter-Implementierung fuer Produktion: loggt nur.
 * Wird durch echte SMTP-Implementierung ersetzt.
 */
export class NoopMailSender implements MailSender {
  async send(msg: MailMessage): Promise<void> {
    // TODO: SMTP-Implementierung (Hetzner, noreply@tabulasql.de)
    // Passwort aus /run/secrets/smtp_noreply
    console.warn(`[MailSender] NOOP - Kein SMTP konfiguriert. An: ${msg.to}, Betreff: ${msg.subject}`)
  }
}
