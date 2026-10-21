import type { Result } from '../sql.ts';

export type Exercise = {
	kind: 'exercise';
	name: string;
	type: 'Übung';
	task: string;
	taskSub: string;
	starter: string;
	solution: string;
	ordered: boolean;
	/** Pruefabfrage nach der Schueler-Abfrage (fuer CREATE/INSERT). Ohne: Ergebnis wird direkt verglichen. */
	check?: string;
	okMsg: string;
	okSub: string;
	tip: string;
	/** Typischer Fehler. Der Test stellt sicher, dass er abgelehnt wird. */
	wrong: string;
};

export type Step =
	| { kind: 'explain'; name: string; type: 'Erklärung'; title: string; paras: string[]; example: string }
	| {
			kind: 'example';
			name: string;
			type: 'Beispiel';
			task: string;
			taskSub: string;
			code: string;
			msg: (r: Result, total: number) => string;
			sub: string;
	  }
	| Exercise
	| { kind: 'summary'; name: string; type: 'Zusammenfassung'; title: string; points: string[]; real: string };

export type Lesson = {
	id: string;
	track: string;
	trackLabel: string;
	no: number;
	of: number;
	title: string;
	db: { name: string; seed: string; mainTable: string };
	steps: Step[];
	done: { sub: string; points: string[] };
	next?: { id: string; title: string };
};

type ExOpts = { starter?: string; check?: string; ordered?: boolean };

/** Kurzform fuer eine Uebung. Sortierung zaehlt, sobald die Musterloesung ORDER BY enthaelt. */
export function ex(name: string, task: string, taskSub: string, solution: string, okSub: string, tip: string, wrong: string, o: ExOpts = {}): Exercise {
	return {
		kind: 'exercise',
		name,
		type: 'Übung',
		task,
		taskSub,
		starter: o.starter ?? '',
		solution,
		ordered: o.ordered ?? /ORDER BY/i.test(solution.replace(/\([^()]*\)/g, '')),
		check: o.check,
		okMsg: 'Richtig!',
		okSub,
		tip,
		wrong
	};
}

export function explain(name: string, paras: string[], example: string): Step {
	return { kind: 'explain', name, type: 'Erklärung', title: name, paras, example };
}

export function summary(points: string[], real: string): Step {
	return { kind: 'summary', name: 'Fazit', type: 'Zusammenfassung', title: 'Das hast du gelernt', points, real };
}
