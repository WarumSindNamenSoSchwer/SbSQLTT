/**
 * Feature-Schalter.
 *
 * ACCOUNTS_LIVE steuert, ob die Konto-Funktionen aktiv sind.
 * Solange false: Login/Registrieren zeigt den Hinweis „Konten kommen in Kürze"
 * und ruft keine API auf.
 *
 * Für lokale Tests: VITE_ACCOUNTS_LIVE=1 setzen.
 */
export const ACCOUNTS_LIVE: boolean =
  import.meta.env.VITE_ACCOUNTS_LIVE === '1' || import.meta.env.VITE_ACCOUNTS_LIVE === 'true';
