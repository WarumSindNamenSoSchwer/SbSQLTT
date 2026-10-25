/**
 * Schlüssel im Browser (Klassen-Login, docs/KLASSEN-LOGIN.md).
 *
 * Lehrkraft: Der private Schlüssel wird nach dem Anmelden mit dem Passwort entsperrt und als
 * nicht exportierbarer CryptoKey in IndexedDB gehalten (tabula-teacher-key). Kein Skript kann ihn
 * auslesen, er verlässt den Browser nie und wird beim Abmelden gelöscht.
 *
 * Schüler: Der eigene Name liegt nur im sessionStorage des Tabs (tabula-student), für die
 * Begrüßung und um Name oder Passwort zu ändern. Er wird beim Abmelden gelöscht.
 */
import { openForTeacher, sealForTeacher, importPublicKey } from './crypto.js';

const DB_NAME = 'tabula';
const STORE = 'keys';
const KEY_ID = 'tabula-teacher-key';
const STUDENT_KEY = 'tabula-student';

// ---------------------------------------------------------------------------
// Lehrkraft: privater Schlüssel in IndexedDB
// ---------------------------------------------------------------------------

let cached: CryptoKey | null = null;

function idb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await idb();
	try {
		return await new Promise<T>((resolve, reject) => {
			const r = fn(db.transaction(STORE, mode).objectStore(STORE));
			r.onsuccess = () => resolve(r.result);
			r.onerror = () => reject(r.error);
		});
	} finally {
		db.close();
	}
}

export async function storeTeacherKey(key: CryptoKey): Promise<void> {
	cached = key;
	if (typeof indexedDB === 'undefined') return;
	await tx('readwrite', (s) => s.put(key, KEY_ID));
}

export async function loadTeacherKey(): Promise<CryptoKey | null> {
	if (cached) return cached;
	if (typeof indexedDB === 'undefined') return null;
	try {
		cached = ((await tx('readonly', (s) => s.get(KEY_ID))) as CryptoKey | undefined) ?? null;
	} catch {
		cached = null;
	}
	return cached;
}

export async function clearTeacherKey(): Promise<void> {
	cached = null;
	nameCache.clear();
	if (typeof indexedDB === 'undefined') return;
	try {
		await tx('readwrite', (s) => s.delete(KEY_ID));
	} catch {
		/* ignorieren */
	}
}

/** Entschlüsselt Namen der eigenen Schüler. Ohne Schlüssel oder ohne enc_name: Platzhalter. */
const nameCache = new Map<string, string>();
export async function decryptName(enc: string | null | undefined, fallbackNo: number): Promise<string> {
	const fallback = `Schüler ${fallbackNo}`;
	if (!enc) return fallback;
	const hit = nameCache.get(enc);
	if (hit) return hit;
	const key = await loadTeacherKey();
	if (!key) return fallback;
	const name = await openForTeacher(key, enc);
	if (name) nameCache.set(enc, name);
	return name ?? fallback;
}

/** Entschlüsselt die letzte Abfrage ({ q, e }) eines Schülers. */
export async function decryptAttempt(sealed: string | null | undefined): Promise<{ q: string; e: string } | null> {
	if (!sealed) return null;
	const key = await loadTeacherKey();
	if (!key) return null;
	const text = await openForTeacher(key, sealed);
	if (!text) return null;
	try {
		const v = JSON.parse(text) as { q?: unknown; e?: unknown };
		return { q: String(v.q ?? ''), e: String(v.e ?? '') };
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Schüler: eigener Name nur im Tab, öffentlicher Schlüssel der Lehrkraft
// ---------------------------------------------------------------------------

export function rememberStudentName(name: string): void {
	try {
		sessionStorage.setItem(STUDENT_KEY, JSON.stringify({ name }));
	} catch {
		/* privater Modus o. Ä. */
	}
}

export function studentName(): string | null {
	try {
		const raw = sessionStorage.getItem(STUDENT_KEY);
		return raw ? ((JSON.parse(raw) as { name?: string }).name ?? null) : null;
	} catch {
		return null;
	}
}

export function forgetStudentName(): void {
	try {
		sessionStorage.removeItem(STUDENT_KEY);
	} catch {
		/* ignorieren */
	}
}

/** Öffentlicher Schlüssel der Lehrkraft des angemeldeten Schülers (aus /api/me). */
let teacherPublicKey: { spki: string; key: CryptoKey } | null = null;
export async function setTeacherPublicKey(spki: string | null | undefined): Promise<void> {
	if (!spki) {
		teacherPublicKey = null;
		return;
	}
	if (teacherPublicKey?.spki === spki) return;
	teacherPublicKey = { spki, key: await importPublicKey(spki) };
}

/** Verschlüsselt die letzte Abfrage für die Lehrkraft. Ohne Schlüssel: leer (Server sieht nur das Fehler-Kennzeichen). */
export async function sealAttempt(query: string, error: string): Promise<string> {
	if (!teacherPublicKey) return '';
	return sealForTeacher(teacherPublicKey.key, JSON.stringify({ q: query.slice(0, 5000), e: error.slice(0, 1000) }));
}
