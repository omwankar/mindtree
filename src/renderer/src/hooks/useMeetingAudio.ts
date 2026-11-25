import { useCallback, useEffect, useRef, useState } from 'react'
import { VAD_SAMPLE_RATE, rms } from '@/lib/audioCapture'
import { downsampleAudio } from '@/lib/speechUtils'
import type { Speaker } from '@shared/types'

/** Speech gate: RMS energy above this counts as someone talking. */
const ENERGY_THRESHOLD = 0.0035
/** Flush a segment after this much trailing silence — speaker finished the question. */
const SILENCE_MS = 1100
/** Ignore blips shorter than this (coughs, clicks). */
const MIN_SPEECH_MS = 500
/** Hard cap so a long monologue still flushes and transcribes. */
const MAX_SPEECH_MS = 20_000
/** Keep this much audio before speech onset so the first word isn't clipped. */
const PRE_ROLL_MS = 350
const PROCESSOR_SIZE = 2048

export type CaptureMode = 'meeting' | 'mic'

/** Per-stream utterance segmenter: accumulates while speaking, flushes on silence. */
interface Segmenter {
  frames: Float32Array[]
  preRoll: Float32Array[]
  preRollSamples: number
  speaking: boolean
  speechStart: number
  silenceStart: number | null
}

function newSegmenter(): Segmenter {
  return {
    frames: [],
    preRoll: [],
    preRollSamples: 0,
    speaking: false,
    speechStart: 0,
    silenceStart: null
  }
}

function resetSegmenter(s: Segmenter): void {
  s.frames = []
  s.preRoll = []
  s.preRollSamples = 0
  s.speaking = false
  s.speechStart = 0
  s.silenceStart = null
}

interface UseMeetingAudioOptions {
  onSpeechEnd: (audio: Float32Array, speaker: Speaker) => void
  autoStart?: boolean
}

interface UseMeetingAudioResult {
  listening: boolean
  speaking: boolean
  level: number
  error: string | null
  loading: boolean
  /** "meeting" = shared tab/system audio (interviewer only), "mic" = microphone fallback. */
  captureMode: CaptureMode
  start: () => Promise<void>
  pause: () => void
  toggle: () => Promise<void>
}

/**
 * Captures interviewer audio and emits one Float32Array per complete utterance.
 *
 * Prefers shared meeting-tab audio (clean interviewer signal); falls back to the
 * microphone (picks up speaker output) so listening always works. Utterances are
 * segmented by silence, so full questions reach Whisper in one piece instead of
 * fixed-interval fragments.
 */
