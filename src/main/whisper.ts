import { missingSttKeyMessage, resolveSttProvider, transcribeViaGroq } from './stt'
import type { TranscribeResult } from '@shared/types'

/** Transcribes a WAV clip with Groq Whisper. */
export async function transcribeAudio(audio: ArrayBuffer): Promise<TranscribeResult> {
  if (!resolveSttProvider()) {
    return { text: '', error: missingSttKeyMessage() }
  }
  return transcribeViaGroq(audio)
}
