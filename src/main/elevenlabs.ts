import { getElevenLabsKey, loadSettings } from './settings'
import type { SpeakResult } from '@shared/types'
import { textForSpeech } from '@shared/ttsUtils'

const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const DEFAULT_MODEL = 'eleven_turbo_v2_5'

export async function synthesizeSpeech(rawText: string): Promise<SpeakResult> {
  const apiKey = getElevenLabsKey()
  if (!apiKey) {
    return { audioBase64: '', mimeType: 'audio/mpeg', error: 'Missing ElevenLabs API key. Add it in Settings.' }
  }

  const text = textForSpeech(rawText)
  if (!text) {
    return { audioBase64: '', mimeType: 'audio/mpeg', error: 'Nothing to speak.' }
  }

  const { elevenlabsVoiceId } = loadSettings()
  const voiceId = elevenlabsVoiceId.trim() || '21m00Tcm4TlvDq8ikWAM'

  try {
    const res = await fetch(`${TTS_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true
        }
      })
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        audioBase64: '',
        mimeType: 'audio/mpeg',
        error: `ElevenLabs error (${res.status}): ${detail.slice(0, 200) || res.statusText}`
      }
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    return {
      audioBase64: buffer.toString('base64'),
      mimeType: res.headers.get('content-type') ?? 'audio/mpeg'
    }
  } catch (err) {
    return { audioBase64: '', mimeType: 'audio/mpeg', error: (err as Error).message }
  }
}
