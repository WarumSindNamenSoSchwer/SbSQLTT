/**
 * Gestaltete Systemmails (HTML + Textfassung) im Tabula-Look mit Edgar.
 *
 * - Edgar hängt als animiertes GIF direkt in der Mail (cid), nichts wird von außen nachgeladen,
 *   kein Tracking-Pixel, keine Klickverfolgung.
 * - Nur Tabellen-Layout und Inline-Styles, damit Gmail, Outlook, Apple Mail und Proton es gleich zeigen.
 * - Jede Mail hat zusätzlich eine reine Textfassung mit denselben Inhalten.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MailAttachment, MailMessage } from './mail.js'

export type EdgarPose = 'wave' | 'hint' | 'sad'

const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'mail')
const gifCache = new Map<EdgarPose, Buffer>()
function edgarGif(pose: EdgarPose): Buffer {
  let b = gifCache.get(pose)
  if (!b) {
    b = readFileSync(join(ASSET_DIR, `edgar-${pose}.gif`))
    gifCache.set(pose, b)
  }
  return b
}

const C = {
  bg: '#f1f5f9',
  card: '#ffffff',
  line: '#e2e8f0',
  ink: '#0f172a',
  ink2: '#475569',
  ink3: '#64748b',
  accent: '#2563eb',
  soft: '#eff6ff',
}
const FONT = "'IBM Plex Sans','Segoe UI',Helvetica,Arial,sans-serif"

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface SystemMail {
  to: string
  subject: string
  /** Kurzer Vorschautext, den Mailprogramme neben dem Betreff zeigen */
  preheader: string
  pose: EdgarPose
  greeting: string
  /** Absätze vor dem Button */
  intro: string[]
  button: { label: string; url: string }
  /** Absätze nach dem Button (klein) */
  notes: string[]
  /** Optionaler Hinweiskasten */
  callout?: string
  siteUrl: string
}

export function buildSystemMail(m: SystemMail): MailMessage {
  const p = (t: string, size = 16, color = C.ink, extra = '') =>
    `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:${size}px;line-height:${Math.round(size * 1.6)}px;color:${color};${extra}">${esc(t)}</p>`

  const html = `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(m.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${esc(m.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
    <tr><td style="padding:0 4px 16px 4px;font-family:${FONT};font-size:20px;line-height:28px;font-weight:600;color:${C.ink};">Tabula<span style="color:${C.accent};">.</span></td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td align="center" style="padding:28px 32px 4px 32px;">
          <img src="cid:edgar" width="160" height="144" alt="Edgar, die Tabula-Eule" style="display:block;width:160px;height:144px;border:0;outline:none;text-decoration:none;">
        </td></tr>
        <tr><td style="padding:16px 32px 8px 32px;">
          ${p(m.greeting, 18, C.ink, 'font-weight:600;')}
          ${m.intro.map((t) => p(t)).join('\n          ')}
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 24px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" bgcolor="${C.accent}" style="border-radius:8px;">
              <a href="${esc(m.button.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(m.button.label)}</a>
            </td>
          </tr></table>
        </td></tr>
        ${m.callout ? `<tr><td style="padding:0 32px 20px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="background:${C.soft};border-radius:8px;padding:14px 16px;font-family:${FONT};font-size:14px;line-height:22px;color:${C.ink};">${esc(m.callout)}</td>
          </tr></table>
        </td></tr>` : ''}
        <tr><td style="padding:0 32px 24px 32px;">
          ${m.notes.map((t) => p(t, 14, C.ink2)).join('\n          ')}
          <p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.ink3};">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br><a href="${esc(m.button.url)}" style="color:${C.accent};word-break:break-all;">${esc(m.button.url)}</a></p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 16px 0 16px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.ink3};">
      Tabula, der kostenlose SQL-Trainer für die Schule<br>
      <a href="${m.siteUrl}" style="color:${C.ink3};">tabulasql.de</a> · <a href="${m.siteUrl}/impressum" style="color:${C.ink3};">Impressum</a> · <a href="${m.siteUrl}/datenschutz" style="color:${C.ink3};">Datenschutz</a><br>
      Diese E-Mail wurde automatisch verschickt. Fragen? <a href="mailto:kontakt@tabulasql.de" style="color:${C.ink3};">kontakt@tabulasql.de</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    m.greeting,
    '',
    ...m.intro.flatMap((t) => [t, '']),
    `${m.button.label}:`,
    m.button.url,
    '',
    ...(m.callout ? [m.callout, ''] : []),
    ...m.notes.flatMap((t) => [t, '']),
    '--',
    'Tabula, der kostenlose SQL-Trainer für die Schule',
    `${m.siteUrl} · Impressum: ${m.siteUrl}/impressum · Datenschutz: ${m.siteUrl}/datenschutz`,
    'Diese E-Mail wurde automatisch verschickt. Fragen? kontakt@tabulasql.de',
  ].join('\n')

  const attachments: MailAttachment[] = [
    { filename: 'edgar.gif', content: edgarGif(m.pose), contentType: 'image/gif', cid: 'edgar' },
  ]
  return { to: m.to, subject: m.subject, text, html, attachments }
}
