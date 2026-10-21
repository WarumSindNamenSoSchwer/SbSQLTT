// Lernpfad-Einstiegspunkt. Importiert alle Lektionen aus course/ und stellt
// CATALOG, TRACK_INFO und Fortschritts-Funktionen bereit.

// Re-Exporte aus course/ fuer abwaertskompatible Imports
export { BOOKS_SEED } from './course/data.ts';
export { SCHOOL_SEED } from './course/l9-ddl.ts';
export type { Step, Lesson } from './course/types.ts';

import { selectBasics } from './course/l1-select.ts';
import { selectColumns } from './course/l2-columns.ts';
import { where } from './course/l3-where.ts';
import { orderLimit } from './course/l4-order.ts';
import { aggregates } from './course/l5-aggregates.ts';
import { groupBy } from './course/l6-group.ts';
import { joins } from './course/l7-joins.ts';
import { subqueries } from './course/l8-subqueries.ts';
import { ddl } from './course/l9-ddl.ts';
import { projectTraffic } from './course/project-traffic.ts';

export type CatalogEntry = { n: string; id: string; title: string; dur: string; track: 1 | 2 | 3 };

/** Lernpfad (Design A2). Nur Lektionen mit Inhalt in LESSONS sind schon spielbar. */
export const CATALOG: CatalogEntry[] = [
	{ n: '1', id: 'select-basics', title: 'Erste Abfrage mit SELECT', dur: '15 min', track: 1 },
	{ n: '2', id: 'select-columns', title: 'Spalten auswählen und umbenennen', dur: '15 min', track: 1 },
	{ n: '3', id: 'where-filters', title: 'Mit WHERE filtern', dur: '20 min', track: 1 },
	{ n: '4', id: 'order-limit', title: 'Ergebnisse sortieren', dur: '15 min', track: 1 },
	{ n: '5', id: 'aggregates', title: 'Zählen und zusammenfassen', dur: '20 min', track: 1 },
	{ n: '6', id: 'group-by', title: 'Gruppieren mit GROUP BY', dur: '25 min', track: 1 },
	{ n: '7', id: 'joins', title: 'Tabellen verbinden mit JOIN', dur: '25 min', track: 1 },
	{ n: '8', id: 'subqueries', title: 'Unterabfragen', dur: '25 min', track: 1 },
	{ n: '9', id: 'ddl', title: 'Eigene Datenbank entwerfen', dur: '45 min', track: 2 },
	{ n: '10', id: 'python', title: 'Daten mit Python und pandas auswerten', dur: '45 min', track: 3 },
	{ n: 'P', id: 'project', title: 'Projekt: Eigene Datenanalyse', dur: '90 min', track: 3 }
];

export const TRACK_INFO = [
	{ num: '01', id: 'beginner', name: 'SQL-Grundlagen', desc: 'Abfragen schreiben und Ergebnisse verstehen' },
	{ num: '02', id: 'database', name: 'Eigene Datenbank', desc: 'Tabellen entwerfen, Schlüssel setzen' },
	{ num: '03', id: 'python', name: 'Python & Daten', desc: 'Mit pandas eigene Fragen beantworten' }
];

import type { Lesson } from './course/types.ts';

export const LESSONS: Record<string, Lesson> = {
	[selectBasics.id]: selectBasics,
	[selectColumns.id]: selectColumns,
	[where.id]: where,
	[orderLimit.id]: orderLimit,
	[aggregates.id]: aggregates,
	[groupBy.id]: groupBy,
	[joins.id]: joins,
	[subqueries.id]: subqueries,
	[ddl.id]: ddl,
	[projectTraffic.id]: projectTraffic
};

/** Lektions-IDs die spielbar sind, aber eine eigene Route haben (kein LESSONS-Eintrag). */
export const EXTRA_PLAYABLE = ['python'];

// ---- Fortschritt (Gast: nur im Browser) -----------------------------------
export type Progress = Record<string, { done?: boolean; step?: number; of?: number }>;
const KEY = 'tabula-progress';
export function loadProgress(): Progress {
	try {
		return JSON.parse(localStorage.getItem(KEY) || '{}');
	} catch {
		return {};
	}
}
export function saveProgress(id: string, patch: Progress[string]) {
	try {
		const p = loadProgress();
		p[id] = { ...p[id], ...patch };
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		/* ignore */
	}
	// Entprellter Server-Sync (nur wenn ACCOUNTS_LIVE und angemeldet)
	_scheduleSyncToServer(id, patch);
}

/**
 * Lokalen Fortschritt loeschen (beim Abmelden: K4-Datenschutz).
 * Damit sieht der naechste Schueler am selben Schulrechner nicht den Stand des vorherigen.
 */
export function clearProgress() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		/* ignore */
	}
}

/** Indizes der Übungsschritte einer Lektion (Python-Checkliste: alle Schritte 0..of-1). */
export function exerciseIndices(lessonId: string, of?: number): number[] {
	const l = LESSONS[lessonId];
	if (l) return l.steps.flatMap((s, i) => (s.kind === 'exercise' ? [i] : []));
	return Array.from({ length: of ?? 0 }, (_, i) => i);
}

/**
 * Lokalen Fortschritt mit Server-Daten zusammenführen (nach Login / initSession).
 * Server: je Übungsschritt eine Zeile. Lektion fertig, wenn alle Übungen erledigt;
 * sonst Position = erste offene Übung. Regel: fertig gewinnt, sonst höhere Position.
 */
