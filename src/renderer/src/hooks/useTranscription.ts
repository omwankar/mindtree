import { useCallback, useRef, useState } from 'react'
import { float32ToWav } from '@/lib/audioCapture'
import { isLikelyHallucination, normalizeAudio } from '@/lib/speechUtils'
import type { Speaker, TranscriptSegment } from '@shared/types'

let counter = 0
function nextId(): string {
  counter += 1
  return `seg-${Date.now()}-${counter}`
}

/** Keep long sessions bounded — only recent segments matter for suggestions. */
const MAX_SEGMENTS = 500
/** Skip clips shorter than this — Whisper hallucinates on tiny buffers. */
const MIN_SAMPLES = 16000 * 0.35

interface UseTranscriptionResult {
  segments: TranscriptSegment[]
  transcribing: boolean
  /** Number of STT requests currently in flight. */
  pendingCount: number
  error: string | null
  transcribeSegment: (audio: Float32Array, speaker?: Speaker) => Promise<string | null>
  recentLines: (n?: number) => string[]
  /** Interviewer / meeting audio only — excludes user's mic. */
  recentInterviewerLines: (n?: number) => string[]
  clear: () => void
}

export function useTranscription(): UseTranscriptionResult {
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [transcribing, setTranscribing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const inflightRef = useRef(0)

  const transcribeSegment = useCallback(
    async (audio: Float32Array, speaker: Speaker = 'You'): Promise<string | null> => {
      if (audio.length < MIN_SAMPLES) return null

      inflightRef.current += 1
      setPendingCount(inflightRef.current)
      setTranscribing(true)
      setError(null)

      try {
        const normalized = normalizeAudio(audio)
        const wav = float32ToWav(normalized)
        const result = await window.api.transcribe(wav)
        if (result.error) {
          setError(result.error)
          return null
        }
        const text = result.text.trim()
        if (!text || isLikelyHallucination(text)) return null

        const segment: TranscriptSegment = {
          id: nextId(),
          speaker,
          text,
          timestamp: Date.now()
        }
        segmentsRef.current = [...segmentsRef.current.slice(-(MAX_SEGMENTS - 1)), segment]
        setSegments(segmentsRef.current)
        return text
      } catch (err) {
        setError((err as Error).message)
        return null
      } finally {
        inflightRef.current = Math.max(0, inflightRef.current - 1)
        setPendingCount(inflightRef.current)
        if (inflightRef.current === 0) setTranscribing(false)
      }
    },
    []
  )

  const recentLines = useCallback((n = 5): string[] => {
    return segmentsRef.current
      .slice(-n)
      .map((s) => `${s.speaker === 'You' ? 'You' : 'Interviewer'}: ${s.text}`)
  }, [])

  const recentInterviewerLines = useCallback((n = 8): string[] => {
    return segmentsRef.current
      .filter((s) => s.speaker === 'Others')
      .slice(-n)
      .map((s) => `Interviewer: ${s.text}`)
  }, [])

  const clear = useCallback(() => {
    segmentsRef.current = []
    setSegments([])
    setError(null)
  }, [])

  return { segments, transcribing, pendingCount, error, transcribeSegment, recentLines, recentInterviewerLines, clear }
}
