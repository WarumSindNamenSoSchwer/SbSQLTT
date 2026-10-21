// Erklaert eine SELECT-Abfrage anhand der Quelltabellen: welche Zeilen bleiben,
// welche Spalten werden gezeigt, in welcher Reihenfolge, welche Zeilen gehoeren
// bei JOIN zusammen und welche werden bei GROUP BY zusammengefasst.
// Arbeitet mit der echten SQLite-Datenbank (rowid), nicht mit Schaetzungen.
import type { Database } from 'sql.js';
import { runIsolated, type Schema } from './sql.ts';

export type VizRow = { rid: number; cells: (string | number | null)[]; kept: boolean; rank?: number; group?: number };
export type VizTable = { name: string; alias: string; cols: { name: string; sel: boolean; cond: boolean }[]; rows: VizRow[] };
export type Viz = {
	tables: VizTable[];
	links: [number, number][]; // rid links table0 -> table1 (JOIN)
	keys: [string | null, string | null]; // Spalten der ON-Bedingung je Tabelle
	ordered: boolean;
	limited: boolean;
	aggregate: 'none' | 'all' | 'groups';
	groups: number;
	keptCount: number;
	resultCount: number;
	note: string;
};

const KW = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'] as const;

/** Positionen der Hauptklauseln auf oberster Ebene (nicht in Klammern oder Strings). */
function clauses(sql: string) {
	const up = sql.toUpperCase();
	const pos: Partial<Record<(typeof KW)[number] | 'SELECT', number>> = {};
	let depth = 0;
	let q: string | null = null;
	for (let i = 0; i < sql.length; i++) {
		const c = sql[i];
		if (q) {
			if (c === q) q = null;
			continue;
		}
		if (c === "'" || c === '"') q = c;
		else if (c === '(') depth++;
		else if (c === ')') depth--;
		else if (depth === 0 && /[A-Za-z]/.test(c) && (i === 0 || !/[\w.]/.test(sql[i - 1]))) {
			for (const k of ['SELECT', ...KW] as const) {
				const re = new RegExp('^' + k.replace(' ', '\\s+') + '\\b');
				if (pos[k] === undefined && re.test(up.slice(i))) pos[k] = i;
			}
		}
	}
	return pos;
}

function part(sql: string, pos: ReturnType<typeof clauses>, k: keyof typeof pos) {
	const s = pos[k];
	if (s === undefined) return '';
	const ends = Object.values(pos).filter((p): p is number => p !== undefined && p > s);
	return sql.slice(s, ends.length ? Math.min(...ends) : sql.length);
}

