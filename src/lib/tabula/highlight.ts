// SQL-Einfaerbung exakt wie im Design (Lektion B2).
const KW = /^(SELECT|FROM|WHERE|ORDER|BY|AND|OR|NOT|ASC|DESC|JOIN|LEFT|INNER|ON|LIMIT|AS|GROUP|HAVING|DISTINCT|IN|LIKE|IS|NULL|BETWEEN|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|PRIMARY|KEY|REFERENCES|COUNT|SUM|AVG|MIN|MAX)$/i;

export type Tok = { t: string; c: string };

export function tok(line: string): Tok[] {
	return (line.match(/\s+|'[^']*'?|\d+|[A-Za-z_][\w.]*|[<>=!]+|./g) || []).map((t) => ({
		t,
		c: KW.test(t) ? '#60a5fa' : /^\d+$/.test(t) ? '#fdba74' : /^'/.test(t) ? '#86efac' : /^[A-Za-z_]/.test(t) ? '#e2e8f0' : '#94a3b8'
	}));
}
