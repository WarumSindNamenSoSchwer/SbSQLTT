// ----- mock data: tracks, lessons, in-memory tables --------------------------

export type LessonStatus = 'done' | 'active' | 'todo';

export type LessonSummary = {
	id: string;
	title: string;
	minutes: number;
	status: LessonStatus;
};

export type Track = {
	id: string;
	label: string;
	blurb: string;
	lessons: LessonSummary[];
};

export type Row = Record<string, string | number | boolean | null | undefined>;

export type ReadStep = {
	kind: 'read';
	title: string;
	body: string;
	code?: string;
};

export type CheckStep = {
	kind: 'check';
	title: string;
	body: string;
	starter: string;
	expected: {
		columns: string[];
		rowsMatch: (rows: Row[]) => boolean;
	};
};

export type Step = ReadStep | CheckStep;

export type Lesson = {
	track: string;
	id: string;
	title: string;
	subtitle: string;
	steps: Step[];
};

export const TRACKS: Track[] = [
	{
		id: 'beginner',
		label: 'Anfänger',
		blurb: 'SELECT-Abfragen lesen und schreiben, sicher werden bei den Grundlagen.',
		lessons: [
			{ id: 'select-basics', title: 'SELECT-Grundlagen', minutes: 6, status: 'done' },
			{ id: 'where-filters', title: 'Mit WHERE filtern', minutes: 8, status: 'active' },
			{ id: 'order-limit', title: 'ORDER BY und LIMIT', minutes: 5, status: 'todo' },
			{ id: 'distinct', title: 'DISTINCT-Werte', minutes: 4, status: 'todo' },
			{ id: 'null-handling', title: 'Umgang mit NULL', minutes: 7, status: 'todo' }
		]
	},
	{
		id: 'intermediate',
		label: 'Fortgeschritten',
		blurb: 'Aggregationen, Gruppierung und das Verknüpfen mehrerer Tabellen.',
		lessons: [
			{ id: 'aggregates', title: 'COUNT, SUM, AVG', minutes: 9, status: 'todo' },
			{ id: 'group-by', title: 'GROUP BY und HAVING', minutes: 11, status: 'todo' },
			{ id: 'inner-join', title: 'INNER JOIN', minutes: 12, status: 'todo' },
			{ id: 'outer-joins', title: 'LEFT- und RIGHT-JOIN', minutes: 14, status: 'todo' }
		]
	},
	{
		id: 'advanced',
		label: 'Profi',
		blurb: 'Subqueries, Window Functions und Abfragen, die du wirklich brauchst.',
		lessons: [
			{ id: 'subqueries', title: 'Subqueries', minutes: 13, status: 'todo' },
			{ id: 'ctes', title: 'Common Table Expressions', minutes: 15, status: 'todo' },
			{ id: 'window-fn', title: 'Window Functions', minutes: 18, status: 'todo' },
			{ id: 'indexes', title: 'Indizes und EXPLAIN', minutes: 16, status: 'todo' }
		]
	}
];

