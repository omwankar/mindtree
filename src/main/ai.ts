import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicKey, getGroqKey, getOpenRouterKey } from './settings'
import {
  isOpenRouterEnabled,
  OPENROUTER_BASE,
  OPENROUTER_CHAT_MODEL,
  OPENROUTER_VISION_MODEL,
  openRouterHeaders,
  readChatStream
} from './openrouter'
import {
  GROQ_CHAT_MODEL,
  GROQ_CHAT_URL,
  GROQ_VISION_MODEL,
  groqHeaders,
  isGroqChatEnabled
} from './groq'
import {
  ACTION_ITEM_SYSTEM_PROMPT,
  buildActionItemUserPrompt,
  buildModeUserPrompt,
  systemPromptForMode
} from '@shared/prompts'
import { loadSettings } from './settings'
import type { AiProvider, SuggestionRequest } from '@shared/types'

const MODEL = 'claude-sonnet-4-20250514'

function hasAnyAiKey(): boolean {
  return Boolean(getOpenRouterKey() || getAnthropicKey() || getGroqKey())
}

function anthropicClient(): Anthropic {
  const apiKey = getAnthropicKey()
  if (!apiKey) {
    throw new Error('Missing Anthropic API key. Add it in Settings.')
  }
  return new Anthropic({ apiKey })
}

interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (fullText: string) => void
  onError: (message: string) => void
}

function userPrompt(req: SuggestionRequest): string {
  const mode = req.mode ?? 'assist'
  return buildModeUserPrompt(mode, req.context, req.recentTranscript, req.question)
}

/** Screen answers can be full code solutions — give them more room. */
function maxTokensFor(req: SuggestionRequest): number {
  if (req.mode === 'screen' || req.mode === 'review') return 2048
  if (req.mode === 'meeting' || req.mode === 'custom') return 1024
  return 512
}

