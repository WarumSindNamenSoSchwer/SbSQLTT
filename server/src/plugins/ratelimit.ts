/**
 * Rate-Limiting fuer Login, Register und Passwort-Vergessen (K10).
 *
 * Rein im Arbeitsspeicher - keine IP-Adressen werden gespeichert.
 * Begrenzung pro Benutzername / E-Mail-Adresse.
 *
 * Strategie: Sliding-Window.
 * - Login/Register: max. 5 Versuche pro Konto in 15 Minuten
 * - Forgot: max. 3 Versuche pro E-Mail in 60 Minuten
 */

interface RateBucket {
  count: number
  resetAt: number
}

export class RateLimiter {
  private readonly buckets = new Map<string, RateBucket>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  /**
   * Prueft und zaehlt einen Versuch.
   * Gibt true zurueck wenn erlaubt, false wenn das Limit ueberschritten wurde.
   */
  check(key: string, now: number = Date.now()): boolean {
    this.cleanup(now)
    const bucket = this.buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs })
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

// Globale Instanzen (werden in app.ts erstellt und per Dependency Injection uebergeben)
export function createRateLimiters() {
  return {
    /** Login: max. 10 Versuche pro Konto in 15 Minuten */
    login: new RateLimiter(10, 15 * 60 * 1000),
    /** Register: max. 5 Versuche pro IP-aehnlichem Schluessel in 15 Minuten */
    register: new RateLimiter(5, 15 * 60 * 1000),
    /** Passwort vergessen: max. 3 Versuche pro E-Mail in 60 Minuten */
    forgot: new RateLimiter(3, 60 * 60 * 1000),
  }
}

export type RateLimiters = ReturnType<typeof createRateLimiters>
