import { getGroqKey } from './settings'

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** Llama 4 Scout — free tier, native vision (up to 5 images), ~750 tok/s. */
export const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
/** Strong free text model for chat/suggestions. */
export const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile'

export function isGroqChatEnabled(): boolean {
  return Boolean(getGroqKey())
}

export function groqHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getGroqKey()}`,
    'Content-Type': 'application/json'
  }
}
