/**
 * Adresse der Seite für QR-Codes und angezeigte Links.
 * Im Browser die aktuelle Adresse (damit eine Testumgebung eigene QR-Codes erzeugt),
 * sonst die Hauptadresse.
 */
export function siteOrigin(): string {
	if (typeof location !== 'undefined' && location.origin.startsWith('http')) return location.origin;
	return 'https://www.tabulasql.de';
}

/** Anzeigeform ohne https:// (z. B. "www.tabulasql.de") */
export function siteHost(): string {
	return siteOrigin().replace(/^https?:\/\//, '');
}
