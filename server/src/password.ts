/**
 * Passwort-Hashing nach K3 (BACKEND-DATENSCHUTZ.md).
 *
 * Paketentscheidung: npm "argon2" (node-argon2 v0.45+).
 *
 * Technischer Hinweis zu associatedData vs. secret:
 * Die Spec verlangt Argon2-"associated data" mit dem Wert
 * "tabula:v1:" + benutzername + ":" + erstellungstag.
 * Das npm-Paket "argon2" speichert den AD-Wert zwar im PHC-String (data=...),
 * prueft ihn bei argon2.verify() aber NICHT - es liest den gespeicherten Wert
 * und verwendet ihn stillschweigend wieder. Damit wird das Sicherheitsziel
 * (Hash-Bindung an das Konto) nicht erreicht.
 * Stattdessen verwenden wir den Argon2-Parameter "secret", der bei verify()
 * erzwungen wird: nur mit dem richtigen secret ergibt verify() true.
 * Der secret-Wert ist identisch mit dem urspruenglich vorgesehenen AD-Wert,
 * daher bleiben alle K3-Garantien erhalten:
 *   - Hash laeuft nur mit demselben Benutzernamen + Erstellungstag
 *   - Umbennennung erfordert Neu-Hash (anderen secret-Wert)
 *   - Zufaelliger Salt bleibt Pflicht
 * Dokumentiert in server/README.md unter "Sicherheitshinweise".
 *
 * Parameter nach K3 / OWASP Password Storage Cheat Sheet:
 * - Argon2id
 * - memoryCost: 19456 KiB (= 19 MiB)
 * - timeCost:   2 Iterationen
 * - parallelism: 1
 * - Salt: 16 Byte zufaellig (intern von argon2.hash erzeugt)
 * - secret: Buffer.from("tabula:v1:" + username_nfc_lower + ":" + created_day)
 */
import argon2 from 'argon2'

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,   // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const

/**
 * Baut den secret-Buffer nach K3.
 * username muss unicode-NFC-normalisiert und kleingeschrieben sein.
 * created_day: YYYY-MM-DD (UTC)
 *
 * Entspricht dem in der Spec beschriebenen "associated data"-Wert,
 * wird aber als "secret" verwendet (siehe Datei-Kommentar oben).
 */
export function buildAssociatedData(username: string, createdDay: string): Buffer {
  return Buffer.from(`tabula:v1:${username}:${createdDay}`, 'utf-8')
}

/**
 * Normalisiert einen Benutzernamen: Unicode-NFC, Kleinschreibung.
 * Wird fuer Login UND Hashing verwendet (K3).
 */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFC').toLowerCase()
}

/**
 * Gibt den aktuellen UTC-Tag als 'YYYY-MM-DD' zurueck.
 */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Hasht ein Passwort mit den K3-Parametern.
 * Gibt einen PHC-formatierten String zurueck (enthaelt Salt, Parameter, Hash).
 */
export async function hashPassword(
  password: string,
  username: string,
  createdDay: string
): Promise<string> {
  const secret = buildAssociatedData(normalizeUsername(username), createdDay)
  return argon2.hash(password, {
    ...ARGON2_OPTIONS,
    secret,
  })
}

/**
 * Prueft ein Passwort gegen einen gespeicherten PHC-Hash.
 * Gibt true zurueck wenn korrekt, false sonst.
 * Wirft NIE - Fehler werden als false behandelt.
 *
 * Der secret-Wert (identisch mit dem spezifizierten "associated data") wird
 * bei der Verifikation erzwungen - nur mit demselben username + created_day
 * ergibt argon2.verify() true.
 */
export async function verifyPassword(
  hash: string,
  password: string,
  username: string,
  createdDay: string
): Promise<boolean> {
  try {
    const secret = buildAssociatedData(normalizeUsername(username), createdDay)
    return await argon2.verify(hash, password, { secret })
  } catch {
    return false
  }
}
