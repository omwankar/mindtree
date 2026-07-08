import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings } from './components/Settings'
import { Toast } from './components/Toast'
import { MoreMenu } from './components/MoreMenu'
import { AutoScrollAnswer } from './components/AutoScrollAnswer'
import { useTranscription } from './hooks/useTranscription'
import { useAIAnswer } from './hooks/useAIAnswer'
import { useReadAlongScroll } from './hooks/useReadAlongScroll'
import { useScreenWatch } from './hooks/useScreenWatch'
import { useElevenLabsTts } from './hooks/useElevenLabsTts'
import {
  EXAM_MCQ_COUNT,
  EXAM_PROFILE_NAME,
  EXAM_TOTAL_QUESTIONS
} from '@shared/examKnowledge'
import { AppSettings, AssistMode, DEFAULT_SETTINGS } from '@shared/types'

function isCodeAnswer(text: string): boolean {
  return /```[\s\S]*```/.test(text.trim())
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [screenWatchOn, setScreenWatchOn] = useState(true)
  const [ttsOn, setTtsOn] = useState(false)
  const [screenStatus, setScreenStatus] = useState('')
  const [clickThrough, setClickThrough] = useState(true)
  const [activeMode, setActiveMode] = useState<AssistMode>('screen')
  const [answeredCount, setAnsweredCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const transcription = useTranscription()
  const ai = useAIAnswer()
  const tts = useElevenLabsTts(ttsOn)
  const lastSpokenRef = useRef('')
  const responseRef = useRef<HTMLDivElement>(null)
  const scrollAnswers = activeMode !== 'screen' && activeMode !== 'review'
  useReadAlongScroll(responseRef, ai.answer, ai.streaming, scrollAnswers)
  const toastTimer = useRef<number | null>(null)

  const flash = useCallback((msg: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const resetWatchLockRef = useRef<() => void>(() => {})

  const run = useCallback(
    async (mode: AssistMode, question?: string) => {
      if (mode === 'screen') {
        setActiveMode('screen')
        resetWatchLockRef.current()
        const capture = await window.api.captureScreen()
        if (capture.error || !capture.imageBase64) {
          flash(capture.error ?? 'Screen capture failed')
          return
        }
        const answer = (await ai.generate('', [], 'screen', undefined, capture.imageBase64)).trim()
        if (/^no[_\s-]?question\.?$/i.test(answer)) {
          flash('No question detected on screen.')
        } else if (answer) {
          setAnsweredCount((n) => Math.min(EXAM_TOTAL_QUESTIONS, n + 1))
        }
        return
      }

      if (mode === 'review') {
        setActiveMode('review')
        const capture = await window.api.captureScreen()
        if (capture.error || !capture.imageBase64) {
          flash(capture.error ?? 'Screen capture failed')
          return
        }
        const review = (await ai.generate('', [], 'review', undefined, capture.imageBase64)).trim()
        if (/^code[_\s-]?ok\.?$/i.test(review)) {
          ai.presentAnswer('✓ Your code looks correct — moving to the next question.')
          flash('Code looks correct ✓')
        } else if (/^no[_\s-]?code\.?$/i.test(review)) {
          ai.presentAnswer('No code detected to review.')
        } else {
          flash('Found fixes in your code — see corrected version')
        }
        return
      }

      const recent = transcription.recentLines(4)
      if (mode === 'custom' && !question?.trim()) {
        flash('Paste an MCQ or coding question and press Enter.')
        return
      }
      setActiveMode(mode)
      const answer = await ai.generate('', recent, mode, question)
      if (mode === 'custom' && answer.trim() && !/^no[_\s-]?question\.?$/i.test(answer.trim())) {
        setAnsweredCount((n) => Math.min(EXAM_TOTAL_QUESTIONS, n + 1))
      }
    },
    [ai, transcription, flash]
  )

  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    // Pass-through on: clicks/wheel go to apps below unless Ctrl+Shift is held (main process).
    window.api.setClickThrough(clickThrough && overlayVisible)
  }, [clickThrough, overlayVisible])

  const scanScreenForAnswer = useCallback(
    async (imageBase64: string): Promise<string> => {
      setActiveMode('screen')
      return (await ai.generate('', [], 'screen', undefined, imageBase64)).trim()
    },
    [ai]
  )

  const handleScreenAnswer = useCallback(() => {
    setAnsweredCount((n) => Math.min(EXAM_TOTAL_QUESTIONS, n + 1))
  }, [])

  const screenWatch = useScreenWatch({
    enabled: true,
    intervalSec: settings.screenWatchIntervalSec,
    aiBusy: ai.streaming,
    onScan: scanScreenForAnswer,
    onAnswer: handleScreenAnswer,
    onStatus: setScreenStatus,
    onError: (msg) => flash(msg)
  })

  resetWatchLockRef.current = screenWatch.resetAnswerLock

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s)
      setTtsOn(s.ttsEnabled)
      setScreenWatchOn(true)
    })
  }, [])

  useEffect(() => {
    if (!ttsOn || ai.streaming || !ai.answer.trim()) return
    const text = ai.answer.trim()
    if (/^no[_\s-]?question\.?$/i.test(text)) return
    if (lastSpokenRef.current === text) return
    lastSpokenRef.current = text
    void tts.speakAnswer(text)
  }, [ai.answer, ai.streaming, ttsOn, tts.speakAnswer])

  const handleClear = useCallback(() => {
    transcription.clear()
    ai.clear()
    setAnsweredCount(0)
    lastSpokenRef.current = ''
    tts.stop()
    screenWatch.resetAnswerLock()
    flash('Session cleared.')
  }, [transcription, ai, flash, screenWatch.resetAnswerLock, tts])

  const handleRescan = useCallback(() => {
    screenWatch.resetAnswerLock()
    void runRef.current('screen')
    flash('Force rescan…')
  }, [screenWatch.resetAnswerLock])

  const handleClearRef = useRef(handleClear)
  handleClearRef.current = handleClear

  const directAnswerLabel = ai.streaming
    ? 'Scanning screen…'
    : ai.answer.trim()
      ? null
      : screenStatus || 'Open a question on screen — answer appears here automatically'

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((c) => !c)
    window.api.toggleExpand()
  }, [])

  // Global hotkeys forwarded from the main process.
  useEffect(() => {
    const offToggle = window.api.onHotkey('toggle', () => {
      setOverlayVisible((v) => {
        flash(v ? 'Overlay hidden' : 'Overlay shown')
        return !v
      })
    })
    const offTrigger = window.api.onHotkey('trigger-ai', () => {
      void runRef.current('screen')
      flash('Scanning screen…')
    })
    const offScreen = window.api.onHotkey('screen', () => {
      screenWatch.resetAnswerLock()
      void runRef.current('screen')
      flash('Force rescan…')
    })
    const offClear = window.api.onHotkey('clear', () => handleClearRef.current())
    return () => {
      offToggle()
      offTrigger()
      offScreen()
      offClear()
    }
  }, [flash, screenWatch.resetAnswerLock])

  const saveSettings = useCallback(
    async (next: AppSettings) => {
      const saved = await window.api.saveSettings({
        ...next,
        screenWatchEnabled: screenWatchOn,
        ttsEnabled: ttsOn
      })
      setSettings(saved)
      setTtsOn(saved.ttsEnabled)
      setShowSettings(false)
      flash('Settings saved.')
    },
    [flash, screenWatchOn, ttsOn]
  )


  const progressLabel = `${answeredCount}/${EXAM_TOTAL_QUESTIONS} answered · ${EXAM_MCQ_COUNT} MCQ + 2 code`

  return (
    <div className={`cluely-wrapper ${overlayVisible ? '' : 'overlay-hidden'}`}>
      <div className="control-bar drag">
        <div className="logo-btn no-drag" title={EXAM_PROFILE_NAME}>
          <span className="logo-icon">📝</span>
          {screenWatch.watching && <span className="logo-pulse" />}
        </div>

        <span className="profile-pill no-drag" title={EXAM_PROFILE_NAME}>
          {answeredCount}/{EXAM_TOTAL_QUESTIONS}
        </span>

        {(screenWatch.watching || ai.streaming || tts.speaking) && (
          <span className="status-pill no-drag">
            <span className="status-dot" />
            {ai.streaming ? 'Scanning…' : tts.speaking ? 'Speaking…' : 'Live scan'}
          </span>
        )}

        <button className="hide-btn no-drag" onClick={handleToggleCollapse}>
          <span className={`chev ${collapsed ? 'chev-up' : ''}`}>⌄</span>
          {collapsed ? 'Show' : 'Hide'}
        </button>

        {clickThrough && (
          <span className="mod-hint no-drag" title="Hold Ctrl+Shift to scroll or click this panel">
            Ctrl+Shift
          </span>
        )}
      </div>

      <div className={`main-card-wrap ${collapsed ? 'collapsed' : 'expanded'}`}>
        <div className="main-card">
          <div className="viewed-screen">
            <div className="vs-header">
              <span className="vs-label">{progressLabel}</span>
              {(screenWatch.watching || ai.streaming) && <span className="vs-badge">live</span>}
            </div>
          </div>

          <div className="response-panel direct-answer" ref={responseRef}>
            <div className="response-mode">
              <span>👁 Screen scan → answer</span>
              {!ai.streaming && ai.answer && (
                <button
                  className="next-q-btn no-drag"
                  onClick={handleRescan}
                  title="Rescan now (Ctrl+Shift+S)"
                >
                  Rescan
                </button>
              )}
            </div>
            <div className="response">
              {ai.error ? (
                <span className="response-error">{ai.error}</span>
              ) : ai.streaming ? (
                <>
                  {ai.answer ? (
                    <>
                      {isCodeAnswer(ai.answer) ? (
                        <AutoScrollAnswer text={ai.answer} autoScroll={false} />
                      ) : (
                        <span className="response-mcq">{ai.answer}</span>
                      )}
                      <span className="caret">▍</span>
                    </>
                  ) : (
                    <span className="solving">
                      <span className="btn-spinner sm" /> {directAnswerLabel}
                    </span>
                  )}
                </>
              ) : ai.answer.trim() ? (
                isCodeAnswer(ai.answer) ? (
                  <AutoScrollAnswer text={ai.answer} autoScroll={false} />
                ) : (
                  <div className="response-mcq">{ai.answer}</div>
                )
              ) : (
                <p className={`vs-text ${screenStatus ? '' : 'empty'}`}>{directAnswerLabel}</p>
              )}
            </div>
          </div>

          <div className="input-footer compact-footer no-drag">
            <div className="input-footer-left">
              <div className="more-wrap">
                <button
                  className="more-btn"
                  onClick={() => setShowMore((o) => !o)}
                  title="More options"
                >
                  ···
                </button>
                <MoreMenu
                  open={showMore}
                  onClose={() => setShowMore(false)}
                  onSettings={() => setShowSettings(true)}
                  onClear={handleClear}
                />
              </div>
              <button
                className={`smart-btn ${ttsOn ? 'on' : ''}`}
                onClick={() => setTtsOn((s) => !s)}
                title="Speak answers with ElevenLabs (optional)"
              >
                <span className="smart-icon">🔊</span> Voice
              </button>
              <button
                className={`smart-btn ${clickThrough ? 'on' : ''}`}
                onClick={() => setClickThrough((on) => !on)}
                title="Pass mode ON: hold Ctrl+Shift to interact with overlay"
              >
                <span className="smart-icon">⎋</span> Pass
              </button>
            </div>
            <button
              className="assist-btn sm no-drag"
              onClick={() => run('screen')}
              disabled={ai.streaming}
              title="Scan screen now (Ctrl+Shift+A)"
            >
              {ai.streaming ? '…' : 'Scan now'}
            </button>
          </div>

          {transcription.error && <p className="inline-error">{transcription.error}</p>}
        </div>
      </div>

      <Toast message={toast} />

      <Settings
        open={showSettings}
        initial={settings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
      />
    </div>
  )
}
