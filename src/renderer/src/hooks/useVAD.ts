import { useCallback, useEffect, useRef, useState } from 'react'

import { MicVAD } from '@ricky0123/vad-web'

import { rms } from '@/lib/audioCapture'



/** Same-origin asset URLs — AudioWorklet/WASM fail when loaded cross-origin in Electron. */

function vadAssetBase(): string {

  return new URL('vad/', window.location.href).href

}



function ortWasmBase(): string {

  return new URL('vad/ort/', window.location.href).href

}



interface UseVADOptions {

  onSpeechEnd: (audio: Float32Array) => void

  /** Start listening automatically when the hook mounts. */

  autoStart?: boolean

}



interface UseVADResult {

  listening: boolean

  speaking: boolean

  level: number

  error: string | null

  loading: boolean

  start: () => Promise<void>

  pause: () => void

  toggle: () => Promise<void>

}



export function useVAD({ onSpeechEnd, autoStart = true }: UseVADOptions): UseVADResult {

  const vadRef = useRef<MicVAD | null>(null)

  const onSpeechEndRef = useRef(onSpeechEnd)

  const [listening, setListening] = useState(false)

  const [speaking, setSpeaking] = useState(false)

  const [level, setLevel] = useState(0)

  const [error, setError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)



  useEffect(() => {

    onSpeechEndRef.current = onSpeechEnd

  }, [onSpeechEnd])



  const ensureVad = useCallback(async (): Promise<MicVAD | null> => {

    if (vadRef.current) return vadRef.current

    setLoading(true)

    setError(null)

    try {

      // Pre-flight: fail fast with a clear message if mic access is denied.

      const probe = await navigator.mediaDevices.getUserMedia({

        audio: { channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true }

      })

      probe.getTracks().forEach((t) => t.stop())



      const vad = await MicVAD.new({

        baseAssetPath: vadAssetBase(),

        onnxWASMBasePath: ortWasmBase(),

        model: 'legacy',

        positiveSpeechThreshold: 0.4,

        negativeSpeechThreshold: 0.25,

        minSpeechMs: 300,

        redemptionMs: 1200,

        onSpeechStart: () => setSpeaking(true),

        onFrameProcessed: (_probs, frame) => setLevel(rms(frame)),

        onSpeechEnd: (audio: Float32Array) => {

          setSpeaking(false)

          setLevel(0)

          onSpeechEndRef.current(audio)

        },

        onVADMisfire: () => {

          setSpeaking(false)

          setLevel(0)

        }

      })

      vadRef.current = vad

      return vad

    } catch (err) {

      const msg = (err as Error).message ?? String(err)

      if (/denied|not allowed|permission/i.test(msg)) {

        setError('Microphone access denied. Allow mic for MeetMind in Windows Settings → Privacy → Microphone.')

      } else if (/not found|no device/i.test(msg)) {

        setError('No microphone found. Plug in a mic and try again.')

      } else {

        setError(`Could not start microphone: ${msg}`)

      }

      return null

    } finally {

      setLoading(false)

    }

  }, [])



  const start = useCallback(async () => {

    const vad = await ensureVad()

    if (!vad) return

    try {

      await vad.start()

      setListening(true)

      setError(null)

    } catch (err) {

      setError(`Failed to start listening: ${(err as Error).message}`)

      setListening(false)

    }

  }, [ensureVad])



  const pause = useCallback(() => {

    try {

      vadRef.current?.pause()

    } catch {

      /* ignore */

    }

    setListening(false)

    setSpeaking(false)

    setLevel(0)

  }, [])



  const toggle = useCallback(async () => {

    if (listening) pause()

    else await start()

  }, [listening, pause, start])



  const startRef = useRef(start)
  startRef.current = start

  useEffect(() => {
    if (autoStart) void startRef.current()
    return () => {
      try {
        vadRef.current?.destroy()
      } catch {
        /* ignore */
      }
      vadRef.current = null
    }
  }, [autoStart])



  return { listening, speaking, level, error, loading, start, pause, toggle }

}


