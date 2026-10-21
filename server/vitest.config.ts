import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    // Vertragstest importiert die echten Frontend-Clients (src/lib/tabula/api.ts, quiz-api.ts)
    alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Jeder Test bekommt eine eigene In-Memory-DB
    isolate: true,
    pool: 'forks',
    // Höchstens 2 Prozesse: Argon2 braucht je Hash 19 MiB, viele parallele Forks legen den Rechner lahm
    poolOptions: { forks: { maxForks: 2, minForks: 1 } },
    // Keine Watch-Prozesse im Hintergrund zurücklassen
    watch: false,
  },
})
