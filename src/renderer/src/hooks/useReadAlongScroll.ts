import { useEffect, useRef } from 'react'

/** Pixels of scroll distance covered per second while auto-reading. */
const SCROLL_PX_PER_SEC = 32
const MIN_SCROLL_MS = 7000
const MAX_SCROLL_MS = 90000

/**
 * Keeps the answer panel at the top while streaming, then slowly auto-scrolls
 * from the first line to the last so the user reads from the beginning.
 */
export function useReadAlongScroll(
  panelRef: React.RefObject<HTMLElement | null>,
  answer: string,
  streaming: boolean,
  enabled = true
): void {
  const rafRef = useRef(0)
  const timerRef = useRef(0)
  const lastScrolledAnswerRef = useRef('')

  // New answer loading → always start at the top.
  useEffect(() => {
    if (!enabled || !streaming) return
    const el = panelRef.current
    if (el) el.scrollTop = 0
    lastScrolledAnswerRef.current = ''
  }, [streaming, panelRef, enabled])

  // After the answer finishes, scroll top → bottom at a readable pace.
  useEffect(() => {
    if (!enabled || streaming || !answer.trim()) return
    if (lastScrolledAnswerRef.current === answer) return

    const el = panelRef.current
    if (!el) return

    cancelAnimationFrame(rafRef.current)
    window.clearTimeout(timerRef.current)

    el.scrollTop = 0
    lastScrolledAnswerRef.current = answer

    timerRef.current = window.setTimeout(() => {
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 0) return

      const duration = Math.min(
        MAX_SCROLL_MS,
        Math.max(MIN_SCROLL_MS, (maxScroll / SCROLL_PX_PER_SEC) * 1000)
      )
      const start = performance.now()

      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        el.scrollTop = maxScroll * progress
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }, 80)

    return () => {
      window.clearTimeout(timerRef.current)
      cancelAnimationFrame(rafRef.current)
    }
  }, [answer, streaming, panelRef, enabled])
}
