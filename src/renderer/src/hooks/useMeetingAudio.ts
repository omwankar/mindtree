import { useCallback, useEffect, useRef, useState } from 'react'
import { VAD_SAMPLE_RATE, rms } from '@/lib/audioCapture'
import { downsampleAudio } from '@/lib/speechUtils'
import type { Speaker } from '@shared/types'

const ENERGY_THRESHOLD = 0.004
const CHUNK_INTERVAL_MS = 2500
const MIN_CHUNK_SEC = 1.0
const RING_BUFFER_SEC = 6
const PROCESSOR_SIZE = 2048

export type CaptureMode = 'meeting' | 'mic'

interface RingBuffer {
  frames: Float32Array[]
  samples: number
  peak: number
}

function emptyRing(): RingBuffer {
  return { frames: [], samples: 0, peak: 0 }
}

function pushFrame(ring: RingBuffer, frame: Float32Array, maxSamples: number): void {
  ring.frames.push(frame)
  ring.samples += frame.length
  while (ring.samples > maxSamples && ring.frames.length > 1) {
    const removed = ring.frames.shift()
    if (removed) ring.samples -= removed.length
  }
}

function drainRing(ring: RingBuffer, sampleRate: number): Float32Array | null {
  const chunks = ring.frames
  ring.frames = []
  ring.samples = 0
  if (!chunks.length) return null

  const total = chunks.reduce((n, c) => n + c.length, 0)
  const minSamples = Math.floor(sampleRate * MIN_CHUNK_SEC)
  if (total < minSamples) return null

  const merged = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return downsampleAudio(merged, sampleRate, VAD_SAMPLE_RATE)
}

interface UseMeetingAudioOptions {
  onSpeechEnd: (audio: Float32Array, speaker: Speaker) => void
  autoStart?: boolean
  /** When true, capture meeting/system audio only — no microphone. */
  interviewerOnly?: boolean
}

interface UseMeetingAudioResult {
  listening: boolean
  speaking: boolean
  level: number
  error: string | null
  loading: boolean
  captureMode: CaptureMode
  hasMeetingAudio: boolean
  start: () => Promise<void>
  pause: () => void
  toggle: () => Promise<void>
}

