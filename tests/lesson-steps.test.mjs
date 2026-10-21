// Prueft dass tests/lesson-steps.json aktuell ist (node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const JSON_PATH = join(ROOT, 'server', 'src', 'lesson-steps.json');
const SCRIPT_PATH = join(ROOT, 'tools', 'gen-lesson-steps.mjs');

test('lesson-steps.json hat Eintraege mit positiven Werten', () => {
	const data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
	const ids = Object.keys(data);
	assert.ok(ids.length > 0, 'lesson-steps.json ist leer');
	for (const [id, v] of Object.entries(data)) {
		assert.ok(v.exercise_steps > 0, `${id}.exercise_steps muss > 0 sein`);
		assert.ok(v.total_steps >= v.exercise_steps, `${id}.total_steps muss >= exercise_steps sein`);
	}
});

test('lesson-steps.json stimmt mit gen-lesson-steps.mjs ueberein', () => {
	const tmpPath = join(ROOT, 'server', 'src', 'lesson-steps.tmp.json');
	const origScript = readFileSync(SCRIPT_PATH, 'utf8');
	const tmpScript = origScript.replace(
		"join(ROOT, 'server', 'src', 'lesson-steps.json')",
		`'${tmpPath}'`
	);
	const tmpScriptPath = join(ROOT, 'tools', 'gen-lesson-steps.tmp.mjs');
	writeFileSync(tmpScriptPath, tmpScript);
	try {
		execFileSync(process.execPath, [
			'--experimental-strip-types',
			tmpScriptPath,
		], { cwd: ROOT });
		const current = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
		const fresh = JSON.parse(readFileSync(tmpPath, 'utf8'));
		assert.deepEqual(current, fresh, 'lesson-steps.json ist veraltet. Bitte `node tools/gen-lesson-steps.mjs` ausfuehren.');
	} finally {
		try { unlinkSync(tmpPath); } catch { /* ignore */ }
		try { unlinkSync(tmpScriptPath); } catch { /* ignore */ }
	}
});
