// ----- Teacher dashboard mock data ------------------------------------------
// Ported from _design/project/src/teacher-data.jsx. Deterministic so the demo
// data is stable across renders.

export type LessonRef = {
	id: string;
	code: string;
	short: string;
	title: string;
};

export type Student = {
	id: string;
	name: string;
	joinedDaysAgo: number;
};

export type CellState = 'todo' | 'progress' | 'done';

export type CellProgress = {
	state: CellState;
	percent: number;
	currentStep: number;
	totalSteps: number;
	attempts: number;
	minutes: number;
	stuck: boolean;
};

export type ProgressGrid = Record<string, Record<string, CellProgress>>;

export type TeacherClass = {
	id: string;
	name: string;
	term: string;
	joinCode: string;
	students: Student[];
	activeThisWeek: number;
	progress: ProgressGrid;
	sparkline: number[];
	lessons: LessonRef[];
	createdDaysAgo: number;
};

export type StuckEntry = {
	student: Student;
	lesson: LessonRef;
	progress: CellProgress;
	minutesStuck: number;
};

// Lessons used across the matrix (subset of TRACKS, in the order they're taught)
export const TEACH_LESSONS: LessonRef[] = [
	{ id: 'select-basics', code: 'L01', short: 'SELECT', title: 'SELECT basics' },
	{ id: 'where', code: 'L02', short: 'WHERE', title: 'Filtering with WHERE' },
	{ id: 'order', code: 'L03', short: 'ORDER', title: 'ORDER BY & LIMIT' },
	{ id: 'distinct', code: 'L04', short: 'DISTINCT', title: 'DISTINCT values' },
	{ id: 'null', code: 'L05', short: 'NULL', title: 'Working with NULL' },
	{ id: 'count', code: 'L06', short: 'COUNT', title: 'COUNT, SUM, AVG' },
	{ id: 'group', code: 'L07', short: 'GROUP', title: 'GROUP BY & HAVING' },
	{ id: 'join', code: 'L08', short: 'JOIN', title: 'INNER JOIN' }
];

export const STEP_COUNTS: Record<string, number> = {
	'select-basics': 5,
	where: 5,
	order: 4,
	distinct: 3,
	null: 4,
	count: 5,
	group: 6,
	join: 6
};

