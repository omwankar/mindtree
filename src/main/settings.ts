import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

let settingsPath = ''

/** In-memory cache — the settings file is only written by this process, so a
 *  single read at startup plus invalidation on save is always consistent. */
let cache: AppSettings | null = null

function getPath(): string {
  if (!settingsPath) {
    settingsPath = join(app.getPath('userData'), 'settings.json')
  }
  return settingsPath
}

export function loadSettings(): AppSettings {
  if (cache) return cache
  let loaded: AppSettings = { ...DEFAULT_SETTINGS }
  try {
    const path = getPath()
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, 'utf-8'))
      loaded = { ...DEFAULT_SETTINGS, ...parsed, screenWatchEnabled: true }
    }
  } catch (err) {
    console.error('[settings] failed to load:', err)
  }
  cache = loaded
  return loaded
}

export function saveSettings(settings: AppSettings): AppSettings {
  const merged: AppSettings = { ...DEFAULT_SETTINGS, ...settings }
  try {
    writeFileSync(getPath(), JSON.stringify(merged, null, 2), 'utf-8')
    cache = merged
  } catch (err) {
    console.error('[settings] failed to save:', err)
  }
  return merged
}

/** Settings take precedence over environment variables for API keys. */
function key(fromSettings: string, fromEnv: string | undefined): string {
  return (fromSettings || fromEnv || '').trim()
}

export function getOpenRouterKey(): string {
  return key(loadSettings().openRouterApiKey, process.env.OPENROUTER_API_KEY)
}

export function getOpenAIKey(): string {
  return key(loadSettings().openaiApiKey, process.env.OPENAI_API_KEY)
}

export function getAnthropicKey(): string {
  return key(loadSettings().anthropicApiKey, process.env.ANTHROPIC_API_KEY)
}

export function getGroqKey(): string {
  return key(loadSettings().groqApiKey, process.env.GROQ_API_KEY)
}

export function getHuggingfaceKey(): string {
  return key(loadSettings().huggingfaceApiKey, process.env.HUGGINGFACE_API_KEY)
}

export function getElevenLabsKey(): string {
  return key(loadSettings().elevenlabsApiKey, process.env.ELEVENLABS_API_KEY)
}
