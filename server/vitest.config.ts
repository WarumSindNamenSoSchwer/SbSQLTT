import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Jeder Test bekommt eine eigene In-Memory-DB
    isolate: true,
    pool: 'forks',
  },
})
