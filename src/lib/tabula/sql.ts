// Echte SQLite-Datenbank im Browser (sql.js / WASM). Nichts verlaesst den Rechner.
import type { Database, SqlJsStatic } from 'sql.js';

let sqlPromise: Promise<SqlJsStatic> | null = null;

export function loadSql(): Promise<SqlJsStatic> {
	if (!sqlPromise) {
		sqlPromise = import('sql.js')
			.then((m) => (m.default ?? m)({ locateFile: () => '/sql/sql-wasm.wasm' }))
			.catch((e) => {
				sqlPromise = null;
				throw e;
			});
	}
	return sqlPromise;
}

export async function openDb(seed: string): Promise<Database> {
	const SQL = await loadSql();
	const db = new SQL.Database();
	db.run(seed);
	return db;
}

export type Result = { columns: string[]; rows: (string | number | null)[][] };

/** Fuehrt eine Abfrage aus und gibt das letzte Ergebnis zurueck. */
export function run(db: Database, sql: string): Result {
	const res = db.exec(sql);
	const last = res[res.length - 1];
	if (!last) return { columns: [], rows: [] };
	return { columns: last.columns, rows: last.values as Result['rows'] };
}

/** Wie run, aber alle Aenderungen (CREATE, INSERT, UPDATE ...) werden danach zurueckgerollt. */
export function runIsolated(db: Database, sql: string): Result {
	db.run('SAVEPOINT tb_iso');
	try {
		return run(db, sql);
	} finally {
		db.run('ROLLBACK TO tb_iso; RELEASE tb_iso');
	}
}

export function exportDb(db: Database, name: string) {
	const blob = new Blob([db.export() as BlobPart], { type: 'application/vnd.sqlite3' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export type Schema = { table: string; cols: { name: string; type: string; key?: 'PK' | 'FK' }[] }[];

export function readSchema(db: Database): Schema {
	const tables = run(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid");
	return tables.rows.map(([t]) => {
		const info = run(db, `PRAGMA table_info("${t}")`);
		const fks = new Set(run(db, `PRAGMA foreign_key_list("${t}")`).rows.map((r) => r[3] as string));
		return {
			table: String(t),
			cols: info.rows.map((r) => ({
				name: String(r[1]),
				type: String(r[2]).toLowerCase().replace('integer', 'int'),
				key: r[5] ? ('PK' as const) : fks.has(String(r[1])) ? ('FK' as const) : undefined
			}))
		};
	});
}

// ---- Fehlermeldungen verstaendlich machen -------------------------------

const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'JOIN', 'ON', 'LIMIT', 'AND', 'OR', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE'];

function lev(a: string, b: string) {
	const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
	for (let j = 1; j <= b.length; j++) d[0][j] = j;
	for (let i = 1; i <= a.length; i++)
		for (let j = 1; j <= b.length; j++)
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
	return d[a.length][b.length];
}

export type Explained = { msg: string; line: number | null; orig: string };

export function explainError(sql: string, err: unknown): Explained {
	const orig = String((err as Error)?.message ?? err);
	const lines = sql.split('\n');
	// Tippfehler in Schluesselwoertern finden
	for (let i = 0; i < lines.length; i++) {
		for (const w of lines[i].match(/[A-Za-z_]+/g) ?? []) {
			const up = w.toUpperCase();
			if (KEYWORDS.includes(up) || w.length < 3) continue;
			const hit = KEYWORDS.find((k) => k.length >= 4 && lev(up, k) === 1);
			if (hit && /^[A-Z]+$/.test(w)) return { msg: `Zeile ${i + 1}: „${w}“ kennt SQL nicht. Meintest du ${hit}?`, line: i + 1, orig };
		}
	}
	const lineOf = (needle: string) => {
		const idx = lines.findIndex((l) => l.toLowerCase().includes(needle.toLowerCase()));
		return idx >= 0 ? idx + 1 : null;
	};
	let m = orig.match(/no such column: ([\w.]+)/);
	if (m) return { msg: `Die Spalte „${m[1]}“ gibt es nicht. Schau ins Schema.`, line: lineOf(m[1]), orig };
	m = orig.match(/no such table: (\w+)/);
	if (m) return { msg: `Die Tabelle „${m[1]}“ gibt es nicht. Schau ins Schema.`, line: lineOf(m[1]), orig };
	m = orig.match(/near "([^"]+)": syntax error/);
	if (m) {
		const l = lineOf(m[1]);
		return { msg: `${l ? `Zeile ${l}: ` : ''}Syntaxfehler bei „${m[1]}“.`, line: l, orig };
	}
	if (/incomplete input/.test(orig)) return { msg: 'Die Abfrage ist unvollständig. Fehlt noch etwas am Ende?', line: lines.length, orig };
	return { msg: 'SQL konnte die Abfrage nicht ausführen.', line: null, orig };
}

// ---- Ergebnis pruefen -----------------------------------------------------

export type Check = { ok: true } | { ok: false; msg: string; sub: string };

export function compare(got: Result, want: Result, ordered: boolean): Check {
	const no = 'Noch nicht ganz.';
	const missing = want.columns.filter((c) => !got.columns.map((x) => x.toLowerCase()).includes(c.toLowerCase()));
	const extra = got.columns.filter((c) => !want.columns.map((x) => x.toLowerCase()).includes(c.toLowerCase()));
	const key = (r: unknown[]) => JSON.stringify(r);
	const proj = (res: Result, cols: string[]) => {
		const idx = cols.map((c) => res.columns.findIndex((x) => x.toLowerCase() === c.toLowerCase()));
		return res.rows.map((r) => idx.map((i) => (i < 0 ? null : r[i])));
	};
	const shared = want.columns.filter((c) => !missing.includes(c));
	const g = proj(got, shared).map(key);
	const w = proj(want, shared).map(key);
	const sameSet = g.length === w.length && [...g].sort().join() === [...w].sort().join();
	const rowsHint = () => {
		const d = got.rows.length - want.rows.length;
		if (d > 0) return `${d} ${d === 1 ? 'Zeile' : 'Zeilen'} zu viel.`;
		if (d < 0) return `${-d} ${d === -1 ? 'Zeile' : 'Zeilen'} zu wenig.`;
		return 'Die Zeilen stimmen noch nicht.';
	};
	if (missing.length) {
		const cols = missing.join(', ');
		return { ok: false, msg: no, sub: sameSet ? `Die Zeilen stimmen. Es fehlt die Spalte ${cols}.` : `Es fehlt die Spalte ${cols}. ${rowsHint()}` };
	}
	if (!sameSet) return { ok: false, msg: no, sub: rowsHint() };
	if (extra.length) return { ok: false, msg: no, sub: `Die Spalte ${extra.join(', ')} ist zu viel.` };
	if (ordered && g.join() !== w.join()) return { ok: false, msg: no, sub: 'Die Zeilen stimmen. Die Reihenfolge noch nicht.' };
	return { ok: true };
}
