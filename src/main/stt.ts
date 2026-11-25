import {
  getGroqKey,
  getHuggingfaceKey,
  getOpenAIKey,
  getOpenRouterKey,
  loadSettings
} from './settings'
import type { SttProvider, TranscribeResult } from '@shared/types'

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
/** Turbo is ~2x faster on Groq with similar accuracy for meeting speech. */
const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo'
const GROQ_STT_PROMPT =
  'Data engineering job interview at Concentrix. Azure Data Factory, ADF, ADLS, Data Lake, Databricks, PySpark, Delta Lake, Microsoft Fabric, Dynamics 365, Dataverse, Power Platform, ETL, ELT, SQL, Python, REST API, Elasticsearch, Azure AI Search, Synapse, Event Hubs, data migration, reconciliation, English.'
const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'
const HF_WHISPER_URL =
  'https://api-inference.huggingface.co/models/openai/whisper-large-v3'

export function resolveSttProvider(): SttProvider | null {
  return getGroqKey() ? 'groq' : null
}

function whisperForm(audio: ArrayBuffer, model: string, withPrompt = false): FormData {
  const form = new FormData()
  form.append('file', new Blob([audio], { type: 'audio/wav' }), 'speech.wav')
  form.append('model', model)
  form.append('response_format', 'json')
  form.append('temperature', '0')
  const language = loadSettings().language?.trim()
  if (language) form.append('language', language)
  if (withPrompt) form.append('prompt', GROQ_STT_PROMPT)
  return form
}

/** Groq — free tier, OpenAI-compatible Whisper API. */
export async function transcribeViaGroq(audio: ArrayBuffer): Promise<TranscribeResult> {
  const key = getGroqKey()
  if (!key) {
    return { text: '', error: 'Missing Groq API key. Get a free key at console.groq.com' }
  }

  const attempt = async (model: string): Promise<TranscribeResult> => {
    try {
      const res = await fetch(GROQ_WHISPER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: whisperForm(audio, model, true)
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return { text: '', error: `Groq STT error ${res.status}: ${detail.slice(0, 300)}` }
      }
      const json = (await res.json()) as { text?: string }
      return { text: (json.text ?? '').trim() }
    } catch (err) {
      return { text: '', error: `Groq transcription failed: ${(err as Error).message}` }
    }
  }

  const turbo = await attempt(GROQ_WHISPER_MODEL)
  if (turbo.text || !turbo.error?.includes('400')) return turbo
  return attempt('whisper-large-v3')
}

/** Hugging Face Inference API — free tier with rate limits. */
export async function transcribeViaHuggingFace(audio: ArrayBuffer): Promise<TranscribeResult> {
  const key = getHuggingfaceKey()
  if (!key) {
    return {
      text: '',
      error: 'Missing Hugging Face token. Get a free token at huggingface.co/settings/tokens'
    }
  }

  try {
    const res = await fetch(HF_WHISPER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'audio/wav',
        'x-wait-for-model': 'true'
      },
      body: Buffer.from(audio)
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { text: '', error: `Hugging Face STT error ${res.status}: ${detail.slice(0, 300)}` }
    }
    const json = (await res.json()) as { text?: string; error?: string }
    if (json.error) {
      return { text: '', error: `Hugging Face: ${json.error}` }
    }
    return { text: (json.text ?? '').trim() }
  } catch (err) {
    return { text: '', error: `Hugging Face transcription failed: ${(err as Error).message}` }
  }
}

/** OpenAI Whisper — paid. */
export async function transcribeViaOpenAI(audio: ArrayBuffer): Promise<TranscribeResult> {
  const key = getOpenAIKey()
  if (!key) {
    return { text: '', error: 'Missing OpenAI API key.' }
  }

  try {
    const res = await fetch(OPENAI_WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: whisperForm(audio, 'whisper-1')
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { text: '', error: `Whisper API error ${res.status}: ${detail.slice(0, 300)}` }
    }
    const json = (await res.json()) as { text?: string }
    return { text: (json.text ?? '').trim() }
  } catch (err) {
    return { text: '', error: `Transcription failed: ${(err as Error).message}` }
  }
}

export function sttProviderLabel(provider: SttProvider): string {
  switch (provider) {
    case 'groq':
      return 'Groq (free)'
    case 'huggingface':
      return 'Hugging Face (free)'
    case 'openai':
      return 'OpenAI'
    case 'openrouter':
      return 'OpenRouter (paid audio)'
    case 'auto':
      return 'Auto'
    default:
      return provider
  }
}

export function missingSttKeyMessage(): string {
  return 'Add a Groq API key in Settings (console.groq.com) for speech-to-text.'
}
