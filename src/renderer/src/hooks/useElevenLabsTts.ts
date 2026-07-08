import { useCallback, useEffect, useRef, useState } from 'react'
import { textForSpeech } from '@shared/ttsUtils'

interface UseElevenLabsTtsResult {
  speaking: boolean
  speakAnswer: (answer: string) => Promise<void>
  stop: () => void
}

export function useElevenLabsTts(enabled: boolean): UseElevenLabsTtsResult {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setSpeaking(false)
  }, [])

  useEffect(() => () => stop(), [stop])

  const speakAnswer = useCallback(
    async (answer: string) => {
      if (!enabled) return
      const text = textForSpeech(answer)
      if (!text) return

      stop()
      setSpeaking(true)

      try {
        const result = await window.api.speakText(answer)
        if (result.error || !result.audioBase64) {
          console.warn('[tts]', result.error ?? 'Empty audio')
          setSpeaking(false)
          return
        }

        const bytes = Uint8Array.from(atob(result.audioBase64), (c) => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: result.mimeType || 'audio/mpeg' })
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url

        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => {
          stop()
        }
        audio.onerror = () => {
          console.warn('[tts] playback failed')
          stop()
        }
        await audio.play()
      } catch (err) {
        console.warn('[tts]', err)
        setSpeaking(false)
      }
    },
    [enabled, stop]
  )

  return { speaking, speakAnswer, stop }
}
