import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ActionItem, SessionExport, TranscriptSegment } from '@shared/types'

/**
 * Session storage.
 *
 * Primary backend is better-sqlite3 (a native module). Building native modules
 * can fail on some machines, so if it cannot be loaded we transparently fall
 * back to a JSON file. Either way the public API below is identical.
 */

interface StoreBackend {
  saveSession(id: string, data: SessionExport): void
  kind: 'sqlite' | 'json'
}

let backend: StoreBackend | null = null

function dataDir(): string {
  const dir = join(app.getPath('userData'), 'sessions')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function createSqliteBackend(): StoreBackend | null {
  try {
    // Lazy require so a missing/unbuilt native module doesn't crash the app.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3')
    const db = new Database(join(dataDir(), 'meetmind.db'))
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        context TEXT,
        data TEXT NOT NULL
      );
    `)
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO sessions (id, created_at, context, data) VALUES (?, ?, ?, ?)'
    )
    console.log('[store] using better-sqlite3 backend')
    return {
      kind: 'sqlite',
      saveSession(id, data) {
        stmt.run(id, Date.now(), data.context ?? '', JSON.stringify(data))
      }
    }
  } catch (err) {
    console.warn('[store] better-sqlite3 unavailable, falling back to JSON:', (err as Error).message)
    return null
  }
}

function createJsonBackend(): StoreBackend {
  console.log('[store] using JSON backend')
  return {
    kind: 'json',
    saveSession(id, data) {
      const file = join(dataDir(), `${id}.json`)
      writeFileSync(file, JSON.stringify({ id, createdAt: Date.now(), ...data }, null, 2), 'utf-8')
    }
  }
}

function getBackend(): StoreBackend {
  if (!backend) {
    backend = createSqliteBackend() ?? createJsonBackend()
  }
  return backend
}

export function saveSession(data: SessionExport): string {
  const id = `session-${formatStamp(new Date())}`
  getBackend().saveSession(id, data)
  return id
}

function formatStamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes()
  )}-${pad(d.getSeconds())}`
}

function renderMarkdown(data: SessionExport): string {
  const lines: string[] = []
  lines.push(`# MeetMind Session — ${new Date().toLocaleString()}`)
  lines.push('')
  if (data.context?.trim()) {
    lines.push('## Meeting Context')
    lines.push('')
    lines.push(data.context.trim())
    lines.push('')
  }
  lines.push('## Transcript')
  lines.push('')
  if (data.transcript.length) {
    data.transcript.forEach((seg: TranscriptSegment) => {
      const t = new Date(seg.timestamp).toLocaleTimeString()
      lines.push(`- **[${t}] ${seg.speaker}:** ${seg.text}`)
    })
  } else {
    lines.push('_No transcript captured._')
  }
  lines.push('')
  lines.push('## AI Suggestions')
  lines.push('')
  if (data.suggestions.length) {
    data.suggestions.forEach((s, i) => {
      lines.push(`### Suggestion ${i + 1}`)
      lines.push('')
      lines.push(s.trim())
      lines.push('')
    })
  } else {
    lines.push('_No suggestions generated._')
  }
  lines.push('## Action Items')
  lines.push('')
  if (data.actionItems.length) {
    data.actionItems.forEach((a: ActionItem) => {
      lines.push(`- [${a.done ? 'x' : ' '}] ${a.text}`)
    })
  } else {
    lines.push('_No action items._')
  }
  lines.push('')
  return lines.join('\n')
}

/** Writes the session to ~/Documents/MeetMind/session-[date].md and returns the path. */
export function exportMarkdown(data: SessionExport): string {
  const dir = join(app.getPath('documents'), 'MeetMind')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const file = join(dir, `session-${formatStamp(new Date())}.md`)
  writeFileSync(file, renderMarkdown(data), 'utf-8')
  return file
}

export function readMarkdown(path: string): string {
  return readFileSync(path, 'utf-8')
}
