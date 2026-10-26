import { describe, it, expect } from 'vitest'
import { buildSystemMail } from '../src/mail-templates.js'

const base = {
  to: 'a@schule.de',
  subject: 'Test · Tabula',
  preheader: 'Vorschau',
  pose: 'wave' as const,
  greeting: 'Hallo <b>Frau "X"</b>,',
  intro: ['Erster Absatz & mehr.'],
  button: { label: 'Los', url: 'https://www.tabulasql.de/x?token=abc&y=1' },
  notes: ['Kleiner Hinweis.'],
  siteUrl: 'https://www.tabulasql.de',
}

describe('HTML-Systemmails', () => {
  it('liefert HTML, Textfassung und Edgar als eingebettetes GIF', () => {
    const m = buildSystemMail(base)
    expect(m.html).toContain('cid:edgar')
    expect(m.attachments).toHaveLength(1)
    const a = m.attachments![0]!
    expect(a.cid).toBe('edgar')
    expect(a.contentType).toBe('image/gif')
    expect(a.content.subarray(0, 6).toString('ascii')).toBe('GIF89a')
    // Animiert: mehr als ein Bild (Graphic Control Extension je Bild)
    const frames = a.content.toString('latin1').split('\x21\xF9\x04').length - 1
    expect(frames).toBeGreaterThan(10)
    expect(m.text).toContain('https://www.tabulasql.de/x?token=abc&y=1')
    expect(m.text).toContain('Kleiner Hinweis.')
  })

  it('l\u00e4dt nichts von au\u00dfen nach (kein Tracking)', () => {
    const m = buildSystemMail(base)
    const srcs = [...m.html!.matchAll(/\ssrc="([^"]+)"/g)].map((x) => x[1])
    expect(srcs).toEqual(['cid:edgar'])
    expect(m.html).not.toMatch(/<link|@import|url\(|<script/i)
  })

  it('maskiert Nutzereingaben im HTML', () => {
    const m = buildSystemMail(base)
    expect(m.html).not.toContain('<b>Frau')
    expect(m.html).toContain('Hallo &lt;b&gt;Frau &quot;X&quot;&lt;/b&gt;,')
    expect(m.html).toContain('href="https://www.tabulasql.de/x?token=abc&amp;y=1"')
  })

  it('jede Pose hat ein eigenes GIF', () => {
    const sizes = (['wave', 'hint', 'sad'] as const).map((pose) => buildSystemMail({ ...base, pose }).attachments![0]!.content.length)
    expect(new Set(sizes).size).toBe(3)
  })
})
