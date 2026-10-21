/**
 * Prueft dass server/src/lesson-steps.json aktuell ist.
 * Bei Aenderungen an Kursdateien muss `node tools/gen-lesson-steps.mjs` neu ausgefuehrt werden.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const JSON_PATH = join(__dirname, '..', 'src', 'lesson-steps.json')

describe('lesson-steps.json', () => {
  it('ist vorhanden und hat Eintraege', () => {
    const _req = createRequire(import.meta.url)
    const steps = _req(JSON_PATH) as Record<string, { exercise_steps: number; total_steps: number }>
    expect(Object.keys(steps).length).toBeGreaterThan(0)
    // Jeder Eintrag hat positive Werte
    for (const [id, v] of Object.entries(steps)) {
      expect(v.exercise_steps, `${id}.exercise_steps`).toBeGreaterThan(0)
      expect(v.total_steps, `${id}.total_steps`).toBeGreaterThanOrEqual(v.exercise_steps)
    }
  })

  it('stimmt mit den Kursdateien ueberein (gen-lesson-steps.mjs Ausgabe)', async () => {
    // Script neu ausfuehren und Ausgabe vergleichen
    const scriptPath = join(ROOT, 'tools', 'gen-lesson-steps.mjs')
    // Schreibe in temporaere Datei um die persistente nicht zu ueberschreiben
    const tmpPath = join(ROOT, 'server', 'src', 'lesson-steps.tmp.json')

    // Originalscript lesen und tmp-Pfad einsetzen
    const origScript = readFileSync(scriptPath, 'utf8')
    const tmpScript = origScript.replace(
      "join(ROOT, 'server', 'src', 'lesson-steps.json')",
      `'${tmpPath}'`
    )

    const tmpScriptPath = join(ROOT, 'tools', 'gen-lesson-steps.tmp.mjs')
    const { writeFileSync, unlinkSync } = await import('node:fs')
    writeFileSync(tmpScriptPath, tmpScript)
    try {
      execFileSync(process.execPath, [
        '--experimental-strip-types',
        tmpScriptPath,
      ], { cwd: ROOT })

      const _req = createRequire(import.meta.url)
      // Cache umgehen
      delete _req.cache[_req.resolve(JSON_PATH)]
      delete _req.cache[_req.resolve(tmpPath)]

      const current = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
      const fresh = JSON.parse(readFileSync(tmpPath, 'utf8'))

      expect(current, 'lesson-steps.json ist veraltet. Bitte `node tools/gen-lesson-steps.mjs` ausfuehren.').toEqual(fresh)
    } finally {
      try { unlinkSync(tmpPath) } catch { /* ignore */ }
      try { unlinkSync(tmpScriptPath) } catch { /* ignore */ }
    }
  })
})
