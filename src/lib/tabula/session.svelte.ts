/**
 * Session-Store: aktueller angemeldeter Nutzer (Lehrkraft oder Schüler aus dem Klassen-Login).
 *
 * - GET /api/me beim Start (nur wenn ACCOUNTS_LIVE)
 * - Lehrkraft: Anmelden mit E-Mail und Passwort, privater Schlüssel wird im Browser entsperrt
 * - Schüler: Klassen-Login (Klassencode, Name, Passwort), Name und Passwort verlassen den Browser nie
 * - Fortschritt-Sync nach dem Klassen-Login (einmalige Übernahme lokaler Daten, K4)
 */

import { ACCOUNTS_LIVE } from './flags.js';
import {
	apiMe,
	apiLogin,
	apiLogout,
	apiRegister,
	apiGetProgress,
	apiPutProgress,
	apiClassLookup,
	apiClassJoin,
	apiClassLogin,
	apiClassReset,
	apiStudentRekey,
	apiStudentLeave,
	apiChangePassword,
	apiSetKeys,
	ApiError,
	type PublicUser,
	type TeacherUser,
	type StudentUser,
} from './api.js';
import { loadProgress, clearProgress, mergeServerProgress, exerciseIndices } from './lessons.js';
import {
	createTeacherKeys,
	unlockTeacherKey,
	unwrapWithSecret,
	wrapWithSecret,
	importPrivateKey,
	normalizeRecoveryCode,
	generateRecoveryCode,
	deriveStudentKey,
	sealForTeacher,
	importPublicKey,
	cleanName,
} from './crypto.js';
import {
	storeTeacherKey,
	loadTeacherKey,
	clearTeacherKey,
	rememberStudentName,
	studentName,
	forgetStudentName,
	setTeacherPublicKey,
} from './keystore.js';

// ---------------------------------------------------------------------------
// Reaktiver Zustand
// ---------------------------------------------------------------------------

let _user = $state<PublicUser | null>(null);
let _loading = $state(true);
let _error = $state<string | null>(null);
/** Lehrkraft: privater Schlüssel fehlt (nach Passwort-Reset), Namen sind nicht lesbar */
let _needsKeyRecovery = $state(false);
/** Schüler: eigener Name (nur im Tab gespeichert) */
let _studentName = $state<string | null>(null);
/** Wird nach jedem Server-Merge/Leeren des Fortschritts erhöht, damit Seiten neu laden. */
let _progressVersion = $state(0);

export const session = {
	get user(): PublicUser | null { return _user; },
	get teacher(): TeacherUser | null { return _user?.role === 'teacher' ? _user : null; },
	get student(): StudentUser | null { return _user?.role === 'student' ? _user : null; },
	/** Anzeigename: Lehrkraft aus dem Konto, Schüler aus dem Tab-Speicher */
	get displayName(): string {
		if (_user?.role === 'teacher') return _user.display_name;
		if (_user?.role === 'student') return _studentName ?? 'Schüler';
		return '';
	},
	get loading(): boolean { return _loading; },
	get error(): string | null { return _error; },
	get needsKeyRecovery(): boolean { return _needsKeyRecovery; },
	get progressVersion(): number { return _progressVersion; },
};

// ---------------------------------------------------------------------------
// Initialisierung (einmalig beim App-Start)
// ---------------------------------------------------------------------------

let _initialized = false;

export async function initSession(): Promise<void> {
	if (_initialized) return;
	_initialized = true;

	if (!ACCOUNTS_LIVE) {
		_loading = false;
		return;
	}

	try {
		await _refreshUser();
		if (_user?.role === 'student') await _downloadAndMergeProgress();
	} catch {
		_user = null;
	} finally {
		_loading = false;
	}
}

async function _refreshUser(): Promise<void> {
	const { user } = await apiMe();
	_user = user;
	if (user.role === 'teacher') {
		if (user.needs_key_recovery) await clearTeacherKey();
		_needsKeyRecovery = user.needs_key_recovery || !(await loadTeacherKey());
	} else {
		_studentName = studentName();
		await setTeacherPublicKey(user.class?.public_key);
	}
}

/** Nutzer neu vom Server laden (z. B. nachdem der Server per Passwort-Reset angemeldet hat). */
export async function reloadSession(): Promise<void> {
	if (!ACCOUNTS_LIVE) return;
	try {
		await _refreshUser();
	} catch {
		_user = null;
	} finally {
		_loading = false;
	}
}

// ---------------------------------------------------------------------------
// Lehrkraft
// ---------------------------------------------------------------------------

