// Prüft Nutzungsbedingungen und Datenschutzerklärung auf Belege: jeder Absatz hat Quellen-IDs,
// jede ID existiert, jede Quelle wird genutzt, die Protokolldatei nennt jede ID, keine Gedankenstriche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const [name, mod, protocol] of [
	['Nutzungsbedingungen', '../src/lib/tabula/terms.ts', 'docs/NUTZUNGSBEDINGUNGEN-QUELLEN.md'],
	['Datenschutzerklärung', '../src/lib/tabula/privacy.ts', null]
]) {
	const { SECTIONS, SOURCES } = await import(mod);
	const ids = new Set(SOURCES.map((s) => s.id));
	const used = new Set();

	test(`${name}: jeder Absatz hat Quellen, alle IDs existieren`, () => {
		for (const s of SECTIONS)
			for (const b of s.blocks) {
				assert.ok(b.src.length > 0, `${s.id}: Absatz ohne Quelle: ${(b.p || b.list?.[0] || '').slice(0, 60)}`);
				for (const id of b.src) {
					assert.ok(ids.has(id), `${s.id}: unbekannte Quelle ${id}`);
					used.add(id);
				}
			}
	});

	test(`${name}: Quellen-IDs eindeutig`, () => {
		assert.equal(ids.size, SOURCES.length);
	});

	if (protocol) {
		test(`${name}: jede Quelle wird genutzt und steht im Protokoll`, () => {
			const unused = [...ids].filter((id) => !used.has(id));
			assert.deepEqual(unused, [], `ungenutzte Quellen: ${unused.join(', ')}`);
			const doc = readFileSync(new URL(`../${protocol}`, import.meta.url), 'utf8');
			const missing = [...ids].filter((id) => !new RegExp(`\\b${id}\\b`).test(doc));
			assert.deepEqual(missing, [], `fehlen im Protokoll: ${missing.join(', ')}`);
		});

		test(`${name}: keine Gedankenstriche, kein Semikolon als Ersatz`, () => {
			for (const s of SECTIONS)
				for (const t of [s.title, ...s.blocks.flatMap((b) => [b.p || '', ...(b.list || [])])]) {
					assert.ok(!/ [–—] |[–—]/.test(t), `Gedankenstrich in: ${t.slice(0, 60)}`);
					assert.ok(!/; /.test(t), `Semikolon in: ${t.slice(0, 60)}`);
				}
		});
	}
}
