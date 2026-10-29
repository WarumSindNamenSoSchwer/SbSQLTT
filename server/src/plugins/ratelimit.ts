/**
 * Anmeldeschutz (K10): Zähler nur im Arbeitsspeicher, keine dauerhafte Speicherung von IP-Adressen.
 *
 * Strategie: festes Zeitfenster je Schlüssel.
 * - Schlüssel sind entweder fachlich (E-Mail, Klasse) oder ein Client-Kennzeichen.
 * - Client-Kennzeichen: HMAC-SHA-256 der IP-Adresse mit einem Zufallsschlüssel, der bei jedem
 *   Start neu erzeugt wird und nie den Arbeitsspeicher verlässt. Die IP selbst wird weder
 *   gespeichert noch protokolliert; nach einem Neustart sind alle Kennzeichen wertlos.
 * - Grenzen werden möglichst je Client UND fachlichem Ziel gezählt, damit Fehlversuche von
 *   außen nicht eine ganze Klasse oder eine Lehrkraft aussperren.
 */
import { createHmac, randomBytes } from 'node:crypto'

interface RateBucket {
  count: number
  resetAt: number
}

/** Obergrenze für die Zahl gleichzeitig gemerkter Schlüssel je Limiter (Schutz des Arbeitsspeichers) */
const MAX_KEYS = 50_000

export class RateLimiter {
  private readonly buckets = new Map<string, RateBucket>()
  private lastCleanup = 0

  constructor(
    readonly max: number,
    private readonly windowMs: number
  ) {}

  /**
   * Prüft und zählt einen Versuch.
   * Gibt true zurück wenn erlaubt, false wenn das Limit überschritten wurde.
   */
  check(key: string, now: number = Date.now()): boolean {
    this.cleanup(now)
    const bucket = this.buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
      if (this.buckets.size >= MAX_KEYS) this.evictOldest()
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }

    if (bucket.count >= this.max) {
      return false
    }

    bucket.count++
    return true
  }

  /** Zählt einen Versuch, ohne das Ergebnis zu brauchen (für Fehlversuche nach der Prüfung). */
  hit(key: string, now: number = Date.now()): void {
    this.check(key, now)
  }

  /** Ist die Grenze erreicht? Zählt nicht. */
  blocked(key: string, now: number = Date.now()): boolean {
    return this.peek(key, now) >= this.max
  }

  /** Aktueller Zählerstand ohne zu zählen (0 wenn kein aktives Fenster). */
  peek(key: string, now: number = Date.now()): number {
    const bucket = this.buckets.get(key)
    if (!bucket || now >= bucket.resetAt) return 0
    return bucket.count
  }

  /** Setzt einen Schlüssel zurück (z. B. nach erfolgreicher Anmeldung). */
  clear(key: string): void {
    this.buckets.delete(key)
  }

  /** Löscht abgelaufene Einträge, höchstens einmal je Sekunde (sonst kostet jeder Aufruf O(n)). */
  private cleanup(now: number): void {
    if (now - this.lastCleanup < 1000) return
    this.lastCleanup = now
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key)
    }
  }

  /** Map behält die Einfügereihenfolge: der erste Eintrag ist der älteste. */
  private evictOldest(): void {
    const first = this.buckets.keys().next()
    if (!first.done) this.buckets.delete(first.value)
  }

  /** Nur für Tests: setzt alle Zähler zurück */
  reset(): void {
    this.buckets.clear()
  }
}

// ---------------------------------------------------------------------------
// Client-Kennzeichen (nur im Arbeitsspeicher, siehe oben)
// ---------------------------------------------------------------------------

const CLIENT_KEY_SECRET = randomBytes(32)

/**
 * Kennzeichen des anfragenden Clients für Zähler. Caddy setzt X-Real-IP auf die echte Adresse
 * (deploy/Caddyfile). Die API ist nur über Caddy erreichbar (kein veröffentlichter Port),
 * deshalb darf sie diesem Header vertrauen. Ohne Header (Tests, lokale Entwicklung) zählt die
 * Socket-Adresse.
 */
export function clientKey(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const h = req.headers['x-real-ip']
  const ip = (Array.isArray(h) ? h[0] : h)?.trim() || req.socket?.remoteAddress || 'unknown'
  return createHmac('sha256', CLIENT_KEY_SECRET).update(ip).digest('base64url').slice(0, 22)
}

// ---------------------------------------------------------------------------
// Gemeinsame Instanzen (in app.ts erstellt und per Dependency Injection übergeben)
// ---------------------------------------------------------------------------

const MIN = 60 * 1000

export function createRateLimiters() {
  return {
    /** Lehrkraft-Login: Fehlversuche je E-Mail und Client (10 in 15 min) */
    loginClient: new RateLimiter(10, 15 * MIN),
    /** Lehrkraft-Login: Fehlversuche je E-Mail insgesamt (100 in 15 min), bremst verteiltes Raten */
    loginAccount: new RateLimiter(100, 15 * MIN),
    /** Login-Versuche je Client über alle Adressen (60 in 15 min), bremst das Durchprobieren vieler Konten */
    loginAny: new RateLimiter(60, 15 * MIN),
    /** Registrierung je E-Mail (5 in 15 min) */
    register: new RateLimiter(5, 15 * MIN),
    /** Registrierung je Client (10 je Stunde), bremst Massenkonten und Mails an fremde Adressen */
    registerClient: new RateLimiter(10, 60 * MIN),
    /** Passwort vergessen: je E-Mail (3 je Stunde) */
    forgot: new RateLimiter(3, 60 * MIN),
    /** Passwort vergessen: je Client (10 je Stunde) */
    forgotClient: new RateLimiter(10, 60 * MIN),
  }
}

export type RateLimiters = ReturnType<typeof createRateLimiters>
