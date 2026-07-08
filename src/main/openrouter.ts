import { getOpenRouterKey } from './settings'

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export const OPENROUTER_WHISPER_MODEL = 'openai/whisper-large-v3'
export const OPENROUTER_CHAT_MODEL = 'anthropic/claude-sonnet-4'
export const OPENROUTER_VISION_MODEL = 'google/gemini-2.5-flash'

export function isOpenRouterEnabled(): boolean {
  return Boolean(getOpenRouterKey())
}

export function openRouterHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getOpenRouterKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/meetmind',
    'X-OpenRouter-Title': 'MeetMind'
  }
}

/** Parse OpenRouter / OpenAI-style SSE chat completion stream. */
export async function readChatStream(
  body: ReadableStream<Uint8Array> | null,
  onToken: (token: string) => void
): Promise<string> {
  if (!body) throw new Error('Empty response stream')

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue

      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[]
        }
        const token = json.choices?.[0]?.delta?.content ?? ''
        if (token) {
          full += token
          onToken(token)
        }
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }

  return full
}