const idents = (s: string) => new Set((s.replace(/'[^']*'/g, ' ').match(/[A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)?/g) ?? []).map((t) => t.toLowerCase()));

export function explainQuery(db: Database, rawSql: string, schema: Schema, result: { columns: string[]; rows: unknown[][] }): Viz | null {
	const sql = rawSql.trim().replace(/;\s*$/, '');
	if (!/^select\b/i.test(sql) || sql.includes(';')) return null;
	const pos = clauses(sql);
	if (pos.FROM === undefined) return null;
	const selectList = sql.slice((pos.SELECT ?? 0) + 6, pos.FROM);
	const from = part(sql, pos, 'FROM');
	const where = part(sql, pos, 'WHERE');
	const groupBy = part(sql, pos, 'GROUP BY');
	const having = part(sql, pos, 'HAVING');
	const orderBy = part(sql, pos, 'ORDER BY');
	const limit = part(sql, pos, 'LIMIT');

	// Tabellen + Aliase aus FROM/JOIN
	const known = new Map(schema.map((t) => [t.table.toLowerCase(), t]));
	const tables: { name: string; alias: string }[] = [];
	const re = /\b(?:FROM|JOIN)\s+([A-Za-z_]\w*)(?:\s+(?:AS\s+)?(?!(?:ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|WHERE|GROUP|ORDER|LIMIT|USING)\b)([A-Za-z_]\w*))?/gi;
	for (const m of from.matchAll(re)) {
		const t = known.get(m[1].toLowerCase());
		if (!t) return null;
		tables.push({ name: t.table, alias: m[2] ?? t.table });
	}
	if (!tables.length || tables.length > 2) return null;

	const aggRe = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i;
	const aggregate: Viz['aggregate'] = groupBy ? 'groups' : aggRe.test(selectList) ? 'all' : 'none';
	const ridCols = tables.map((t) => `${t.alias}.rowid`);
	const groupExpr = groupBy.replace(/^GROUP\s+BY\s+/i, '');
	const keptSql =
		aggregate === 'none'
			? `SELECT ${ridCols.join(', ')} ${from} ${where} ${orderBy} ${limit}`
			: `SELECT ${ridCols.join(', ')}${aggregate === 'groups' ? `, ${groupExpr}` : ''} ${from} ${where}`;
	let kept: (number | null)[][];
	try {
		kept = runIsolated(db, keptSql).rows as (number | null)[][];
	} catch {
		return null;
	}
	// Bei GROUP BY + HAVING: nur Gruppen, die im Ergebnis stehen, gelten als behalten
	let groupKeys: string[] = [];
	if (aggregate === 'groups') {
		try {
			const g = runIsolated(db, `SELECT ${groupExpr} ${from} ${where} ${groupBy} ${having}`).rows;
			groupKeys = g.map((r) => JSON.stringify(r));
		} catch {
			return null;
		}
		const gw = tables.length;
		kept = kept.filter((r) => groupKeys.includes(JSON.stringify(r.slice(gw))));
	}

	const selIds = idents(selectList);
	const condIds = idents(`${where} ${groupBy} ${having} ${orderBy}`);
	const star = /(^|[\s,])\*/.test(selectList);
	const vt: VizTable[] = tables.map((t, ti) => {
		const sch = known.get(t.name.toLowerCase())!;
		const all = runIsolated(db, `SELECT rowid, * FROM ${t.name}`).rows;
		const has = (ids: Set<string>, c: string) => ids.has(c.toLowerCase()) || ids.has(`${t.alias}.${c}`.toLowerCase());
		const tStar = star || selIds.has(`${t.alias}.*`.toLowerCase());
		const cols = sch.cols.map((c) => ({ name: c.name, sel: tStar || has(selIds, c.name), cond: has(condIds, c.name) }));
		const rank = new Map<number, number>();
		const grp = new Map<number, number>();
		kept.forEach((r, i) => {
			const rid = r[ti];
			if (rid == null) return;
			if (!rank.has(rid)) rank.set(rid, i + 1);
			if (aggregate === 'groups') grp.set(rid, groupKeys.indexOf(JSON.stringify(r.slice(tables.length))));
		});
		return {
			name: t.name,
			alias: t.alias,
			cols,
			rows: all.map((r) => {
				const rid = r[0] as number;
				return {
					rid,
					cells: r.slice(1) as VizRow['cells'],
					kept: rank.has(rid),
					rank: orderBy && aggregate === 'none' ? rank.get(rid) : undefined,
					group: grp.get(rid)
				};
			})
		};
	});
	const links: [number, number][] = tables.length === 2 ? kept.filter((r) => r[0] != null && r[1] != null).map((r) => [r[0]!, r[1]!]) : [];
	// Schluesselspalten aus ON a.x = b.y
	const keys: [string | null, string | null] = [null, null];
	const on = from.match(/\bON\s+([\w.]+)\s*=\s*([\w.]+)/i);
	if (on && tables.length === 2) {
		for (const ref of [on[1], on[2]]) {
			const [a, c] = ref.includes('.') ? ref.split('.') : [null, ref];
			const ti = a ? tables.findIndex((t) => t.alias.toLowerCase() === a.toLowerCase()) : -1;
			if (ti >= 0) keys[ti] = c;
		}
	}
	const keptCount = tables.length === 2 ? kept.length : vt[0].rows.filter((r) => r.kept).length;
	const total = vt[0].rows.length;
	const out = total - vt[0].rows.filter((r) => r.kept).length;

	let note = '';
	const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
	if (aggregate === 'all') note = `${n(keptCount, 'Zeile wird', 'Zeilen werden')} zu einer Ergebniszeile zusammengefasst.`;
	else if (aggregate === 'groups')
		note = `${n(keptCount, 'Zeile bildet', 'Zeilen bilden')} ${n(groupKeys.length, 'Gruppe', 'Gruppen')}. Jede Gruppe wird eine Ergebniszeile.`;
	else if (tables.length === 2) note = `${n(links.length, 'Paar passt', 'Paare passen')} über die ON-Bedingung zusammen.`;
	else {
		const bits = [];
		if (where) bits.push(out ? `${n(out, 'Zeile fällt', 'Zeilen fallen')} durch die Bedingung heraus` : 'Alle Zeilen erfüllen die Bedingung');
		if (limit) bits.push(`LIMIT behält ${n(keptCount, 'Zeile', 'Zeilen')}`);
		if (orderBy) bits.push('die Nummern zeigen die Reihenfolge');
		note = bits.length ? bits.join(', ') + '.' : `Alle ${n(total, 'Zeile', 'Zeilen')} kommen ins Ergebnis.`;
		note = note[0].toUpperCase() + note.slice(1);
	}
	return { tables: vt, links, keys, ordered: !!orderBy, limited: !!limit, aggregate, groups: groupKeys.length, keptCount, resultCount: result.rows.length, note };
}
