import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistMode } from '@shared/types'

/** Keep export/history memory bounded during long sessions. */
const MAX_HISTORY = 100

interface UseAIAnswerResult {
  /** The text currently being / last streamed. */
  answer: string
  streaming: boolean
  error: string | null
  /** Completed suggestions in order (used for export). */
  history: string[]
  /** Kicks off a streamed suggestion. Resolves with the full text when done. */
  generate: (
    context: string,
    recentTranscript: string[],
    mode?: AssistMode,
    question?: string,
    screenImageBase64?: string
  ) => Promise<string>
  clear: () => void
  /** Show a completed answer without starting a new stream (e.g. screen watch). */
  presentAnswer: (text: string) => void
}

function makeRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAIAnswer(): UseAIAnswerResult {
  const [answer, setAnswer] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const activeRequest = useRef<string | null>(null)
  const resolverRef = useRef<((text: string) => void) | null>(null)

  // Token batching: accumulate in a ref and flush once per animation frame so
  // a 500-token stream costs ~30 renders instead of 500.
  const pendingRef = useRef('')
  const rafRef = useRef(0)

  const flushTokens = useCallback(() => {
    rafRef.current = 0
    if (!pendingRef.current) return
    const chunk = pendingRef.current
    pendingRef.current = ''
    setAnswer((prev) => prev + chunk)
  }, [])

  useEffect(() => {
    const offToken = window.api.onSuggestionToken(({ requestId, token }) => {
      if (requestId !== activeRequest.current) return
      pendingRef.current += token
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(flushTokens)
      }
    })
    const offDone = window.api.onSuggestionDone(({ requestId, fullText }) => {
      if (requestId !== activeRequest.current) return
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      pendingRef.current = ''
      setStreaming(false)
      setAnswer(fullText)
      setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), fullText])
      activeRequest.current = null
      resolverRef.current?.(fullText)
      resolverRef.current = null
    })
    const offError = window.api.onSuggestionError(({ requestId, message }) => {
      if (requestId !== activeRequest.current) return
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      pendingRef.current = ''
      setStreaming(false)
      setError(message)
      activeRequest.current = null
      resolverRef.current?.('')
      resolverRef.current = null
    })
    return () => {
      offToken()
      offDone()
      offError()
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [flushTokens])

  const generate = useCallback(
    (
      context: string,
      recentTranscript: string[],
      mode: AssistMode = 'assist',
      question?: string,
      screenImageBase64?: string
    ): Promise<string> => {
      // Superseding an in-flight request: settle its promise so callers
      // awaiting it don't hang forever.
      resolverRef.current?.('')
      resolverRef.current = null

      const requestId = makeRequestId()
      activeRequest.current = requestId
      pendingRef.current = ''
      setAnswer('')
      setError(null)
      setStreaming(true)
      window.api.startSuggestion({
        requestId,
        context,
        recentTranscript,
        mode,
        question,
        screenImageBase64
      })
      return new Promise<string>((resolve) => {
        resolverRef.current = resolve
      })
    },
    []
  )

  const clear = useCallback(() => {
    setAnswer('')
    setError(null)
    setHistory([])
  }, [])

  const presentAnswer = useCallback((text: string) => {
    setAnswer(text)
    setError(null)
    setStreaming(false)
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), text])
  }, [])

  return { answer, streaming, error, history, generate, clear, presentAnswer }
}
