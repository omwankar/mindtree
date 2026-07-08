import { useCallback, useEffect, useRef, useState } from 'react'
import { rms, VAD_SAMPLE_RATE } from '@/lib/audioCapture'

const SILENCE_THRESHOLD = 0.012
const SILENCE_MS = 800
const MIN_SPEECH_MS = 350
const MAX_SPEECH_MS = 14000

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const outLen = Math.floor(buffer.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    out[i] = buffer[Math.floor(i * ratio)] ?? 0
  }
  return out
}

interface UseSimpleMicOptions {
  onSpeechEnd: (audio: Float32Array) => void
  autoStart?: boolean
}

interface UseSimpleMicResult {
  listening: boolean
  speaking: boolean
  level: number
  error: string | null
  loading: boolean
  start: () => Promise<void>
  pause: () => void
  toggle: () => Promise<void>
}

export function useSimpleMic({
  onSpeechEnd,
  autoStart = true
}: UseSimpleMicOptions): UseSimpleMicResult {
  const onSpeechEndRef = useRef(onSpeechEnd)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  const chunksRef = useRef<Float32Array[]>([])
  const speakingRef = useRef(false)
  const silenceStartRef = useRef<number | null>(null)
  const speechStartRef = useRef<number | null>(null)

  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd
  }, [onSpeechEnd])

  const flush = useCallback(() => {
    const chunks = chunksRef.current
    chunksRef.current = []
    speakingRef.current = false
    silenceStartRef.current = null
    speechStartRef.current = null
    setSpeaking(false)

    if (!chunks.length) return
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const ctx = ctxRef.current
    const sampleRate = ctx?.sampleRate ?? VAD_SAMPLE_RATE
    const minSamples = Math.floor(sampleRate * 0.25)
    if (total < minSamples) return

    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    const pcm16k = downsample(merged, sampleRate, VAD_SAMPLE_RATE)
    onSpeechEndRef.current(pcm16k)
  }, [])

  const teardown = useCallback(() => {
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    gainRef.current?.disconnect()
    processorRef.current = null
    sourceRef.current = null
    gainRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    void ctxRef.current?.close()
    ctxRef.current = null

    chunksRef.current = []
    speakingRef.current = false
    silenceStartRef.current = null
    speechStartRef.current = null
    listeningRef.current = false
    setListening(false)
    setSpeaking(false)
    setLevel(0)
  }, [])

  const listeningRef = useRef(false)

  const start = useCallback(async () => {
    if (listeningRef.current) return
    setLoading(true)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        }
      })
      streamRef.current = stream

      const ctx = new AudioContext()
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      ctxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      const gain = ctx.createGain()
      gain.gain.value = 0

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const frame = new Float32Array(input)
        const energy = rms(frame)
        setLevel(energy)
        const now = Date.now()

        if (energy > SILENCE_THRESHOLD) {
          if (!speakingRef.current) {
            speakingRef.current = true
            speechStartRef.current = now
            setSpeaking(true)
          }
          silenceStartRef.current = null
          chunksRef.current.push(frame)
          return
        }

        if (!speakingRef.current) return

        chunksRef.current.push(frame)
        if (!silenceStartRef.current) silenceStartRef.current = now

        const silenceDur = now - silenceStartRef.current
        const speechDur = now - (speechStartRef.current ?? now)
        if (
          (silenceDur >= SILENCE_MS && speechDur >= MIN_SPEECH_MS) ||
          speechDur >= MAX_SPEECH_MS
        ) {
          flush()
        }
      }

      source.connect(processor)
      processor.connect(gain)
      gain.connect(ctx.destination)

      sourceRef.current = source
      processorRef.current = processor
      gainRef.current = gain
      listeningRef.current = true
      setListening(true)
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      if (/denied|not allowed|permission/i.test(msg)) {
        setError(
          'Microphone access denied. Allow mic for MeetMind in Windows Settings → Privacy → Microphone.'
        )
      } else if (/not found|no device/i.test(msg)) {
        setError('No microphone found. Plug in a mic and try again.')
      } else {
        setError(`Could not start microphone: ${msg}`)
      }
      teardown()
    } finally {
      setLoading(false)
    }
  }, [flush, teardown])

  const pause = useCallback(() => {
    flush()
    teardown()
  }, [flush, teardown])

  const toggle = useCallback(async () => {
    if (listening) pause()
    else await start()
  }, [listening, pause, start])

  const startRef = useRef(start)
  startRef.current = start

  useEffect(() => {
    if (autoStart) void startRef.current()
    return () => {
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { listening, speaking, level, error, loading, start, pause, toggle }
}
