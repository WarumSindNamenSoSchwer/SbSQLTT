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
	[ddl.id]: ddl
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
}