// Aktuelle Lektion: Mit WHERE filtern. Die Lektion besteht aus Schritten; der
// letzte Schritt ist eine Übung, deren `expected` gegen das Abfrageergebnis
// geprüft wird.
export const CURRENT_LESSON: Lesson = {
	track: 'beginner',
	id: 'where-filters',
	title: 'Mit WHERE filtern',
	subtitle: 'Zeilen mit einer Bedingung gezielt aus dem Ergebnis ausschließen.',
	steps: [
		{
			kind: 'read',
			title: 'Warum filtern?',
			body: `Die meisten Tabellen enthalten viel mehr Zeilen, als du brauchst. Eine
WHERE-Klausel behält nur die Zeilen, die zu einer Bedingung passen; alles andere
wird verworfen, bevor das Ergebnis bei dir ankommt.`
		},
		{
			kind: 'read',
			title: 'Aufbau von WHERE',
			body: `WHERE steht direkt nach der FROM-Klausel. Die Bedingung ist ein beliebiger
Ausdruck, der wahr oder falsch ergibt: Vergleiche (=, <, >=, <>), logische
Operatoren (AND, OR, NOT) und Mustervergleiche (LIKE).`,
			code: `SELECT title, year
FROM   books
WHERE  year >= 2000;`
		},
		{
			kind: 'read',
			title: 'Bedingungen kombinieren',
			body: `AND verlangt, dass beide Seiten wahr sind. OR genügt es, wenn eine Seite
wahr ist. Klammere gemischte Ausdrücke, damit die Auswertungsreihenfolge für die
nächste Person, die deine Abfrage liest, klar ist (in der Regel bist du das selbst).`
		},
		{
			kind: 'check',
			title: 'Übung: Bücher nach 2010',
			body: `Schreibe eine Abfrage, die Titel und Erscheinungsjahr aller Bücher liefert,
die strikt nach 2010 erschienen sind, sortiert nach Jahr aufsteigend.`,
			starter: `SELECT title, year\nFROM   books\nWHERE  -- deine Bedingung hier\nORDER BY year ASC;`,
			expected: {
				// Wir prüfen Spalten und Zeilen, die die Mock-Engine zurückliefert.
				columns: ['title', 'year'],
				rowsMatch: (rows: Row[]) =>
					rows.length > 0 &&
					rows.every((r) => (r.year as number) > 2010) &&
					rows.every(
						(r, i, a) =>
							i === 0 || (a[i - 1].year as number) <= (r.year as number)
					)
			}
		},
		{
			kind: 'read',
			title: 'Zusammenfassung',
			body: `WHERE wird vor ORDER BY und LIMIT angewendet. Die Datenbank prüft die
Bedingung Zeile für Zeile, behält die Treffer und sortiert oder begrenzt erst
danach. Als Nächstes: ORDER BY und LIMIT im Detail.`
		}
	]
};

// In-memory "books" table for the mock SQL engine.
const BOOKS: Row[] = [
	{ id: 1, title: 'The Pragmatic Programmer', author: 'Hunt & Thomas', year: 1999, pages: 320 },
	{
		id: 2,
		title: 'Designing Data-Intensive Apps',
		author: 'Martin Kleppmann',
		year: 2017,
		pages: 616
	},
	{ id: 3, title: 'SQL for Smarties', author: 'Joe Celko', year: 2010, pages: 832 },
	{ id: 4, title: 'Refactoring', author: 'Martin Fowler', year: 2018, pages: 448 },
	{ id: 5, title: 'Database Internals', author: 'Alex Petrov', year: 2019, pages: 376 },
	{ id: 6, title: 'The Mythical Man-Month', author: 'Fred Brooks', year: 1975, pages: 322 },
	{ id: 7, title: 'Crafting Interpreters', author: 'Robert Nystrom', year: 2021, pages: 640 },
	{ id: 8, title: 'Code', author: 'Charles Petzold', year: 1999, pages: 400 },
	{
		id: 9,
		title: 'Seven Databases in Seven Weeks',
		author: 'Redmond & Wilson',
		year: 2018,
		pages: 354
	}
];

export const TABLES: Record<string, Row[]> = { books: BOOKS };

export type SqlResult = { columns: string[]; rows: Row[] };

// ----- a deliberately small SQL "engine" -------------------------------------
//
// Supports a useful subset for lessons:
//   SELECT col1, col2, ...   (or *)
//   FROM   <table>
//   WHERE  <conditions with AND / OR, operators = <> < <= > >= LIKE, literals>
//   ORDER BY col [ASC|DESC] [, col [ASC|DESC] ...]
//   LIMIT  n
//
// Returns { columns, rows } on success or throws an Error with a friendly message.

