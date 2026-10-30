/**
 * Zwei Adressen, ein Build (30.10.2026):
 * - www.tabulasql.de: Website (Startseite, Datensätze, Impressum, Datenschutz, Kontakt)
 * - app.tabulasql.de: App (Lernen, Klassen, Anmelden, Beitreten, Profil, Quiz) und die Konten-API
 *
 * Beim Aufruf einer App-Adresse auf www zieht das Inline-Skript in src/app.html den Fortschritt
 * ohne Konto per URL-Fragment (geht nie an einen Server) nach app.* um und leitet weiter.
 * Website-Adressen auf app.* leitet Caddy per 301 nach www um.
 * Hier: Klicks innerhalb der Seite (SvelteKit-Navigation) über die Adressgrenze hinweg.
 * Nur auf den echten Adressen aktiv, lokal und in Tests (localhost) passiert nichts.
 * Die Liste der App-Pfade steht auch in src/app.html und deploy/Caddyfile.
 */
export const WWW_ORIGIN = 'https://www.tabulasql.de';
export const APP_ORIGIN = 'https://app.tabulasql.de';
const WWW_HOST = 'www.tabulasql.de';
const APP_HOST = 'app.tabulasql.de';

const APP_PATH = /^\/(learn|teach|login|beitreten|profil|quiz|passwort-zuruecksetzen|email-bestaetigen)(\/|$)/;

export function onAppHost(): boolean {
	return typeof location !== 'undefined' && location.hostname === APP_HOST;
}

export function onWwwHost(): boolean {
	return typeof location !== 'undefined' && location.hostname === WWW_HOST;
}

/**
 * Volle Adresse, falls ein Ziel auf die andere Adresse gehört, sonst null.
 * Auf www wird die www-Adresse selbst neu geladen, damit app.html den Fortschritt mitnimmt.
 * Auf app.* ist "/" die App-Startseite, "/#abschnitt" gehört zur Website.
 */
export function crossHostUrl(url: URL): string | null {
	if (url.origin !== location.origin) return null;
	const rest = url.pathname + url.search + url.hash;
	if (onWwwHost() && APP_PATH.test(url.pathname)) return url.href;
	if (onAppHost() && !APP_PATH.test(url.pathname) && !(url.pathname === '/' && !url.hash)) return WWW_ORIGIN + rest;
	return null;
}
