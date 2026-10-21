/**
 * Rate-Limiter fuer den Kontaktformular-Dienst.
 * Max. 3 Anfragen pro 10 Minuten je IP-Hash.
 * Keine IP-Adresse wird gespeichert; nur ein SHA-256-Hash.
 * Eintraege werden nach Ablauf des Fensters verworfen.
 */
import { createHash } from 'node:crypto'

interface Bucket {
  count: number
  resetAt: number
}

export class ContactRateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly max: number = 3,
    private readonly windowMs: number = 10 * 60 * 1000
  ) {}

  /** Hasht eine IP-Adresse. Ergebnis wird nicht geloggt. */
  static hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex')
  }

  /**
   * Prueft und zaehlt einen Versuch fuer eine (bereits gehashte) IP.
   * Gibt true zurueck wenn erlaubt, false wenn Limit ueberschritten.
   */
  check(hashedIp: string, now: number = Date.now()): boolean {
    this.cleanup(now)
    const bucket = this.buckets.get(hashedIp)

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(hashedIp, { count: 1, resetAt: now + this.windowMs })
      return true
    }

    if (bucket.count >= this.max) {
      return false
    }

    bucket.count++
    return true
  }

  /** Loescht abgelaufene Eintraege */
  private cleanup(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key)
    }
  }

  /** Nur fuer Tests: setzt alle Zaehler zurueck */
  reset(): void {
    this.buckets.clear()
  }
}
