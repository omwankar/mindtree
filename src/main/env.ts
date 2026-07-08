import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/** Load `.env` from the project root into `process.env` (no overwrite). */
export function loadProjectEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(__dirname, '../../.env'),
    join(__dirname, '../../../.env')
  ]
  const path = candidates.find((p) => existsSync(p))
  if (!path) return

  try {
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch (err) {
    console.warn('[env] could not load .env:', err)
  }
}
