import { defineConfig } from 'vitest/config'

export default defineConfig({
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