export function runSQL(sql: string): SqlResult {
	const original = sql;
	let q = sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim();
	if (q.endsWith(';')) q = q.slice(0, -1);
	if (!q) throw new Error('Type a query, then hit Run (or ⌘↵).');

	// tokenize-ish: keep strings as one chunk
	const lower = q.toLowerCase();
	if (!lower.startsWith('select ')) {
		throw new Error(
			`Only SELECT queries are supported in this lesson. Got: "${original.trim().split(/\s+/)[0]}"`
		);
	}

	const fromIdx = findKw(lower, ' from ');
	if (fromIdx < 0) throw new Error('Missing FROM clause.');

	const colsPart = q.slice(7, fromIdx).trim();
	const rest = q.slice(fromIdx + 6).trim();

	// FROM <table> [WHERE ...] [ORDER BY ...] [LIMIT n]
	const whereIdx = findKw(rest.toLowerCase(), ' where ');
	const orderIdx = findKw(rest.toLowerCase(), ' order by ');
	const limitIdx = findKw(rest.toLowerCase(), ' limit ');

	const firstClause = [whereIdx, orderIdx, limitIdx]
		.filter((i) => i >= 0)
		.sort((a, b) => a - b)[0];
	const tableName = (firstClause == null ? rest : rest.slice(0, firstClause)).trim();
	if (!TABLES[tableName.toLowerCase()]) {
		throw new Error(
			`Unknown table "${tableName}". Try: ${Object.keys(TABLES).join(', ')}.`
		);
	}
	const table = TABLES[tableName.toLowerCase()];
	const allCols = Object.keys(table[0]);

	// columns
	let cols: string[];
	if (colsPart === '*') {
		cols = allCols;
	} else {
		cols = colsPart.split(',').map((s) => s.trim());
		for (const c of cols) {
			if (!allCols.includes(c)) {
				throw new Error(
					`Unknown column "${c}" in table "${tableName}". Known: ${allCols.join(', ')}.`
				);
			}
		}
	}

	// where
	let rows = table.slice();
	if (whereIdx >= 0) {
		const end =
			[orderIdx, limitIdx]
				.filter((i) => i > whereIdx)
				.sort((a, b) => a - b)[0] ?? rest.length;
		const cond = rest.slice(whereIdx + 7, end).trim();
		rows = rows.filter((r) => evalCond(cond, r, allCols));
	}

	// order by
	if (orderIdx >= 0) {
		const end = limitIdx > orderIdx ? limitIdx : rest.length;
		const ob = rest.slice(orderIdx + 10, end).trim();
		const parts = ob
			.split(',')
			.map((s) => s.trim())
			.map((p) => {
				const m = p.match(/^(\w+)\s*(asc|desc)?$/i);
				if (!m) throw new Error(`Could not parse ORDER BY "${p}".`);
				if (!allCols.includes(m[1])) throw new Error(`Unknown column "${m[1]}" in ORDER BY.`);
				return { col: m[1], dir: (m[2] || 'asc').toLowerCase() };
			});
		rows.sort((a, b) => {
			for (const p of parts) {
				const av = a[p.col];
				const bv = b[p.col];
				if (av === bv) continue;
				const cmp = (av as number | string) > (bv as number | string) ? 1 : -1;
				return p.dir === 'desc' ? -cmp : cmp;
			}
			return 0;
		});
	}

	// limit
	if (limitIdx >= 0) {
		const n = parseInt(rest.slice(limitIdx + 7).trim(), 10);
		if (!Number.isFinite(n) || n < 0) throw new Error('LIMIT needs a non-negative integer.');
		rows = rows.slice(0, n);
	}

	// project
	const projected: Row[] = rows.map((r) => {
		const o: Row = {};
		for (const c of cols) o[c] = r[c];
		return o;
	});

	return { columns: cols, rows: projected };
}

function findKw(s: string, kw: string): number {
	// find keyword surrounded by spaces (we normalized whitespace already)
	return s.indexOf(kw);
}

