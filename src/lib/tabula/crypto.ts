/**
 * Kryptografie für den Klassen-Login (läuft im Browser, siehe docs/KLASSEN-LOGIN.md).
 *
 * Grundsatz: Name und Passwort eines Schülers verlassen nie das Gerät. Der Server bekommt nur
 * einen abgeleiteten Schlüssel (und speichert davon nur SHA-256) sowie Daten, die mit dem
 * öffentlichen Schlüssel der Lehrkraft verschlüsselt sind.
 *
 * Bausteine (alles Web Crypto bzw. hash-wasm, keine eigenen Algorithmen):
 * - Argon2id (hash-wasm) für Schlüsselableitung aus Passwörtern.
 * - RSA-OAEP 3072 / SHA-256 als Schlüsselpaar der Lehrkraft.
 * - Hybrid: AES-GCM-256 für die Nutzdaten, der AES-Schlüssel per RSA-OAEP verpackt.
 * - AES-GCM zum Verpacken des privaten Lehrkraft-Schlüssels mit Passwort bzw. Wiederherstellungscode.
 *
 * Wird auch von den Server-Tests (Node 22+, globales crypto.subtle) importiert.
 */
import { argon2id } from 'hash-wasm';

/** Argon2id-Parameter für den Schüler-Login. 64 MiB, 3 Durchgänge: im Browser etwa 0,2 bis 1 s. */
export const STUDENT_KDF = { memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 32 } as const;
/** Argon2id-Parameter für das Verpacken des Lehrkraft-Schlüssels. */
export const WRAP_KDF = { memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 32 } as const;

/**
 * Nur für Server-Tests: billigere Argon2-Parameter, damit viele Tests schnell laufen.
 * Der Browser ruft das nie auf. Ein eigener Test prüft die echten Parameter.
 */
let kdfScale = 1;
export function __setTestKdfScale(scale: number): void {
	kdfScale = scale;
}
function kdf<T extends { memorySize: number }>(p: T): T {
	return kdfScale === 1 ? p : { ...p, memorySize: Math.max(1024, Math.floor(p.memorySize / kdfScale)) };
}

const subtle = globalThis.crypto.subtle;
/** Bytes mit echtem ArrayBuffer (Web Crypto verlangt BufferSource) */
type Bytes = Uint8Array<ArrayBuffer>;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------------------------------------------------------------------------
// Base64 (ohne Abhängigkeiten, Browser und Node)
// ---------------------------------------------------------------------------

export function toB64(bytes: Uint8Array): string {
	let s = '';
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
	return btoa(s);
}