/** Lehrkraft anmelden und privaten Schlüssel im Browser entsperren. */
export async function sessionLogin(email: string, password: string): Promise<void> {
	await apiLogin(email, password);
	const { user } = await apiMe();
	_user = user;
	if (user.role !== 'teacher') return;
	try {
		if (user.needs_key_recovery || !user.keys.wrapped_by_password) throw new Error('kein Schlüssel');
		await storeTeacherKey(await unlockTeacherKey(password, user.keys.wrapped_by_password));
		_needsKeyRecovery = false;
	} catch {
		// Passwort wurde per E-Mail zurückgesetzt: Schlüssel noch mit altem Passwort verpackt
		_needsKeyRecovery = true;
	}
}

/**
 * Lehrkraft registrieren. Das Schlüsselpaar entsteht hier im Browser. Gibt den
 * Wiederherstellungscode zurück, der einmal angezeigt wird und nie an den Server geht.
 */
export async function sessionRegisterTeacher(body: {
	display_name: string;
	name: string;
	email: string;
	password: string;
	school?: string;
}): Promise<string> {
	const recoveryCode = generateRecoveryCode();
	const { bundle, privateKey } = await createTeacherKeys(body.password, recoveryCode);
	await apiRegister({ ...body, terms_accepted: true, keys: bundle });
	await storeTeacherKey(privateKey);
	_needsKeyRecovery = false;
	const { user } = await apiMe();
	_user = user;
	return recoveryCode;
}

/** Lehrkraft ändert ihr Passwort: privater Schlüssel wird im Browser neu verpackt. */
export async function sessionChangeTeacherPassword(current: string, next: string): Promise<void> {
	const t = session.teacher;
	if (!t?.keys.wrapped_by_password) throw new ApiError(400, 'Kein Schlüssel vorhanden.');
	let pkcs8: Uint8Array<ArrayBuffer>;
	try {
		pkcs8 = await unwrapWithSecret(current, t.keys.wrapped_by_password);
	} catch {
		throw new ApiError(403, 'Aktuelles Passwort falsch.');
	}
	const wrapped = await wrapWithSecret(next, pkcs8);
	await storeTeacherKey(await importPrivateKey(pkcs8));
	await apiChangePassword(current, next, wrapped);
	await _refreshUser();
}

/**
 * Nach Passwort-Reset per E-Mail: Schlüssel mit dem Wiederherstellungscode zurückholen
 * und mit dem neuen Passwort verpacken. Namen sind danach sofort wieder lesbar.
 */
export async function sessionRecoverWithCode(recoveryCode: string, newPassword: string): Promise<void> {
	const t = session.teacher;
	if (!t?.keys.wrapped_by_recovery || !t.keys.public_key) throw new ApiError(400, 'Kein Schlüssel vorhanden.');
	let pkcs8: Uint8Array<ArrayBuffer>;
	try {
		pkcs8 = await unwrapWithSecret(normalizeRecoveryCode(recoveryCode), t.keys.wrapped_by_recovery);
	} catch {
		throw new ApiError(403, 'Der Wiederherstellungscode stimmt nicht.');
	}
	const wrapped_by_password = await wrapWithSecret(newPassword, pkcs8);
	await storeTeacherKey(await importPrivateKey(pkcs8));
	await apiSetKeys({ public_key: t.keys.public_key, wrapped_by_password, wrapped_by_recovery: t.keys.wrapped_by_recovery });
	_needsKeyRecovery = false;
	await _refreshUser();
}

/**
 * Nach Passwort-Reset ohne Wiederherstellungscode: neues Schlüsselpaar. Die Namen der Schüler
 * kommen zurück, sobald sie sich das nächste Mal anmelden. Gibt den neuen Code zurück.
 */
export async function sessionStartFreshKeys(newPassword: string): Promise<string> {
	const recoveryCode = generateRecoveryCode();
	const { bundle, privateKey } = await createTeacherKeys(newPassword, recoveryCode);
	await apiSetKeys(bundle);
	await storeTeacherKey(privateKey);
	_needsKeyRecovery = false;
	await _refreshUser();
	return recoveryCode;
}

/** Neuen Wiederherstellungscode erzeugen (alter gilt danach nicht mehr). Braucht das Passwort. */
export async function sessionNewRecoveryCode(password: string): Promise<string> {
	const t = session.teacher;
	if (!t?.keys.wrapped_by_password || !t.keys.public_key) throw new ApiError(400, 'Kein Schlüssel vorhanden.');
	let pkcs8: Uint8Array<ArrayBuffer>;
	try {
		pkcs8 = await unwrapWithSecret(password, t.keys.wrapped_by_password);
	} catch {
		throw new ApiError(403, 'Passwort falsch.');
	}
	const recoveryCode = generateRecoveryCode();
	const wrapped_by_recovery = await wrapWithSecret(normalizeRecoveryCode(recoveryCode), pkcs8);
	pkcs8.fill(0);
	await apiSetKeys({ public_key: t.keys.public_key, wrapped_by_password: t.keys.wrapped_by_password, wrapped_by_recovery }, password);
	await _refreshUser();
	return recoveryCode;
}

