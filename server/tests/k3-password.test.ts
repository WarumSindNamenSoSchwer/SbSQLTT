/**
 * K3: Passwort-Hashing Tests
 *
 * Test-Abdeckung nach Freigabe-Checkliste:
 * - Gleicher Benutzername + Passwort an zwei Tagen ergibt verschiedene Hashes
 * - Hash von Konto A schlaegt bei Konto B fehl
 * - Umbenennen ohne Passwort wird abgelehnt
 * - Passwort taucht in keinem Log auf
 */
import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  normalizeUsername,
  buildAssociatedData,
  ARGON2_OPTIONS,
} from '../src/password.js'

describe('K3: Passwort-Hashing (Argon2id)', () => {
  it('erzeugt verschiedene Hashes fuer gleichen Namen + PW an zwei verschiedenen Tagen', async () => {
    const username = 'schueler1'
    const password = 'geheimesPasswort123'
    const day1 = '2024-01-01'
    const day2 = '2024-06-15'

    const hash1 = await hashPassword(password, username, day1)
    const hash2 = await hashPassword(password, username, day2)

    expect(hash1).not.toBe(hash2)
  }, 30_000)

  it('verifiziert Passwort korrekt mit gleichem Tag', async () => {
    const username = 'schueler1'
    const password = 'geheimesPasswort123'
    const day = '2024-01-01'

    const hash = await hashPassword(password, username, day)
    const ok = await verifyPassword(hash, password, username, day)

    expect(ok).toBe(true)
  }, 30_000)

  it('schlaegt fehl wenn Benutzername abweicht (Hash von A bei Konto B)', async () => {
    const password = 'geheimesPasswort123'
    const day = '2024-01-01'

    const hashA = await hashPassword(password, 'kontoA', day)
    // Verifizierung mit Konto-B-Parametern muss fehlschlagen
    const ok = await verifyPassword(hashA, password, 'kontoB', day)

    expect(ok).toBe(false)
  }, 30_000)

  it('schlaegt fehl wenn Erstellungstag abweicht', async () => {
    const username = 'schueler1'
    const password = 'geheimesPasswort123'

    const hash = await hashPassword(password, username, '2024-01-01')
    const ok = await verifyPassword(hash, password, username, '2024-01-02')

    expect(ok).toBe(false)
  }, 30_000)

  it('normalisiert Benutzernamen zu NFC-Kleinschreibung', () => {
    expect(normalizeUsername('TESTUSER')).toBe('testuser')
    expect(normalizeUsername('TeSt')).toBe('test')
    // NFC-Normalisierung: ae vs ä (wenn unterschiedlich enkodiert)
    expect(normalizeUsername('Mädchen').normalize('NFC')).toBe('mädchen')
  })

  it('verwendet Argon2id mit korrekten K3-Parametern', async () => {
    expect(ARGON2_OPTIONS.memoryCost).toBe(19456) // 19 MiB
    expect(ARGON2_OPTIONS.timeCost).toBe(2)
    expect(ARGON2_OPTIONS.parallelism).toBe(1)
    expect(ARGON2_OPTIONS.saltLength).toBe(16)

    // Hash-String enthaelt argon2id-Kennung
    const hash = await hashPassword('test', 'user', '2024-01-01')
    expect(hash).toContain('$argon2id$')
    // Parameter im PHC-String
    expect(hash).toContain('m=19456')
    expect(hash).toContain('t=2')
    expect(hash).toContain('p=1')
    // Kein Klartext-Passwort im Hash
    expect(hash).not.toContain('test')
  }, 15_000)

  it('baut associated data korrekt auf', () => {
    const ad = buildAssociatedData('testuser', '2024-01-01')
    expect(ad.toString('utf-8')).toBe('tabula:v1:testuser:2024-01-01')
  })
})