// Deterministic PRNG so the demo data is stable across renders.
function mulberry32(seed: number): () => number {
	let s = seed;
	return function () {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const GERMAN_FIRST = [
	'Anna','Felix','Lina','Jonas','Sophie','Max','Mia','Paul','Emma','Tim',
	'Hannah','Luca','Leon','Marie','Ben','Klara','Noah','Lea','Finn','Greta',
	'Jakob','Helena','Niklas','Frieda','Erik','Pia','Theo','Ida','Moritz','Lotte'
];
const GERMAN_LAST = [
	'Becker','Müller','Schäfer','Weber','Klein','Hoffmann','Schulz','Wagner',
	'Bauer','Richter','König','Vogel','Schmidt','Fischer','Hartmann','Lehmann',
	'Schneider','Krüger','Werner','Krause','Sommer','Winter','Brandt','Albrecht'
];

function makeStudents(seed: number, n: number): Student[] {
	const rnd = mulberry32(seed);
	const used = new Set<string>();
	const out: Student[] = [];
	for (let i = 0; i < n; i++) {
		let nm: string;
		do {
			const f = GERMAN_FIRST[Math.floor(rnd() * GERMAN_FIRST.length)];
			const l = GERMAN_LAST[Math.floor(rnd() * GERMAN_LAST.length)];
			nm = f + ' ' + l;
		} while (used.has(nm));
		used.add(nm);
		out.push({
			id: 's' + (seed * 100 + i),
			name: nm,
			joinedDaysAgo: 4 + Math.floor(rnd() * 60)
		});
	}
	return out;
}

function makeProgress(seed: number, students: Student[], lessons: LessonRef[]): ProgressGrid {
	const rnd = mulberry32(seed * 31);
	const grid: ProgressGrid = {};
	students.forEach((stu) => {
		const ability = 0.25 + rnd() * 0.7;
		const speed = 0.4 + rnd() * 0.6;
		grid[stu.id] = {};
		lessons.forEach((les, li) => {
			const totalSteps = STEP_COUNTS[les.id] || 5;
			const reach = ability * lessons.length;
			let state: CellState;
			let percent: number;
			let currentStep: number;
			let attempts: number;
			let minutes: number;
			let stuck = false;
			if (li < Math.floor(reach) - 1) {
				state = 'done';
				percent = 1;
				currentStep = totalSteps;
				attempts = 1 + Math.floor(rnd() * 2);
				minutes = Math.round((4 + rnd() * 10) * speed);
			} else if (li === Math.floor(reach) - 1 || li === Math.floor(reach)) {
				state = 'progress';
				const stepProgress = Math.max(1, Math.floor(rnd() * (totalSteps + 1)));
				currentStep = stepProgress;
				percent = stepProgress / totalSteps;
				attempts = 1 + Math.floor(rnd() * 5);
				minutes = Math.round(stepProgress * (4 + rnd() * 6));
				if (
					li === Math.floor(reach) &&
					stepProgress >= Math.ceil(totalSteps * 0.6) &&
					rnd() > 0.55
				) {
					stuck = true;
				}
			} else {
				state = 'todo';
				percent = 0;
				currentStep = 0;
				attempts = 0;
				minutes = 0;
			}
			grid[stu.id][les.id] = {
				state,
				percent,
				currentStep,
				totalSteps,
				attempts,
				minutes,
				stuck
			};
		});
	});
	return grid;
}

function makeSparkline(seed: number, n = 14): number[] {
	const rnd = mulberry32(seed + 7);
	const out: number[] = [];
	let v = 4 + Math.floor(rnd() * 4);
	for (let i = 0; i < n; i++) {
		v = Math.max(0, v + Math.round((rnd() - 0.4) * 4));
		out.push(v);
	}
	return out;
}

// ---- The demo classes -------------------------------------------------------

const CLASS_9B_STUDENTS = makeStudents(11, 12);
const CLASS_9B_PROGRESS = makeProgress(11, CLASS_9B_STUDENTS, TEACH_LESSONS);

const CLASS_10A_STUDENTS = makeStudents(22, 8);
const CLASS_10A_PROGRESS = makeProgress(22, CLASS_10A_STUDENTS, TEACH_LESSONS.slice(0, 5));

const CLASS_LK_STUDENTS = makeStudents(33, 16);
const CLASS_LK_PROGRESS = makeProgress(33, CLASS_LK_STUDENTS, TEACH_LESSONS);

const CLASS_TINY_STUDENTS = makeStudents(44, 3);
const CLASS_TINY_PROGRESS = makeProgress(44, CLASS_TINY_STUDENTS, TEACH_LESSONS.slice(0, 5));

const CLASS_EMPTY_STUDENTS: Student[] = [];
const CLASS_EMPTY_PROGRESS: ProgressGrid = {};

export const CLASSES: TeacherClass[] = [
	{
		id: '9b',
		name: 'Informatik 9b',
		term: 'Schuljahr 2025/26 · 2. Halbjahr',
		joinCode: 'TURM-9B-42',
		students: CLASS_9B_STUDENTS,
		activeThisWeek: 9,
		progress: CLASS_9B_PROGRESS,
		sparkline: makeSparkline(11),
		lessons: TEACH_LESSONS,
		createdDaysAgo: 47
	},
	{
		id: '10a',
		name: 'Wahlpflicht Informatik 10a',
		term: 'Schuljahr 2025/26 · 2. Halbjahr',
		joinCode: 'WPF-10A-08',
		students: CLASS_10A_STUDENTS,
		activeThisWeek: 5,
		progress: CLASS_10A_PROGRESS,
		sparkline: makeSparkline(22),
		lessons: TEACH_LESSONS.slice(0, 5),
		createdDaysAgo: 19
	},
	{
		id: 'lk-12',
		name: 'Leistungskurs Informatik 12',
		term: 'Schuljahr 2025/26 · 2. Halbjahr',
		joinCode: 'LK12-Q4-X1',
		students: CLASS_LK_STUDENTS,
		activeThisWeek: 14,
		progress: CLASS_LK_PROGRESS,
		sparkline: makeSparkline(33),
		lessons: TEACH_LESSONS,
		createdDaysAgo: 110
	},
	{
		id: 'pilot',
		name: 'Pilot-Gruppe Informatik',
		term: 'Schuljahr 2025/26 · 2. Halbjahr',
		joinCode: 'PILO-T3-99',
		students: CLASS_TINY_STUDENTS,
		activeThisWeek: 3,
		progress: CLASS_TINY_PROGRESS,
		sparkline: makeSparkline(44, 14),
		lessons: TEACH_LESSONS.slice(0, 5),
		createdDaysAgo: 6
	},
	{
		id: 'ag',
		name: 'Informatik-AG (neu)',
		term: 'Schuljahr 2025/26 · 2. Halbjahr',
		joinCode: 'AGIF-N2-15',
		students: CLASS_EMPTY_STUDENTS,
		activeThisWeek: 0,
		progress: CLASS_EMPTY_PROGRESS,
		sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		lessons: TEACH_LESSONS.slice(0, 5),
		createdDaysAgo: 2
	}
];

export type Teacher = {
	greetingName: string;
	email: string;
	school: string;
	lastLoginIso: string;
};

export const TEACHER: Teacher = {
	greetingName: 'Frau Hartmann',
	email: 'r.hartmann@goethe-gym.de',
	school: 'Goethe-Gymnasium München',
	lastLoginIso: '2026-05-27T08:14:00'
};

// Helper: pull the currently-stuck students out of a class
export function getStuckStudents(cls: TeacherClass): StuckEntry[] {
	const stuck: StuckEntry[] = [];
	cls.students.forEach((stu) => {
		cls.lessons.forEach((les) => {
			const p = cls.progress[stu.id]?.[les.id];
			if (p && p.stuck) {
				stuck.push({
					student: stu,
					lesson: les,
					progress: p,
					minutesStuck: 12 + Math.floor((stu.id.charCodeAt(1) * 7) % 30)
				});
			}
		});
	});
	return stuck.slice(0, 5);
}

export function initials(name: string): string {
	return name
		.split(' ')
		.map((p) => p[0])
		.slice(0, 2)
		.join('');
}

// ---- Aufgaben (assignments) tracks -----------------------------------------

export type AufgabenLesson = { id: string; title: string; minutes: number };
export type AufgabenTrack = {
	id: 'beginner' | 'intermediate' | 'advanced';
	label: string;
	blurb: string;
	lessons: AufgabenLesson[];
};

export const AUFGABEN_TRACKS: AufgabenTrack[] = [
	{
		id: 'beginner',
		label: 'Anfänger',
		blurb: 'Grundlagen — Lesen und Filtern.',
		lessons: [
			{ id: 'select-basics', title: 'SELECT basics', minutes: 6 },
			{ id: 'where', title: 'Filtering with WHERE', minutes: 8 },
			{ id: 'order', title: 'ORDER BY & LIMIT', minutes: 5 },
			{ id: 'distinct', title: 'DISTINCT values', minutes: 4 },
			{ id: 'null', title: 'Working with NULL', minutes: 7 }
		]
	},
	{
		id: 'intermediate',
		label: 'Fortgeschritten',
		blurb: 'Aggregation, Gruppierung, Joins.',
		lessons: [
			{ id: 'count', title: 'COUNT, SUM, AVG', minutes: 9 },
			{ id: 'group', title: 'GROUP BY & HAVING', minutes: 11 },
			{ id: 'join', title: 'INNER JOIN', minutes: 12 },
			{ id: 'outer', title: 'LEFT / RIGHT JOIN', minutes: 14 },
			{ id: 'sub', title: 'Subqueries', minutes: 13 }
		]
	},
	{
		id: 'advanced',
		label: 'Profi',
		blurb: 'Reale Abfragen, Performance.',
		lessons: [
			{ id: 'cte', title: 'Common Table Expressions', minutes: 15 },
			{ id: 'window', title: 'Window Functions', minutes: 18 },
			{ id: 'indexes', title: 'Indexes & EXPLAIN', minutes: 16 },
			{ id: 'tx', title: 'Transaktionen', minutes: 12 }
		]
	}
];

// Compute a micro-stat for a given lesson within a class.
export function microStat(
	lessonId: string,
	cls: TeacherClass | undefined,
	enabled: boolean
): string | null {
	if (!enabled) return null;
	if (!cls || cls.students.length === 0) return 'noch nicht begonnen';
	const prog = cls.progress;
	let done = 0;
	let stuck = 0;
	for (const s of cls.students) {
		const p = prog[s.id]?.[lessonId];
		if (!p) continue;
		if (p.state === 'done') done++;
		if (p.stuck) stuck++;
	}
	if (stuck > 0) return `${stuck} ${stuck === 1 ? 'Person hängt' : 'Personen hängen'} fest`;
	if (done > 0) return `${done} von ${cls.students.length} abgeschlossen`;
	return 'noch nicht begonnen';
}

export function randomCode(): string {
	const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
	const part = (n: number) =>
		Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
	const num = String(Math.floor(Math.random() * 900) + 100);
	return `${part(4)}-${part(2)}${num.slice(0, 1)}-${num.slice(1)}`;
}
