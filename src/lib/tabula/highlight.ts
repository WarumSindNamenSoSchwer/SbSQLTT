// SQL-Einfärbung wie im Design v12: Schlüsselwörter blau, Zahlen orange, Text in Textfarbe.
// Farben über CSS-Variablen (--tok-kw, --tok-num, --tok-str, --tok-op), damit hell und dunkel stimmen.
// Die Fallbacks sind die Werte für dunkle Code-Flächen (Quiz-Beamer, Editor im Dunkelmodus).
const KW = /^(SELECT|FROM|WHERE|ORDER|BY|AND|OR|NOT|ASC|DESC|JOIN|LEFT|INNER|ON|LIMIT|AS|GROUP|HAVING|DISTINCT|IN|LIKE|IS|NULL|BETWEEN|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|PRIMARY|KEY|REFERENCES|COUNT|SUM|AVG|MIN|MAX)$/i;

export type Tok = { t: string; c: string };

export function tok(line: string): Tok[] {
	return (line.match(/\s+|'[^']*'?|\d+|[A-Za-z_][\w.]*|[<>=!]+|./g) || []).map((t) => ({
		t,
		c: KW.test(t)
			? 'var(--tok-kw, #60a5fa)'
			: /^\d+$/.test(t)
				? 'var(--tok-num, #fdba74)'
				: /^'/.test(t)
					? 'var(--tok-str, #86efac)'
					: /^[A-Za-z_]/.test(t)
						? 'var(--tok-id, #e2e8f0)'
						: 'var(--tok-op, #94a3b8)'
	}));
}