export function mergeServerProgress(serverProgress: { lesson_id: string; step: number; done: boolean | number }[]): void {
	try {
		const local = loadProgress();
		const byLesson = new Map<string, Set<number>>();
		for (const row of serverProgress) {
			if (!byLesson.has(row.lesson_id)) byLesson.set(row.lesson_id, new Set());
			if (row.done) byLesson.get(row.lesson_id)!.add(row.step);
		}
		for (const [lid, doneSet] of byLesson) {
			const cur = local[lid] ?? {};
			if (cur.done) continue;
			if (!(lid in LESSONS)) {
				// Checklisten-Lektion (Python) wird nur als Ganzes gemeldet
				if (doneSet.size > 0) local[lid] = { ...cur, done: true };
				continue;
			}
			const idx = exerciseIndices(lid);
			const firstOpen = idx.find((i) => !doneSet.has(i));
			if (firstOpen === undefined && idx.length) {
				local[lid] = { ...cur, done: true };
			} else if (firstOpen !== undefined && firstOpen > 0) {
				const pos = firstOpen + 1; // 1-basiert wie saveProgress({ step })
				if (pos > (cur.step ?? 0)) local[lid] = { ...cur, step: pos, of: LESSONS[lid].steps.length };
			}
		}
		localStorage.setItem(KEY, JSON.stringify(local));
	} catch {
		/* ignore */
	}
}

// ---- Entprellter Server-Sync -----------------------------------------------
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
const _pendingSync: Map<string, Progress[string]> = new Map();

function _scheduleSyncToServer(id: string, patch: Progress[string]) {
	_pendingSync.set(id, { ...(_pendingSync.get(id) ?? {}), ...patch });
	if (_syncTimer) clearTimeout(_syncTimer);
	_syncTimer = setTimeout(_flushSyncToServer, 2000);
}

async function _flushSyncToServer() {
	_syncTimer = null;
	if (_pendingSync.size === 0) return;

	// Dynamisch importieren um Circular-Import-Probleme zu vermeiden
	try {
		const { ACCOUNTS_LIVE } = await import('./flags.js');
		if (!ACCOUNTS_LIVE) return;
		const { session } = await import('./session.svelte.js');
		if (!session.user) return;
		const { apiPutProgress } = await import('./api.js');

		const items = [];
		const nowTs = Math.floor(Date.now() / 1000);

		for (const [lesson_id, p] of _pendingSync.entries()) {
			// Nur Lektionen ohne Übungs-Sync (Python-Checkliste): alle Schritte als erledigt melden.
			// SQL-Lektionen melden ihre Übungen einzeln über syncExerciseStep; eine zusätzliche
			// Positionszeile würde dort Übungszeilen überschreiben.
			if (p.done && !(lesson_id in LESSONS)) {
				const n = p.of ?? 1;
				for (let s = 0; s < n; s++) items.push({ lesson_id, step: s, done: true, attempts: 0, updated_at: nowTs });
			}
		}

		_pendingSync.clear();

		if (items.length > 0) {
			await apiPutProgress(items).catch(() => {/* ignore */});
		}
	} catch {
		// ignore
	}
}

// ---- Entprellter Per-Schritt-Sync (neues Vertragsformat, aus Lektions-Seite) ----

type StepSyncEntry = {
	lesson_id: string;
	/** 0-basierter Index des Uebungsschritts in lesson.steps (nur kind==='exercise') */
	step: number;
	done: boolean;
	attempts: number;
	/** Letzte SQL-Abfrage (leer wenn kein Fehler) */
	lastQuery: string;
	/** Fehlermeldung; leer wenn kein Fehler, 'Ergebnis stimmt nicht' bei wrong */
	errorMsg: string;
};

let _stepSyncTimer: ReturnType<typeof setTimeout> | null = null;
// Map key: `${lesson_id}:${step}`
const _pendingStepSync: Map<string, StepSyncEntry> = new Map();

/**
 * Entprellter Sync eines einzelnen Uebungsschritts zum Server.
 * Vertrag: pro Uebungsschritt eine Zeile, step = 0-basierter Index,
 * done=true wenn geloest, attempts = Anzahl Ausfuehrungen dieser Uebung,
 * last_attempts mit letzter Abfrage + Fehlermeldung.
 * Nur wenn ACCOUNTS_LIVE und angemeldet.
 */
export function syncExerciseStep(entry: StepSyncEntry) {
	const key = `${entry.lesson_id}:${entry.step}`;
	const existing = _pendingStepSync.get(key);
	// Aktuellsten Stand mergen: attempts aufaddieren, done bleibt true wenn einmal true
	_pendingStepSync.set(key, {
		...entry,
		done: existing?.done || entry.done,
		attempts: entry.attempts, // ueberschreiben, nicht addieren (immer aktueller Wert)
	});
	if (_stepSyncTimer) clearTimeout(_stepSyncTimer);
	_stepSyncTimer = setTimeout(_flushStepSyncToServer, 2000);
}

async function _flushStepSyncToServer() {
	_stepSyncTimer = null;
	if (_pendingStepSync.size === 0) return;

	try {
		const { ACCOUNTS_LIVE } = await import('./flags.js');
		if (!ACCOUNTS_LIVE) return;
		const { session } = await import('./session.svelte.js');
		if (!session.user) return;
		const { apiPutProgress } = await import('./api.js');

		const nowTs = Math.floor(Date.now() / 1000);
		const progress = [];
		const last_attempts = [];

		for (const e of _pendingStepSync.values()) {
			progress.push({
				lesson_id: e.lesson_id,
				step: e.step,
				done: e.done,
				attempts: e.attempts,
				updated_at: nowTs,
			});
			// last_attempt immer senden (auch bei Erfolg mit leerem error_msg)
			last_attempts.push({
				lesson_id: e.lesson_id,
				step: e.step,
				query: e.lastQuery,
				error_msg: e.errorMsg,
			});
		}

		_pendingStepSync.clear();

		await apiPutProgress(progress, last_attempts).catch(() => {/* ignore */});
	} catch {
		// ignore
	}
}