export function useMeetingAudio({
  onSpeechEnd,
  autoStart = true,
  interviewerOnly = true
}: UseMeetingAudioOptions): UseMeetingAudioResult {
  const onSpeechEndRef = useRef(onSpeechEnd)
  const streamsRef = useRef<MediaStream[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const processorsRef = useRef<ScriptProcessorNode[]>([])
  const gainsRef = useRef<GainNode[]>([])
  const intervalRef = useRef<number | null>(null)

  const micRingRef = useRef<RingBuffer>(emptyRing())
  const meetRingRef = useRef<RingBuffer>(emptyRing())
  const maxRingSamplesRef = useRef(0)
  const hasMeetingAudioRef = useRef(false)

  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('mic')
  const [hasMeetingAudio, setHasMeetingAudio] = useState(false)
  const listeningRef = useRef(false)

  const interviewerOnlyRef = useRef(interviewerOnly)
  interviewerOnlyRef.current = interviewerOnly

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd
  }, [onSpeechEnd])

  const flushRing = useCallback((ring: RingBuffer, speaker: Speaker) => {
    if (ring.peak < ENERGY_THRESHOLD) {
      ring.peak = 0
      ring.frames = []
      ring.samples = 0
      return
    }
    const pcm = drainRing(ring, ctxRef.current?.sampleRate ?? VAD_SAMPLE_RATE)
    ring.peak = 0
    if (!pcm) return
    onSpeechEndRef.current(pcm, speaker)
  }, [])

  const flushAll = useCallback(() => {
    if (!interviewerOnlyRef.current) {
      flushRing(micRingRef.current, 'You')
    }
    if (hasMeetingAudioRef.current) {
      flushRing(meetRingRef.current, 'Others')
    }
  }, [flushRing])

  const teardown = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    for (const p of processorsRef.current) p.disconnect()
    for (const g of gainsRef.current) g.disconnect()
    processorsRef.current = []
    gainsRef.current = []

    for (const stream of streamsRef.current) {
      stream.getTracks().forEach((t) => t.stop())
    }
    streamsRef.current = []

    void ctxRef.current?.close()
    ctxRef.current = null

    micRingRef.current = emptyRing()
    meetRingRef.current = emptyRing()
    listeningRef.current = false
    setListening(false)
    setSpeaking(false)
    setLevel(0)
  }, [])

  const wireStream = useCallback(
    (
      ctx: AudioContext,
      stream: MediaStream,
      ring: RingBuffer,
      gain: number,
      onLevel?: (energy: number) => void
    ): ScriptProcessorNode => {
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
        ring.peak = Math.max(ring.peak, energy)
        pushFrame(ring, frame, maxRingSamplesRef.current)

        if (onLevel) {
          const now = performance.now()
          if (now - lastLevelUpdate > 100) {
            lastLevelUpdate = now
            onLevel(energy)
          }
        }
      }

      preGain.connect(processor)
      processor.connect(silent)
      silent.connect(ctx.destination)

      gainsRef.current.push(silent)
      processorsRef.current.push(processor)
      return processor
    },
    []
  )

  const acquireMeetingStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1, max: 1 }, height: { ideal: 1, max: 1 }, frameRate: { ideal: 1, max: 1 } },
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
      console.warn('[meeting-audio] system loopback unavailable:', err)
      return null
    }
  }, [])

  const acquireMicStream = useCallback(async (): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true
      }
    })
  }, [])

  const start = useCallback(async () => {
    if (listeningRef.current) return
    setLoading(true)
    setError(null)

    try {
      const meetingStream = await acquireMeetingStream()

      if (interviewerOnlyRef.current) {
        const meetingOk = Boolean(meetingStream?.getAudioTracks().length)
        if (!meetingOk) {
          setError(
            'Share your interview tab/window with audio checked — mic is off; we only listen to the interviewer.'
          )
          teardown()
          return
        }
        hasMeetingAudioRef.current = true
        setHasMeetingAudio(true)
        setCaptureMode('meeting')
        streamsRef.current = [meetingStream!]

        const ctx = new AudioContext()
        if (ctx.state === 'suspended') await ctx.resume()
        ctxRef.current = ctx
        maxRingSamplesRef.current = Math.floor(ctx.sampleRate * RING_BUFFER_SEC)
        meetRingRef.current = emptyRing()

        wireStream(ctx, meetingStream!, meetRingRef.current, 1.3, (energy) => {
          setLevel(Math.round(energy * 50) / 50)
          setSpeaking(energy > ENERGY_THRESHOLD)
        })

        intervalRef.current = window.setInterval(flushAll, CHUNK_INTERVAL_MS)
        listeningRef.current = true
        setListening(true)
        return
      }

      const micStream = await acquireMicStream()

      const meetingOk = Boolean(meetingStream?.getAudioTracks().length)
      hasMeetingAudioRef.current = meetingOk
      setHasMeetingAudio(meetingOk)
      setCaptureMode(meetingOk ? 'meeting' : 'mic')

      const streams: MediaStream[] = [micStream]
      if (meetingStream) streams.push(meetingStream)
      streamsRef.current = streams

      const ctx = new AudioContext()
      if (ctx.state === 'suspended') await ctx.resume()
      ctxRef.current = ctx
      maxRingSamplesRef.current = Math.floor(ctx.sampleRate * RING_BUFFER_SEC)

      micRingRef.current = emptyRing()
      meetRingRef.current = emptyRing()

      wireStream(ctx, micStream, micRingRef.current, 1, (energy) => {
        setLevel(Math.round(energy * 50) / 50)
        setSpeaking(energy > ENERGY_THRESHOLD)
      })

      if (meetingStream) {
        wireStream(ctx, meetingStream, meetRingRef.current, 1.3)
      }

      intervalRef.current = window.setInterval(flushAll, CHUNK_INTERVAL_MS)

      listeningRef.current = true
      setListening(true)

      if (!meetingOk) {
        setError(
          'Meeting audio unavailable — mic only. Allow screen/audio capture when prompted for full interview listening.'
        )
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      if (/denied|not allowed|permission/i.test(msg)) {
        setError(
          interviewerOnlyRef.current
            ? 'Screen/audio share denied. Pick your interview tab and check "Share audio".'
            : 'Audio access denied. Allow Microphone + Screen capture in Windows Settings → Privacy.'
        )
      } else if (/not found|no device/i.test(msg)) {
        setError('No microphone found. Plug in a mic and try again.')
      } else {
        setError(`Could not start audio capture: ${msg}`)
      }
      teardown()
    } finally {
      setLoading(false)
    }
  }, [acquireMeetingStream, acquireMicStream, flushAll, teardown, wireStream])

  const pause = useCallback(() => {
    flushAll()
    teardown()
  }, [flushAll, teardown])

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
    hasMeetingAudio,
    start,
    pause,
    toggle
  }
}
