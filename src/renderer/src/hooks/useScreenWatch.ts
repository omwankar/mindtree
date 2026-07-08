import { useCallback, useEffect, useRef, useState } from 'react'
import { NO_QUESTION_SENTINEL } from '@shared/types'

const MIN_INTERVAL_SEC = 1.5
const POLL_AFTER_ANSWER_MS = 1000
const FIRST_SCAN_MS = 400

interface UseScreenWatchOptions {
  enabled: boolean
  intervalSec: number
  /** Skip new captures while an AI response is streaming. */
  aiBusy: boolean
  /** Capture screen + run vision (same path as the Scan button). */
  onScan: (imageBase64: string) => Promise<string>
  onAnswer: () => void
  onStatus?: (status: string) => void
  onError?: (message: string) => void
}

interface UseScreenWatchResult {
  watching: boolean
  lastScanAt: number | null
  status: string
  /** Clear lock so the current screen can be scanned again (manual rescan). */
  resetAnswerLock: () => void
}

/** Cheap sampled hash so unchanged screens skip the (expensive) vision call. */
function fingerprint(base64: string): string {
  const len = base64.length
  let hash = 0
  const step = Math.max(1, Math.floor(len / 3000))
  for (let i = 0; i < len; i += step) {
    hash = (hash * 31 + base64.charCodeAt(i)) | 0
  }
  return `${len}:${hash}`
}

function isNoQuestion(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t === NO_QUESTION_SENTINEL) return true
  return /^no[_\s-]?question\.?$/i.test(t)
}

export function useScreenWatch({
  enabled,
  intervalSec,
  aiBusy,
  onScan,
  onAnswer,
  onStatus,
  onError
}: UseScreenWatchOptions): UseScreenWatchResult {
  const [watching, setWatching] = useState(false)
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [status, setStatus] = useState('')

  const aiBusyRef = useRef(aiBusy)
  aiBusyRef.current = aiBusy
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const busyRef = useRef(false)
  /** Fingerprint of the screen we already answered — skip until the page changes. */
  const answeredFpRef = useRef('')
  const cancelledRef = useRef(false)
  const timerRef = useRef(0)

  const setStatusMsg = useCallback((msg: string) => {
    setStatus(msg)
    onStatusRef.current?.(msg)
  }, [])

  const resetAnswerLock = useCallback(() => {
    answeredFpRef.current = ''
    setStatusMsg('')
  }, [setStatusMsg])

  useEffect(() => {
    if (!enabled) {
      cancelledRef.current = true
      window.clearTimeout(timerRef.current)
      setWatching(false)
      setStatusMsg('')
      return
    }

    cancelledRef.current = false
    const intervalMs = Math.max(MIN_INTERVAL_SEC, intervalSec) * 1000

    const schedule = (delay: number): void => {
      window.clearTimeout(timerRef.current)
      if (!cancelledRef.current) {
        timerRef.current = window.setTimeout(() => void scan(), delay)
      }
    }

    const scan = async (): Promise<void> => {
      if (cancelledRef.current) return
      if (busyRef.current || aiBusyRef.current) {
        schedule(POLL_AFTER_ANSWER_MS)
        return
      }

      busyRef.current = true
      setWatching(true)

      try {
        const capture = await window.api.captureScreen()
        if (cancelledRef.current) return

        if (capture.error || !capture.imageBase64) {
          onErrorRef.current?.(capture.error ?? 'Screen capture failed')
          setStatusMsg('Screen capture failed — retrying…')
          schedule(intervalMs)
          return
        }

        const fp = fingerprint(capture.imageBase64)

        // Already answered this exact screen — poll faster until user moves to next question.
        if (answeredFpRef.current && fp === answeredFpRef.current) {
          setStatusMsg('Answer shown — open next question to auto-scan')
          schedule(POLL_AFTER_ANSWER_MS)
          return
        }

        setLastScanAt(Date.now())
        setStatusMsg('Auto-scanning question…')

        const answer = (await onScanRef.current(capture.imageBase64)).trim()
        if (cancelledRef.current) return

        if (isNoQuestion(answer)) {
          setStatusMsg('Watching for next question…')
          schedule(intervalMs)
          return
        }

        answeredFpRef.current = fp
        setStatusMsg('Answer ready')
        onAnswerRef.current()
        schedule(POLL_AFTER_ANSWER_MS)
      } catch (err) {
        if (!cancelledRef.current) {
          onErrorRef.current?.((err as Error).message)
          setStatusMsg('Scan error — retrying…')
          schedule(intervalMs)
        }
      } finally {
        busyRef.current = false
        if (!cancelledRef.current) setWatching(false)
      }
    }

    schedule(FIRST_SCAN_MS)

    return () => {
      cancelledRef.current = true
      window.clearTimeout(timerRef.current)
      setWatching(false)
    }
  }, [enabled, intervalSec, setStatusMsg])

  return { watching, lastScanAt, status, resetAnswerLock }
}
