// Bündelt das Browser-Kryptomodul (src/lib/tabula/crypto.ts samt hash-wasm) in eine einzelne
// ESM-Datei, damit der Abnahmelauf auf dem Server genau dieselbe Kryptografie wie der Browser nutzt.
// Aufruf: node tools/bundle-crypto.mjs <ausgabeordner>
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

const out = process.argv[2]
if (!out) throw new Error('Ausgabeordner fehlt')
await build({
	configFile: false,
	logLevel: 'warn',
	build: {
		lib: { entry: fileURLToPath(new URL('../src/lib/tabula/crypto.ts', import.meta.url)), formats: ['es'], fileName: () => 'crypto.mjs' },
		outDir: out,
		emptyOutDir: false,
		minify: false,
		target: 'node22',
	},
})
console.log(`${out}/crypto.mjs`)