type Token =
	| '('
	| ')'
	| { kind: 'str'; value: string }
	| { kind: 'op'; value: string }
	| { kind: 'kw'; value: string }
	| { kind: 'num'; value: number }
	| { kind: 'id'; value: string };

// condition evaluator: supports AND/OR (no NOT in the lesson scope), parens,
// comparison ops, LIKE, IS NULL / IS NOT NULL.
function evalCond(expr: string, row: Row, cols: string[]): boolean {
	// shunting-yard-lite: split on AND/OR at top level
	const tokens = tokenizeCond(expr);
	return evalTokens(tokens, row, cols);
}

function tokenizeCond(s: string): Token[] {
	const out: Token[] = [];
	let i = 0;
	while (i < s.length) {
		const c = s[i];
		if (c === ' ') {
			i++;
			continue;
		}
		if (c === '(' || c === ')') {
			out.push(c);
			i++;
			continue;
		}
		if (c === "'") {
			let j = i + 1;
			while (j < s.length && s[j] !== "'") j++;
			out.push({ kind: 'str', value: s.slice(i + 1, j) });
			i = j + 1;
			continue;
		}
		// operators
		const ops = ['<>', '<=', '>=', '=', '<', '>'];
		let matched = false;
		for (const op of ops) {
			if (s.startsWith(op, i)) {
				out.push({ kind: 'op', value: op });
				i += op.length;
				matched = true;
				break;
			}
		}
		if (matched) continue;
		// word
		let j = i;
		while (j < s.length && /[A-Za-z0-9_.%]/.test(s[j])) j++;
		const w = s.slice(i, j);
		if (!w) throw new Error(`Unexpected character "${c}" in condition.`);
		const wl = w.toLowerCase();
		if (wl === 'and' || wl === 'or' || wl === 'like' || wl === 'is' || wl === 'not' || wl === 'null') {
			out.push({ kind: 'kw', value: wl });
		} else if (/^-?\d+(\.\d+)?$/.test(w)) {
			out.push({ kind: 'num', value: parseFloat(w) });
		} else {
			out.push({ kind: 'id', value: w });
		}
		i = j;
	}
	return out;
}

