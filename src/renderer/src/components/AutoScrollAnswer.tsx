import { useEffect, useMemo, useRef, useState } from 'react'

interface AutoScrollAnswerProps {
  /** The full answer text (may contain a fenced ``` code block). */
  text: string
  /** When true, reveal the next line on a timer; when false, show everything. */
  autoScroll: boolean
  /** code = slow reveal for screen/coding; prose = faster for interview answers. */
  speed?: 'code' | 'prose'
  /** Fired once when the line-by-line reveal reaches the last line. */
  onComplete?: () => void
}

const CODE_TIMING = {
  minLineMs: 18_000,
  maxLineMs: 32_000,
  msPerChar: 260,
  blankLineMs: 2500
}

const PROSE_TIMING = {
  minLineMs: 2200,
  maxLineMs: 6500,
  msPerChar: 42,
  blankLineMs: 700
}
/** How many lines stay on screen at once. The window always shows this many
 *  lines (when available); advancing adds one at the bottom and drops one off
 *  the top. */
const WINDOW_SIZE = 5

/** Time to dwell on a line before advancing — longer lines get more time. */
function lineDelay(line: string, timing: typeof CODE_TIMING): number {
  const len = line.trim().length
  if (len === 0) return timing.blankLineMs
  return Math.min(timing.maxLineMs, timing.minLineMs + len * timing.msPerChar)
}

interface ParsedAnswer {
  body: string
  isCode: boolean
  lang: string
}

/**
 * If the answer contains a fenced code block, return ONLY the code (coding
 * questions should show just the solution — drop any surrounding prose).
 * Otherwise return the text as-is.
 */
function parseAnswer(text: string): ParsedAnswer {
  const trimmed = text.trim()

  // First fenced block anywhere in the text.
  const fence = trimmed.match(/```([\w+#-]*)\s*\n?([\s\S]*?)```/)
  if (fence) {
    return { body: fence[2].replace(/\n+$/, ''), isCode: true, lang: fence[1] || '' }
  }

  // No fence, but heuristically looks like code → treat as code anyway.
  if (looksLikeCode(trimmed)) {
    return { body: trimmed, isCode: true, lang: '' }
  }

  return { body: trimmed, isCode: false, lang: '' }
}

/** Cheap heuristic: indentation, braces, or common code tokens across lines. */
function looksLikeCode(text: string): boolean {
  const lines = text.split('\n')
  if (lines.length < 2) return false
  let signals = 0
  for (const line of lines) {
    if (/[;{}]\s*$/.test(line)) signals++
    if (/^\s{2,}\S/.test(line)) signals++
    if (/\b(class|public|private|def|function|return|for|while|if|import|const|let|var|int|void)\b/.test(line)) {
      signals++
    }
  }
  return signals >= lines.length
}

export function AutoScrollAnswer({
  text,
  autoScroll,
  speed = 'code',
  onComplete
}: AutoScrollAnswerProps): JSX.Element {
  const timing = speed === 'prose' ? PROSE_TIMING : CODE_TIMING
  const { body, isCode, lang } = useMemo(() => parseAnswer(text), [text])
  const lines = useMemo(() => body.split('\n'), [body])

  // Start with a full window of lines so the area always shows WINDOW_SIZE lines.
  const initialVisible = (n: number): number =>
    autoScroll ? Math.min(WINDOW_SIZE, n) : n
  const [visible, setVisible] = useState(initialVisible(lines.length))
  const activeRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset the reveal whenever the answer text or the toggle changes.
  useEffect(() => {
    setVisible(initialVisible(lines.length))
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, autoScroll, lines.length, speed])

  const completedRef = useRef(false)

  // Advance one line at a time. Re-runs each time `visible` changes, so each
  // line gets its own correctly-sized timer (no stale closures).
  useEffect(() => {
    if (!autoScroll) return
    if (visible >= lines.length) {
      if (!completedRef.current && lines.length > 0) {
        completedRef.current = true
        onComplete?.()
      }
      return
    }
    const delay = lineDelay(lines[visible - 1] ?? '', timing)
    const timer = window.setTimeout(() => setVisible((v) => v + 1), delay)
    return () => window.clearTimeout(timer)
  }, [visible, autoScroll, lines, onComplete, timing])

  // New answer → allow onComplete to fire again.
  useEffect(() => {
    completedRef.current = false
  }, [body])

  // Keep the panel scrolled so the reveal reads from the top downward.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [visible])

  const done = !autoScroll || visible >= lines.length

  // Sliding window: add a line at the bottom, drop one off the top.
  const windowStart = autoScroll ? Math.max(0, visible - WINDOW_SIZE) : 0
  const windowEnd = autoScroll ? visible : lines.length
  const shown = lines.slice(windowStart, windowEnd)

  const content = (
    <div ref={containerRef} className={isCode ? 'answer-code answer-scroll' : 'answer-prose answer-scroll'}>
      {shown.map((line, i) => {
        const absoluteIndex = windowStart + i
        const isLatest = absoluteIndex === windowEnd - 1
        return (
          <div
            key={absoluteIndex}
            ref={isLatest ? activeRef : undefined}
            className={`answer-line ${autoScroll && isLatest && !done ? 'current' : ''}`}
          >
            {line || '\u00A0'}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="auto-answer">
      {isCode && (
        <div className="answer-code-bar">
          <span className="answer-lang">{lang || 'code'}</span>
          {autoScroll && !done && (
            <span className="answer-progress">
              line {visible}/{lines.length}
            </span>
          )}
        </div>
      )}
      {content}
    </div>
  )
}
