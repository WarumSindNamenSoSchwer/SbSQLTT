/**
 * Tests fuer mail.ts: SmtpMailSender und createMailSender.
 *
 * Verwendet jsonTransport von nodemailer (kein echter SMTP-Versand).
 */
import { describe, it, expect, vi } from 'vitest'
import nodemailer from 'nodemailer'
import { InMemoryMailSender, NoopMailSender, SmtpMailSender, createMailSender } from '../src/mail.js'

describe('InMemoryMailSender', () => {
  it('speichert gesendete Nachrichten', async () => {
    const sender = new InMemoryMailSender()
    await sender.send({ to: 'test@example.de', subject: 'Betreff', text: 'Inhalt' })
    expect(sender.sent).toHaveLength(1)
    expect(sender.last?.to).toBe('test@example.de')
  })

  it('clear() leert die Liste', async () => {
    const sender = new InMemoryMailSender()
    await sender.send({ to: 'a@b.de', subject: 'X', text: 'Y' })
    sender.clear()
    expect(sender.sent).toHaveLength(0)
    expect(sender.last).toBeUndefined()
  })
})

describe('NoopMailSender', () => {
  it('sendet keine Exception', async () => {
    const sender = new NoopMailSender()
    await expect(sender.send({ to: 'test@example.de', subject: 'Betreff', text: 'Text' })).resolves.toBeUndefined()
  })
})

describe('SmtpMailSender', () => {
  it('sendet Mail ueber nodemailer-Transport', async () => {
    // jsonTransport: kein echter SMTP, gibt JSON der Mail zurueck
    const transport = nodemailer.createTransport({ jsonTransport: true })

    // SmtpMailSender intern ueber Spy testen (Transporter ersetzen)
    const sender = new SmtpMailSender('fake-password')
    // Transporter per Reflection ersetzen (privates Feld fuer den Test)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sender as unknown as { transporter: typeof transport }).transporter = transport

    let sent = false
    const origSend = transport.sendMail.bind(transport)
    vi.spyOn(transport, 'sendMail').mockImplementation(async (opts) => {
      sent = true
      const result = await origSend(opts)
      return result
    })

    await sender.send({ to: 'kontakt@tabulasql.de', subject: 'Test', text: 'Testtext' })
    expect(sent).toBe(true)
  })
})

describe('createMailSender', () => {
  it('gibt NoopMailSender zurueck wenn Secret-Datei nicht vorhanden', () => {
    // In der Testumgebung existiert /run/secrets/smtp_noreply nicht.
    // createMailSender() gibt dann einen NoopMailSender zurueck.
    const sender = createMailSender()
    expect(sender).toBeInstanceOf(NoopMailSender)
  })
})