function evalTokens(tokens: Token[], row: Row, cols: string[]): boolean {
	// recursive descent: expr := term (OR term)*; term := factor (AND factor)*;
	// factor := '(' expr ')' | atom
	let pos = 0;
	const peek = (): Token | undefined => tokens[pos];

	function expr(): boolean {
		let left = term();
		while (peek() && (peek() as { kind?: string; value?: string }).kind === 'kw' && (peek() as { value: string }).value === 'or') {
			pos++;
			left = left || term();
		}
		return left;
	}
	function term(): boolean {
		let left = factor();
		while (peek() && (peek() as { kind?: string; value?: string }).kind === 'kw' && (peek() as { value: string }).value === 'and') {
			pos++;
			left = left && factor();
		}
		return left;
	}
	function factor(): boolean {
		if (peek() === '(') {
			pos++;
			const v = expr();
			if (tokens[pos] !== ')') throw new Error('Missing closing ")".');
			pos++;
			return v;
		}
		return atom();
	}
	function atom(): boolean {
		const a = tokens[pos++];
		if (!a) throw new Error('Unexpected end of condition.');
		if (typeof a === 'string' || a.kind !== 'id')
			throw new Error(`Expected a column name, got "${typeof a === 'string' ? a : (a as { value: unknown }).value}".`);
		if (!cols.includes(a.value)) throw new Error(`Unknown column "${a.value}".`);
		const next = tokens[pos];
		// IS NULL / IS NOT NULL
		if (next && typeof next !== 'string' && next.kind === 'kw' && next.value === 'is') {
			pos++;
			let negate = false;
			const after = tokens[pos];
			if (after && typeof after !== 'string' && after.kind === 'kw' && after.value === 'not') {
				negate = true;
				pos++;
			}
			const nul = tokens[pos++];
			if (!nul || typeof nul === 'string' || (nul as { value: unknown }).value !== 'null')
				throw new Error('Expected NULL after IS.');
			const v = row[a.value];
			const isNull = v === null || v === undefined;
			return negate ? !isNull : isNull;
		}
		// LIKE 'pattern'
		if (next && typeof next !== 'string' && next.kind === 'kw' && next.value === 'like') {
			pos++;
			const lit = tokens[pos++];
			if (!lit || typeof lit === 'string' || lit.kind !== 'str')
				throw new Error('LIKE expects a string pattern.');
			const re = new RegExp(
				'^' +
					lit.value
						.replace(/[.+^${}()|[\]\\]/g, '\\$&')
						.replace(/%/g, '.*')
						.replace(/_/g, '.') +
					'$',
				'i'
			);
			return re.test(String(row[a.value] ?? ''));
		}
		// comparison
		const op = tokens[pos++];
		if (!op || typeof op === 'string' || op.kind !== 'op')
			throw new Error(`Expected operator after "${a.value}".`);
		const rhs = tokens[pos++];
		if (!rhs) throw new Error('Expected value after operator.');
		const lv = row[a.value];
		const rv =
			typeof rhs !== 'string' && rhs.kind === 'id'
				? row[rhs.value]
				: typeof rhs !== 'string'
					? (rhs as { value: string | number }).value
					: undefined;
		switch (op.value) {
			case '=':
				return lv == rv;
			case '<>':
				return lv != rv;
			case '<':
				return (lv as number) < (rv as number);
			case '<=':
				return (lv as number) <= (rv as number);
			case '>':
				return (lv as number) > (rv as number);
			case '>=':
				return (lv as number) >= (rv as number);
		}
		return false;
	}
	return expr();
}

// ----- SQL syntax highlighting -----------------------------------------------

const SQL_KEYWORDS = [
	'select', 'from', 'where', 'and', 'or', 'not', 'is', 'null', 'like', 'order', 'by', 'asc', 'desc',
	'limit', 'distinct', 'group', 'having', 'as', 'on', 'join', 'inner', 'left', 'right', 'full', 'outer',
	'count', 'sum', 'avg', 'min', 'max', 'case', 'when', 'then', 'else', 'end', 'in', 'between'
];

export type HighlightToken = { cls: string; text: string };

export function highlightSQL(src: string): HighlightToken[] {
	const out: HighlightToken[] = [];
	let i = 0;
	const push = (cls: string, text: string) => out.push({ cls, text });
	while (i < src.length) {
		const c = src[i];
		// comment to EOL
		if (c === '-' && src[i + 1] === '-') {
			let j = i;
			while (j < src.length && src[j] !== '\n') j++;
			push('tok-com', src.slice(i, j));
			i = j;
			continue;
		}
		// string literal
		if (c === "'") {
			let j = i + 1;
			while (j < src.length && src[j] !== "'") j++;
			push('tok-str', src.slice(i, Math.min(j + 1, src.length)));
			i = j + 1;
			continue;
		}
		// number
		if (/[0-9]/.test(c)) {
			let j = i;
			while (j < src.length && /[0-9.]/.test(src[j])) j++;
			push('tok-num', src.slice(i, j));
			i = j;
			continue;
		}
		// word
		if (/[A-Za-z_]/.test(c)) {
			let j = i;
			while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
			const w = src.slice(i, j);
			const cls = SQL_KEYWORDS.includes(w.toLowerCase()) ? 'tok-kw' : 'tok-id';
			push(cls, w);
			i = j;
			continue;
		}
		// punctuation / operators
		if (/[(),;*=<>!+\-/%]/.test(c)) {
			push('tok-pun', c);
			i++;
			continue;
		}
		// whitespace / newline / anything else passes through
		push('tok-id', c);
		i++;
	}
	return out;
}