// ---------------------------------------------------------------------------
// Schüler: Klassen-Login
// ---------------------------------------------------------------------------

async function _studentMaterial(code: string, name: string, password: string) {
	const info = await apiClassLookup(code);
	const key = await deriveStudentKey(info.class_salt, name, password);
	const enc_name = await sealForTeacher(await importPublicKey(info.public_key), cleanName(name));
	return { info, key, enc_name };
}

async function _afterStudentLogin(name: string): Promise<void> {
	rememberStudentName(cleanName(name));
	await _refreshUser();
	// Einmalige Übernahme lokaler Fortschrittsdaten (K4), dann Server-Stand laden
	await _uploadLocalProgress();
	await _downloadAndMergeProgress();
}

/** Neu beitreten (QR-Code oder Klassencode). */
export async function sessionJoinClass(code: string, name: string, password: string): Promise<void> {
	const m = await _studentMaterial(code, name, password);
	await apiClassJoin(code, m.key, m.enc_name);
	await _afterStudentLogin(name);
}

/** Anmelden an jedem PC. Der Name wird neu für den aktuellen Schlüssel der Lehrkraft verschlüsselt. */
export async function sessionClassLogin(code: string, name: string, password: string): Promise<void> {
	const m = await _studentMaterial(code, name, password);
	await apiClassLogin(code, m.key, m.enc_name);
	await _afterStudentLogin(name);
}

/** Passwort vergessen: mit Einmal-Code der Lehrkraft ein neues Passwort festlegen. */
export async function sessionClassReset(code: string, name: string, resetCode: string, newPassword: string): Promise<void> {
	const m = await _studentMaterial(code, name, newPassword);
	await apiClassReset(code, resetCode, m.key, m.enc_name);
	await _afterStudentLogin(name);
}

/** Name und/oder Passwort ändern. Braucht das aktuelle Passwort. */
export async function sessionStudentRekey(currentPassword: string, newName: string, newPassword: string): Promise<void> {
	const s = session.student;
	const oldName = _studentName;
	if (!s?.class || !oldName) throw new ApiError(400, 'Bitte melde dich neu an.');
	const oldKey = await deriveStudentKey(s.class.class_salt, oldName, currentPassword);
	const newKey = await deriveStudentKey(s.class.class_salt, newName, newPassword);
	const enc_name = await sealForTeacher(await importPublicKey(s.class.public_key), cleanName(newName));
	await apiStudentRekey(oldKey, newKey, enc_name);
	rememberStudentName(cleanName(newName));
	_studentName = cleanName(newName);
}

/** Aus der Klasse austreten: löscht alle Daten des Schülers beim Server. */
export async function sessionLeaveClass(): Promise<void> {
	await apiStudentLeave();
	_clearLocal();
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function sessionLogout(): Promise<void> {
	await apiLogout().catch(() => {/* trotzdem lokal abmelden */});
	_clearLocal();
}

function _clearLocal(): void {
	_user = null;
	_studentName = null;
	_needsKeyRecovery = false;
	forgetStudentName();
	void clearTeacherKey();
	void setTeacherPublicKey(null);
	// Lokalen Fortschritt löschen (Schul-PC: nächster Schüler sieht nichts vom vorherigen)
	clearProgress();
	_progressVersion++;
}

// ---------------------------------------------------------------------------
// Fortschritt
// ---------------------------------------------------------------------------

async function _downloadAndMergeProgress(): Promise<void> {
	try {
		const { progress } = await apiGetProgress();
		mergeServerProgress(progress);
		_progressVersion++;
	} catch {
		// Fehlschlag ignorieren, kein Showstopper
	}
}

async function _uploadLocalProgress(): Promise<void> {
	try {
		const local = loadProgress();
		const now = Math.floor(Date.now() / 1000);
		// Vertrag: je Übungsschritt (Index in lesson.steps) eine Zeile.
		// Fertige Lektion: alle Übungen erledigt. Begonnene: Übungen vor der aktuellen Position erledigt.
		const items = Object.entries(local).flatMap(([lesson_id, p]) => {
			const idx = exerciseIndices(lesson_id, p.of);
			const upto = p.done ? Infinity : (p.step ?? 1) - 1;
			return idx.filter((i) => i < upto).map((step) => ({ lesson_id, step, done: true, attempts: 0, updated_at: now }));
		});
		if (items.length > 0) await apiPutProgress(items);
	} catch {
		// Fehlschlag ignorieren, kein Showstopper
	}
}