function openRouterUserContent(req: SuggestionRequest): unknown {
  const text = userPrompt(req)
  if (!req.screenImageBase64) return text
  return [
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${req.screenImageBase64}` }
    },
    { type: 'text', text }
  ]
}

function anthropicUserContent(req: SuggestionRequest): Anthropic.MessageParam['content'] {
  const text = userPrompt(req)
  if (!req.screenImageBase64) return text
  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: req.screenImageBase64
      }
    },
    { type: 'text', text }
  ]
}

/** Groq — free tier, OpenAI-compatible. Llama 4 Scout handles screenshots. */
async function streamViaGroq(req: SuggestionRequest, cb: StreamCallbacks): Promise<void> {
  const mode = req.mode ?? 'assist'
  const system = systemPromptForMode(mode)
  const model = req.screenImageBase64 ? GROQ_VISION_MODEL : GROQ_CHAT_MODEL

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: groqHeaders(),
      body: JSON.stringify({
        model,
        max_completion_tokens: maxTokensFor(req),
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: openRouterUserContent(req) }
        ]
      })
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      cb.onError(`Groq error ${res.status}: ${detail.slice(0, 300)}`)
      return
    }

    const full = await readChatStream(res.body, cb.onToken)
    cb.onDone(full)
  } catch (err) {
    cb.onError(`Groq request failed: ${(err as Error).message}`)
  }
}

async function streamViaOpenRouter(
  req: SuggestionRequest,
  cb: StreamCallbacks
): Promise<void> {
  const mode = req.mode ?? 'assist'
  const system = systemPromptForMode(mode)
  const primaryModel = req.screenImageBase64 ? OPENROUTER_VISION_MODEL : OPENROUTER_CHAT_MODEL

  const request = (model: string): Promise<Response> =>
    fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model,
        max_tokens: maxTokensFor(req),
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: openRouterUserContent(req) }
        ]
      })
    })

  try {
    let res = await request(primaryModel)

    // Vision model slug invalid/retired? Retry once with the chat model,
    // which also accepts images (Claude Sonnet).
    if (
      !res.ok &&
      primaryModel !== OPENROUTER_CHAT_MODEL &&
      (res.status === 400 || res.status === 404)
    ) {
      console.warn(`[ai] vision model ${primaryModel} rejected (${res.status}), falling back`)
      res = await request(OPENROUTER_CHAT_MODEL)
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      cb.onError(`OpenRouter error ${res.status}: ${detail.slice(0, 300)}`)
      return
    }

    const full = await readChatStream(res.body, cb.onToken)
    cb.onDone(full)
  } catch (err) {
    cb.onError(`OpenRouter request failed: ${(err as Error).message}`)
  }
}

async function streamViaAnthropic(req: SuggestionRequest, cb: StreamCallbacks): Promise<void> {
  let anthropic: Anthropic
  try {
    anthropic = anthropicClient()
  } catch (err) {
    cb.onError((err as Error).message)
    return
  }

  const mode = req.mode ?? 'assist'
  let full = ''
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokensFor(req),
      system: systemPromptForMode(mode),
      messages: [
        {
          role: 'user',
          content: anthropicUserContent(req)
        }
      ]
    })

    stream.on('text', (text: string) => {
      full += text
      cb.onToken(text)
    })

    await stream.finalMessage()
    cb.onDone(full)
  } catch (err) {
    cb.onError(`Claude request failed: ${(err as Error).message}`)
  }
}

/** Picks the AI backend: explicit setting first, then free providers in auto mode. */
function resolveAiProvider(): AiProvider | null {
  const { aiProvider } = loadSettings()
  if (aiProvider === 'groq') return isGroqChatEnabled() ? 'groq' : null
  if (aiProvider === 'openrouter') return isOpenRouterEnabled() ? 'openrouter' : null
  if (aiProvider === 'anthropic') return getAnthropicKey() ? 'anthropic' : null

  if (isGroqChatEnabled()) return 'groq'
  if (isOpenRouterEnabled()) return 'openrouter'
  if (getAnthropicKey()) return 'anthropic'
  return null
}

/** Streams a meeting suggestion, emitting tokens as they arrive. */
export async function streamSuggestion(
  req: SuggestionRequest,
  cb: StreamCallbacks
): Promise<void> {
  const provider = resolveAiProvider()
  if (!provider) {
    cb.onError(
      'No usable AI key. Add a Groq (free), OpenRouter, or Anthropic key in Settings — ' +
        'or set AI provider to Auto.'
    )
    return
  }

  switch (provider) {
    case 'groq':
      return streamViaGroq(req, cb)
    case 'openrouter':
      return streamViaOpenRouter(req, cb)
    default:
      return streamViaAnthropic(req, cb)
  }
}

/** Action-item extraction over any OpenAI-compatible endpoint (Groq/OpenRouter). */
async function extractViaOpenAiCompatible(
  url: string,
  headers: Record<string, string>,
  model: string,
  text: string
): Promise<string[]> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [
          { role: 'system', content: ACTION_ITEM_SYSTEM_PROMPT },
          { role: 'user', content: buildActionItemUserPrompt(text) }
        ]
      })
    })

    if (!res.ok) return []

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = json.choices?.[0]?.message?.content?.trim() ?? ''
    return parseJsonArray(raw)
  } catch (err) {
    console.error('[ai] action item extraction failed:', (err as Error).message)
    return []
  }
}

/** Extracts concrete action items from arbitrary meeting text. */
export async function extractActionItems(text: string): Promise<string[]> {
  if (!text.trim() || !hasAnyAiKey()) return []

  const provider = resolveAiProvider()
  if (provider === 'groq') {
    return extractViaOpenAiCompatible(GROQ_CHAT_URL, groqHeaders(), GROQ_CHAT_MODEL, text)
  }
  if (provider === 'openrouter') {
    return extractViaOpenAiCompatible(
      `${OPENROUTER_BASE}/chat/completions`,
      openRouterHeaders(),
      OPENROUTER_CHAT_MODEL,
      text
    )
  }

  let anthropic: Anthropic
  try {
    anthropic = anthropicClient()
  } catch {
    return []
  }

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: ACTION_ITEM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildActionItemUserPrompt(text) }]
    })

    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    return parseJsonArray(raw)
  } catch (err) {
    console.error('[ai] action item extraction failed:', (err as Error).message)
    return []
  }
}

function parseJsonArray(raw: string): string[] {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return []
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean)
    }
  } catch {
    /* ignore */
  }
  return []
}
