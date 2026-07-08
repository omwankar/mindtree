import { getOpenRouterKey, loadSettings } from './settings'
import {
  isOpenRouterEnabled,
  OPENROUTER_BASE,
  OPENROUTER_WHISPER_MODEL,
  openRouterHeaders
} from './openrouter'
import {
  missingSttKeyMessage,
  resolveSttProvider,
  transcribeViaGroq,
  transcribeViaHuggingFace,
  transcribeViaOpenAI
} from './stt'
import type { TranscribeResult } from '@shared/types'

async function transcribeViaOpenRouter(audio: ArrayBuffer): Promise<TranscribeResult> {
  if (!getOpenRouterKey()) {
    return { text: '', error: 'Missing OpenRouter API key.' }
  }

  const base64 = Buffer.from(audio).toString('base64')
  const language = loadSettings().language?.trim()

  const body: Record<string, unknown> = {
    model: OPENROUTER_WHISPER_MODEL,
    input_audio: { data: base64, format: 'wav' }
  }
  if (language) body.language = language

  try {
    const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      const hint =
        res.status === 402
          ? ' OpenRouter audio requires $0.50+ balance — use Groq (free) for STT instead.'
          : ''
      return {
        text: '',
        error: `OpenRouter STT error ${res.status}: ${detail.slice(0, 280)}${hint}`
      }
    }

    const json = (await res.json()) as { text?: string }
    return { text: (json.text ?? '').trim() }
  } catch (err) {
    return { text: '', error: `Transcription failed: ${(err as Error).message}` }
  }
}

/**
 * Transcribes a WAV audio clip. Routes to the configured STT provider.
 * Free testing: set Groq or Hugging Face keys — auto mode prefers them over OpenRouter.
 */
export async function transcribeAudio(audio: ArrayBuffer): Promise<TranscribeResult> {
  const provider = resolveSttProvider()
  if (!provider) {
    return { text: '', error: missingSttKeyMessage() }
  }

  switch (provider) {
    case 'groq':
      return transcribeViaGroq(audio)
    case 'huggingface':
      return transcribeViaHuggingFace(audio)
    case 'openai':
      return transcribeViaOpenAI(audio)
    case 'openrouter':
      return transcribeViaOpenRouter(audio)
    default:
      return { text: '', error: missingSttKeyMessage() }
  }
}

export { isOpenRouterEnabled }