export function useMeetingAudio({
  onSpeechEnd,
  autoStart = true
}: UseMeetingAudioOptions): UseMeetingAudioResult {
  const onSpeechEndRef = useRef(onSpeechEnd)
  const streamsRef = useRef<MediaStream[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const processorsRef = useRef<ScriptProcessorNode[]>([])
  const nodesRef = useRef<AudioNode[]>([])
  const segmenterRef = useRef<Segmenter>(newSegmenter())
  const listeningRef = useRef(false)

  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('mic')

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd
  }, [onSpeechEnd])

  const flushSegment = useCallback((seg: Segmenter) => {
    const chunks = [...seg.preRoll, ...seg.frames]
    resetSegmenter(seg)
    if (!chunks.length) return

    const total = chunks.reduce((n, c) => n + c.length, 0)
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    const sampleRate = ctxRef.current?.sampleRate ?? VAD_SAMPLE_RATE
    const pcm = downsampleAudio(merged, sampleRate, VAD_SAMPLE_RATE)
    onSpeechEndRef.current(pcm, 'Others')
  }, [])

  const teardown = useCallback(() => {
    for (const p of processorsRef.current) p.disconnect()
    for (const n of nodesRef.current) n.disconnect()
    processorsRef.current = []
    nodesRef.current = []

    for (const stream of streamsRef.current) {
      stream.getTracks().forEach((t) => t.stop())
    }
    streamsRef.current = []

    void ctxRef.current?.close()
    ctxRef.current = null

    segmenterRef.current = newSegmenter()
    listeningRef.current = false
    setListening(false)
    setSpeaking(false)
    setLevel(0)
  }, [])

  const wireStream = useCallback(
    (ctx: AudioContext, stream: MediaStream, gain: number): void => {
      const seg = segmenterRef.current
      const preRollFrames = Math.ceil((PRE_ROLL_MS / 1000) * ctx.sampleRate / PROCESSOR_SIZE)

      const source = ctx.createMediaStreamSource(stream)
      const preGain = ctx.createGain()
      preGain.gain.value = gain
      source.connect(preGain)

      const processor = ctx.createScriptProcessor(PROCESSOR_SIZE, 1, 1)
      const silent = ctx.createGain()
      silent.gain.value = 0

      let lastLevelUpdate = 0
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const frame = new Float32Array(input)
        const energy = rms(frame)
        const now = Date.now()

        const perfNow = performance.now()
        if (perfNow - lastLevelUpdate > 100) {
          lastLevelUpdate = perfNow
          setLevel(energy)
          setSpeaking(seg.speaking)
        }

        if (energy > ENERGY_THRESHOLD) {
          if (!seg.speaking) {
            seg.speaking = true
            seg.speechStart = now
          }
          seg.silenceStart = null
          seg.frames.push(frame)

          if (now - seg.speechStart >= MAX_SPEECH_MS) {
            flushSegment(seg)
          }
          return
        }

        if (!seg.speaking) {
          // Rolling pre-roll so speech onset isn't clipped.
          seg.preRoll.push(frame)
          seg.preRollSamples += frame.length
          while (seg.preRoll.length > preRollFrames) {
            const removed = seg.preRoll.shift()
            if (removed) seg.preRollSamples -= removed.length
          }
          return
        }

        // Trailing silence inside an utterance.
        seg.frames.push(frame)
        if (seg.silenceStart === null) seg.silenceStart = now

        const silenceDur = now - seg.silenceStart
        const speechDur = now - seg.speechStart
        if (silenceDur >= SILENCE_MS) {
          if (speechDur >= MIN_SPEECH_MS + SILENCE_MS) {
            flushSegment(seg)
          } else {
            resetSegmenter(seg)
          }
        }
      }

      preGain.connect(processor)
      processor.connect(silent)
      silent.connect(ctx.destination)

      nodesRef.current.push(source, preGain, silent)
      processorsRef.current.push(processor)
    },
    [flushSegment]
  )

  const acquireMeetingStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // getDisplayMedia demands a video track even though we only want audio.
      // Keep it small but valid — 1×1 makes Chromium's frame pool log
      // "Failed to create a video frame" errors. The track is stopped below.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 320, max: 320 },
          height: { ideal: 180, max: 180 },
          frameRate: { ideal: 1, max: 5 }
        },
        audio: true
      })
      stream.getVideoTracks().forEach((t) => t.stop())
      const audioTracks = stream.getAudioTracks()
      if (!audioTracks.length) {
        stream.getTracks().forEach((t) => t.stop())
        return null
      }
      return new MediaStream(audioTracks)
    } catch (err) {
      console.warn('[meeting-audio] tab/system audio unavailable:', err)
      return null
    }
  }, [])

  const acquireMicStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false, // keep speaker audio audible to the mic
          autoGainControl: true,
          noiseSuppression: true
        }
      })
    } catch (err) {
      console.warn('[meeting-audio] microphone unavailable:', err)
      return null
    }
  }, [])

  const start = useCallback(async () => {
    if (listeningRef.current) return
    setLoading(true)
    setError(null)

    try {
      // Preferred: shared meeting-tab audio (clean interviewer-only signal).
      const meetingStream = await acquireMeetingStream()
      // Fallback: microphone hears the interviewer through your speakers.
      const stream = meetingStream ?? (await acquireMicStream())

      if (!stream) {
        setError(
          'No audio source. Share your meeting tab with "Share audio" checked, or allow microphone access.'
        )
        teardown()
        return
      }

      const mode: CaptureMode = meetingStream ? 'meeting' : 'mic'
      setCaptureMode(mode)
      streamsRef.current = [stream]

      const ctx = new AudioContext()
      if (ctx.state === 'suspended') await ctx.resume()
      ctxRef.current = ctx
      segmenterRef.current = newSegmenter()

      wireStream(ctx, stream, mode === 'meeting' ? 1.3 : 1.6)

      listeningRef.current = true
      setListening(true)

      if (mode === 'mic') {
        setError(
          'Using microphone (hears interviewer via speakers). For cleaner audio, share the meeting tab with "Share audio".'
        )
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      setError(`Could not start audio capture: ${msg}`)
      teardown()
    } finally {
      setLoading(false)
    }
  }, [acquireMeetingStream, acquireMicStream, teardown, wireStream])

  const pause = useCallback(() => {
    const seg = segmenterRef.current
    if (seg.speaking && seg.frames.length) flushSegment(seg)
    teardown()
  }, [flushSegment, teardown])

  const toggle = useCallback(async () => {
    if (listeningRef.current) pause()
    else await start()
  }, [pause, start])

  const startRef = useRef(start)
  startRef.current = start

  useEffect(() => {
    if (autoStart) void startRef.current()
    return () => teardown()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    listening,
    speaking,
    level,
    error,
    loading,
    captureMode,
    start,
    pause,
    toggle
  }
}