export function fromB64(b64: string): Bytes {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomBytes(n: number): Bytes {
	const b = new Uint8Array(n);
	globalThis.crypto.getRandomValues(b);
	return b;
}

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

/** Name: Unicode-NFC, Leerzeichen zusammengefasst, Groß-/Kleinschreibung egal. */
export function normalizeName(name: string): string {
	return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

/** Klassencode: Kleinbuchstaben, Leerzeichen und Unterstriche werden zu Bindestrichen. */
export function normalizeClassCode(code: string): string {
	return code.normalize('NFC').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

/** Anzeigeform eines Namens (Leerzeichen bereinigt, Schreibweise bleibt). */
export function cleanName(name: string): string {
	return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Schüler-Login
// ---------------------------------------------------------------------------

/**
 * Leitet den Login-Schlüssel eines Schülers ab.
 * Salz = SHA-256("tabula-student-v1" | Klassen-Salz | normalisierter Name).
 * Das Klassen-Salz ist ein Zufallswert der Klasse (vom Server), damit der Klassencode änderbar bleibt.
 * Ergebnis: 32 Byte als Hex. Der Server speichert davon nur SHA-256.
 */
export async function deriveStudentKey(classSaltB64: string, name: string, password: string): Promise<string> {
	const material = enc.encode(`tabula-student-v1|${classSaltB64}|${normalizeName(name)}`);
	const salt = new Uint8Array(await subtle.digest('SHA-256', material));
	return argon2id({ password: password.normalize('NFC'), salt, ...kdf(STUDENT_KDF), outputType: 'hex' });
}

// ---------------------------------------------------------------------------
// Schlüsselpaar der Lehrkraft
// ---------------------------------------------------------------------------

const RSA = { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as const;

export interface TeacherKeyBundle {
	/** Öffentlicher Schlüssel (SPKI, Base64), liegt offen beim Server. */
	public_key: string;
	/** Privater Schlüssel, verpackt mit dem Passwort der Lehrkraft. */
	wrapped_by_password: string;
	/** Privater Schlüssel, verpackt mit dem Wiederherstellungscode. */
	wrapped_by_recovery: string;
}

/** Wörter für Wiederherstellungscodes und Klassencodes (eindeutig, ohne Umlaute, leicht zu tippen). */
export const WORDS = [
	'adler', 'ampel', 'anker', 'apfel', 'baum', 'berg', 'birne', 'blatt', 'blau', 'blitz', 'boot', 'brot',
	'brunnen', 'burg', 'dach', 'delfin', 'drache', 'eiche', 'eimer', 'eis', 'elch', 'ente', 'erde', 'eule',
	'falke', 'farn', 'feder', 'feld', 'fels', 'fisch', 'flamme', 'floh', 'fluss', 'fuchs', 'gabel', 'garten',
	'geige', 'gold', 'gras', 'grau', 'gruen', 'hafen', 'hai', 'hammer', 'hase', 'heft', 'himmel', 'hirsch',
	'honig', 'horn', 'hund', 'igel', 'insel', 'jacke', 'kaktus', 'kamel', 'kanu', 'karte', 'katze', 'kerze',
	'kiesel', 'kiwi', 'klee', 'knopf', 'koala', 'kompass', 'krone', 'kugel', 'lampe', 'leiter', 'lila',
	'linde', 'loewe', 'luchs', 'mais', 'mantel', 'marder', 'meer', 'melone', 'milch', 'mond', 'moos', 'mosaik',
	'nebel', 'nest', 'nuss', 'oase', 'otter', 'palme', 'panda', 'papier', 'pinsel', 'pilz', 'pirat', 'planet',
	'quelle', 'rabe', 'radio', 'regen', 'reh', 'riese', 'rose', 'rot', 'sand', 'schaf', 'schal', 'schiff',
	'schnee', 'see', 'segel', 'sonne', 'spatz', 'stern', 'stift', 'storch', 'strand', 'tal', 'tanne', 'tiger',
	'tinte', 'turm', 'ufer', 'uhr', 'vogel', 'wal', 'wald', 'wasser', 'welle', 'wiese', 'wind', 'wolf',
	'wolke', 'wurzel', 'zebra', 'zelt', 'ziege', 'zimt', 'zitrone', 'zug'
] as const;

function pickWord(): string {
	// Zufall ohne Modulo-Verzerrung
	const limit = Math.floor(0x100000000 / WORDS.length) * WORDS.length;
	for (;;) {
		const v = new Uint32Array(1);
		globalThis.crypto.getRandomValues(v);
		if (v[0] < limit) return WORDS[v[0] % WORDS.length];
	}
}

/** Wiederherstellungscode: 8 zufällige Wörter (etwa 57 Bit). Wird nie an den Server geschickt. */
export function generateRecoveryCode(): string {
	return Array.from({ length: 8 }, pickWord).join('-');
}

export function normalizeRecoveryCode(code: string): string {
	return normalizeClassCode(code);
}

async function kek(secret: string, salt: Uint8Array): Promise<CryptoKey> {
	const raw = await argon2id({ password: secret.normalize('NFC'), salt, ...kdf(WRAP_KDF), outputType: 'binary' });
	return subtle.importKey('raw', new Uint8Array(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Verpackt Daten mit einem Geheimnis (Passwort oder Code): Format v1.salt.iv.ciphertext (Base64). */
export async function wrapWithSecret(secret: string, data: Bytes): Promise<string> {
	const salt = randomBytes(16);
	const iv = randomBytes(12);
	const key = await kek(secret, salt);
	const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
	return ['v1', toB64(salt), toB64(iv), toB64(ct)].join('.');
}

/** Entpackt mit dem Geheimnis. Wirft bei falschem Geheimnis. */
export async function unwrapWithSecret(secret: string, wrapped: string): Promise<Bytes> {
	const [v, salt, iv, ct] = wrapped.split('.');
	if (v !== 'v1' || !salt || !iv || !ct) throw new Error('Unbekanntes Format');
	const key = await kek(secret, fromB64(salt));
	return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct)));
}

/**
 * Erzeugt das Schlüsselpaar der Lehrkraft im Browser.
 * Gibt das Bündel für den Server und den privaten Schlüssel (nicht exportierbar) zurück.
 */
export async function createTeacherKeys(password: string, recoveryCode: string): Promise<{ bundle: TeacherKeyBundle; privateKey: CryptoKey }> {
	const pair = (await subtle.generateKey(RSA, true, ['encrypt', 'decrypt'])) as CryptoKeyPair;
	const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
	const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
	const bundle: TeacherKeyBundle = {
		public_key: toB64(spki),
		wrapped_by_password: await wrapWithSecret(password, pkcs8),
		wrapped_by_recovery: await wrapWithSecret(normalizeRecoveryCode(recoveryCode), pkcs8)
	};
	pkcs8.fill(0);
	const privateKey = await importPrivateKey(await unwrapWithSecret(password, bundle.wrapped_by_password));
	return { bundle, privateKey };
}

/** Importiert den privaten Schlüssel als nicht exportierbaren CryptoKey und überschreibt die Rohdaten. */
export async function importPrivateKey(pkcs8: Bytes): Promise<CryptoKey> {
	try {
		return await subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
	} finally {
		pkcs8.fill(0);
	}
}

export async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
	return subtle.importKey('spki', fromB64(spkiB64), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
}

/** Entsperrt den privaten Schlüssel mit Passwort oder Wiederherstellungscode. */
export async function unlockTeacherKey(secret: string, wrapped: string): Promise<CryptoKey> {
	return importPrivateKey(await unwrapWithSecret(secret, wrapped));
}

// ---------------------------------------------------------------------------
// Hybride Verschlüsselung für die Lehrkraft (Name, letzte Abfrage)
// ---------------------------------------------------------------------------

/** Verschlüsselt Text für die Lehrkraft. Format h1.encKey.iv.ciphertext (Base64). */
export async function sealForTeacher(publicKey: CryptoKey, text: string): Promise<string> {
	const aes = randomBytes(32);
	const iv = randomBytes(12);
	const aesKey = await subtle.importKey('raw', aes, 'AES-GCM', false, ['encrypt']);
	const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(text)));
	const ek = new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, aes));
	aes.fill(0);
	return ['h1', toB64(ek), toB64(iv), toB64(ct)].join('.');
}

/** Entschlüsselt mit dem privaten Schlüssel der Lehrkraft. Gibt null zurück, wenn es nicht klappt. */
export async function openForTeacher(privateKey: CryptoKey, sealed: string): Promise<string | null> {
	try {
		const [v, ek, iv, ct] = sealed.split('.');
		if (v !== 'h1' || !ek || !iv || !ct) return null;
		const aes = new Uint8Array(await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, fromB64(ek)));
		const aesKey = await subtle.importKey('raw', aes, 'AES-GCM', false, ['decrypt']);
		aes.fill(0);
		return dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, aesKey, fromB64(ct)));
	} catch {
		return null;
	}
}

/** Fingerabdruck eines öffentlichen Schlüssels (kurz, zum Abgleich in Tests und Anzeige). */
export async function keyFingerprint(spkiB64: string): Promise<string> {
	return toHex(new Uint8Array(await subtle.digest('SHA-256', fromB64(spkiB64)))).slice(0, 16);
}
