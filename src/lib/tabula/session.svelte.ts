/**
 * Session-Store: aktueller angemeldeter Nutzer.
 *
 * - GET /api/me beim Start (nur wenn ACCOUNTS_LIVE)
 * - login / logout / register
 * - Fortschritt-Sync nach Login (einmalige Uebernahme lokaler Daten, K4)
 */

import { ACCOUNTS_LIVE } from './flags.js';
import {
  apiMe,
  apiLogin,
  apiLogout,
  apiRegister,
  apiGetProgress,
  apiPutProgress,
  type PublicUser,
  type RegisterStudentBody,
  type RegisterTeacherBody,
} from './api.js';
import { loadProgress, clearProgress, mergeServerProgress, exerciseIndices } from './lessons.js';

// ---------------------------------------------------------------------------
// Reaktiver Zustand
// ---------------------------------------------------------------------------

let _user = $state<PublicUser | null>(null);
let _loading = $state(true);
let _error = $state<string | null>(null);
/** Wird nach jedem Server-Merge/Leeren des Fortschritts erhöht, damit Seiten neu laden. */
let _progressVersion = $state(0);

export const session = {
  get user(): PublicUser | null { return _user; },
  get loading(): boolean { return _loading; },
  get error(): string | null { return _error; },
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
    const { user } = await apiMe();
    _user = user;
    // Fortschritt vom Server laden und mit lokalem Stand zusammenfuehren
    if (user) {
      await _downloadAndMergeProgress();
    }
  } catch {
    // Nicht angemeldet oder Fehler: kein Problem
    _user = null;
  } finally {
    _loading = false;
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function sessionLogin(loginInput: string, password: string): Promise<void> {
  await apiLogin(loginInput, password);
  const { user } = await apiMe();
  _user = user;
  // Einmalige Uebernahme lokaler Fortschrittsdaten (K4)
  await _uploadLocalProgress();
  // Server-Stand laden und zusammenfuehren (zweites Geraet sieht sofort den Stand)
  await _downloadAndMergeProgress();
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function sessionLogout(): Promise<void> {
  await apiLogout();
  _user = null;
  // Lokalen Fortschritt loeschen (K4: Schulrechner-Datenschutz).
  // Damit sieht der naechste Schueler am selben Geraet nicht den Stand des vorherigen.
  clearProgress();
  _progressVersion++;
}

// ---------------------------------------------------------------------------
// Registrieren
// ---------------------------------------------------------------------------

export async function sessionRegister(
  body: RegisterStudentBody | RegisterTeacherBody,
): Promise<void> {
  await apiRegister(body);
  const { user } = await apiMe();
  _user = user;
  // Einmalige Uebernahme lokaler Fortschrittsdaten (K4)
  await _uploadLocalProgress();
  // Server-Stand laden und zusammenfuehren
  await _downloadAndMergeProgress();
}

// ---------------------------------------------------------------------------
// Hilfsfunktion: Fortschritt vom Server laden und mit lokalem Stand zusammenfuehren
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

// ---------------------------------------------------------------------------
// Hilfsfunktion: lokale Fortschrittsdaten einmalig hochladen
// ---------------------------------------------------------------------------

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
