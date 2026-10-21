/**
 * CSRF-Schutz: Origin-Header-Pruefung fuer alle schreibenden Anfragen (POST, PATCH, DELETE, PUT).
 *
 * Erlaubter Origin ist per ENV konfigurierbar (ALLOWED_ORIGIN).
 * Standard: https://www.tabulasql.de
 *
 * K10: Keine IP-Adressen werden gespeichert.
 *
 * Diese Funktion erzeugt einen Fastify-Hook, der in app.ts registriert wird.
 */

export const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT'])

/**
 * Prueft ob der Origin-Header fuer schreibende Anfragen korrekt ist.
 * Gibt true zurueck wenn erlaubt, false wenn abgelehnt.
 */
export function checkCsrfOrigin(method: string, origin: string | undefined, allowedOrigin: string): boolean {
  if (!WRITE_METHODS.has(method)) return true
  return origin === allowedOrigin
}
