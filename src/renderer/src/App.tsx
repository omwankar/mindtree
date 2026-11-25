import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings } from './components/Settings'
import { Toast } from './components/Toast'
import { MoreMenu } from './components/MoreMenu'
import { useTranscription } from './hooks/useTranscription'
import { useAIAnswer } from './hooks/useAIAnswer'
import { useScreenWatch } from './hooks/useScreenWatch'
import { useMeetingAudio } from './hooks/useMeetingAudio'
import { looksLikeQuestion } from './lib/meetingQuestions'
import { MINERVA_PROFILE_NAME } from '@shared/minervaKnowledge'
import { AppSettings, AssistMode, DEFAULT_SETTINGS } from '@shared/types'

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [screenWatchOn, setScreenWatchOn] = useState(false)
  const [listenOn, setListenOn] = useState(true)
  const [screenStatus, setScreenStatus] = useState('')
  // Start clickable — the user can turn on Pass (click-through) mode when needed.
  const [clickThrough, setClickThrough] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [awaitingNextClick, setAwaitingNextClick] = useState(false)
  const [input, setInput] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const transcription = useTranscription()
  const ai = useAIAnswer()
  const toastTimer = useRef<number | null>(null)

  const flash = useCallback((msg: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const resetWatchLockRef = useRef<() => void>(() => {})
  const aiRef = useRef(ai)
  aiRef.current = ai
  const transcriptionRef = useRef(transcription)
  transcriptionRef.current = transcription

  const awaitingNextClickRef = useRef(false)

  const handleInterviewerSpeech = useCallback(
    async (audio: Float32Array) => {
      if (!listenOn) return
      if (awaitingNextClickRef.current) return
      const text = await transcriptionRef.current.transcribeSegment(audio, 'Others')
      if (!text || !looksLikeQuestion(text)) return
      if (aiRef.current.streaming) return
      const answer = await aiRef.current.generate(
        '',
        transcriptionRef.current.recentInterviewerLines(6),
        'meeting',
        text
      )
      if (answer.trim() && !/^no[_\s-]?question\.?$/i.test(answer.trim())) {
        setQuestionCount((n) => n + 1)
        awaitingNextClickRef.current = true
        setAwaitingNextClick(true)
      }
    },
    [listenOn]
  )

  const meetingAudio = useMeetingAudio({
    onSpeechEnd: handleInterviewerSpeech,
    autoStart: true
  })

  const run = useCallback(
    async (mode: AssistMode, question?: string) => {
      if (mode === 'screen') {
        resetWatchLockRef.current()
        const capture = await window.api.captureScreen()
        if (capture.error || !capture.imageBase64) {
          flash(capture.error ?? 'Screen capture failed')
          return
        }
        const answer = (await ai.generate('', [], 'screen', undefined, capture.imageBase64)).trim()
        if (/^no[_\s-]?question\.?$/i.test(answer)) {
          flash('No interview question detected on screen.')
        } else if (answer) {
          setQuestionCount((n) => n + 1)
        }
        return
      }

      if (mode === 'custom' && !question?.trim()) {
        flash('Paste or type the interviewer question.')
        return
      }
      const answer = await ai.generate('', transcription.recentLines(4), mode, question)
      if (answer.trim() && !/^no[_\s-]?question\.?$/i.test(answer.trim())) {
        setQuestionCount((n) => n + 1)
      }
    },
    [ai, transcription, flash]
  )

  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    window.api.setClickThrough(clickThrough && overlayVisible)
  }, [clickThrough, overlayVisible])

  const meetingAudioRef = useRef(meetingAudio)
  meetingAudioRef.current = meetingAudio

  // Ctrl+Shift+Space hides the overlay — stop listening (and screen watch via
  // `enabled`) while hidden; resume automatically when shown again.
  useEffect(() => {
    if (!overlayVisible) {
      meetingAudioRef.current.pause()
    } else if (listenOn) {
      void meetingAudioRef.current.start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayVisible])

  const scanScreenForAnswer = useCallback(
    async (imageBase64: string): Promise<string> => {
      return (await ai.generate('', [], 'screen', undefined, imageBase64)).trim()
    },
    [ai]
  )

  const handleScreenAnswer = useCallback(() => {
    setQuestionCount((n) => n + 1)
  }, [])

  const screenWatch = useScreenWatch({
    enabled: screenWatchOn && overlayVisible,
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
      setScreenWatchOn(s.screenWatchEnabled)
    })
  }, [])

  const handleClear = useCallback(() => {
    transcription.clear()
    ai.clear()
    setInput('')
    setQuestionCount(0)
    awaitingNextClickRef.current = false
    setAwaitingNextClick(false)
    screenWatch.resetAnswerLock()
    flash('Session cleared.')
  }, [transcription, ai, flash, screenWatch.resetAnswerLock])

  /** Clears the card and arms listening for the next interviewer question. */
  const handleNextQuestion = useCallback(() => {
    ai.clear()
    screenWatch.resetAnswerLock()
    awaitingNextClickRef.current = false
    setAwaitingNextClick(false)
  }, [ai, screenWatch.resetAnswerLock])

  const handleClearRef = useRef(handleClear)
  handleClearRef.current = handleClear

  const handleSend = useCallback(() => {
    const q = input.trim()
    if (!q) return
    run('custom', q)
    setInput('')
  }, [input, run])

  const idleLabel = !listenOn
    ? 'Listening is off — press Listen, or type a question below'
    : awaitingNextClick
      ? 'Answer ready — click Next question when they ask the next one'
      : meetingAudio.listening
        ? `Listening via ${meetingAudio.captureMode === 'meeting' ? 'tab audio' : 'microphone'} — first question answers automatically`
        : 'Listening is off — press Listen, or type a question below'

  const directAnswerLabel = ai.streaming
    ? 'Preparing answer…'
    : ai.answer.trim()
      ? null
      : (screenWatchOn ? screenStatus : '') || idleLabel

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((c) => !c)
    window.api.toggleExpand()
  }, [])

  useEffect(() => {
    const offToggle = window.api.onHotkey('toggle', () => {
      setOverlayVisible((v) => {
        flash(v ? 'Overlay hidden' : 'Overlay shown')
        return !v
      })
    })
    const offTrigger = window.api.onHotkey('trigger-ai', () => {
      void runRef.current('screen')
    })
    const offScreen = window.api.onHotkey('screen', () => {
      screenWatch.resetAnswerLock()
      void runRef.current('screen')
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
      const saved = await window.api.saveSettings(next)
      setSettings(saved)
      setScreenWatchOn(saved.screenWatchEnabled)
      setShowSettings(false)
      flash('Settings saved.')
    },
    [flash]
  )

  const progressLabel = `${questionCount} answered · Vishal · Concentrix Data Engineer`

  return (
    <div className={`cluely-wrapper ${overlayVisible ? '' : 'overlay-hidden'}`}>
      <div className="control-bar drag">
        <div className="logo-btn no-drag" title={MINERVA_PROFILE_NAME}>
          <span className="logo-icon">🎯</span>
          {(screenWatch.watching || meetingAudio.listening) && <span className="logo-pulse" />}
        </div>

        <span className="profile-pill no-drag" title={MINERVA_PROFILE_NAME}>
          CNX · Data Eng
        </span>

        {(screenWatch.watching || ai.streaming || meetingAudio.listening) && (
          <span className="status-pill no-drag">
            <span className="status-dot" />
            {ai.streaming
              ? 'Answering…'
              : meetingAudio.speaking
                ? 'Hearing question…'
                : `Live (${meetingAudio.captureMode === 'meeting' ? 'tab audio' : 'mic'})`}
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
              {(screenWatch.watching || meetingAudio.listening) && (
                <span className="vs-badge">live</span>
              )}
            </div>
          </div>

          <div className="response-panel direct-answer">
            <div className="response-mode">
              <span>🎯 Concentrix Data Engineer assist</span>
              {!ai.streaming && ai.answer && (
                <button
                  className="next-q-btn no-drag"
                  onClick={handleNextQuestion}
                  title="Clear this answer and wait for the next question"
                >
                  Next question
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
                      <div className="answer-prose">{ai.answer}</div>
                      <span className="caret">▍</span>
                    </>
                  ) : (
                    <span className="solving">
                      <span className="btn-spinner sm" /> {directAnswerLabel}
                    </span>
                  )}
                </>
              ) : ai.answer.trim() ? (
                <div className="answer-prose">{ai.answer}</div>
              ) : (
                <p className={`vs-text ${screenStatus ? '' : 'empty'}`}>{directAnswerLabel}</p>
              )}
            </div>
          </div>

          <div className={`input-area no-drag compact-input ${input.length > 0 ? 'has-text' : ''}`}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  run('screen')
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Type or paste a question… (Enter to answer, Ctrl+Enter to scan screen)"
            />
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
                className={`smart-btn ${meetingAudio.listening ? 'on' : ''}`}
                onClick={() => {
                  setListenOn(!meetingAudio.listening)
                  void meetingAudio.toggle()
                }}
                title="Listen to interviewer audio (tab share or mic)"
              >
                <span className="smart-icon">🎙</span> Listen
              </button>
              <button
                className={`smart-btn ${clickThrough ? 'on' : ''}`}
                onClick={() => setClickThrough((on) => !on)}
                title="Pass mode: hold Ctrl+Shift to interact"
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
              {ai.streaming ? '…' : 'Scan'}
            </button>
          </div>

          {(transcription.error || meetingAudio.error) && (
            <p className="inline-error">{transcription.error || meetingAudio.error}</p>
          )}
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
