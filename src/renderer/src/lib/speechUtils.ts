/**
 * Downsample mono PCM using box averaging (better for speech than nearest-neighbor).
 */
export function downsampleAudio(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const outLen = Math.floor(buffer.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(buffer.length, Math.floor((i + 1) * ratio))
    let sum = 0
    let count = 0
    for (let j = start; j < end; j++) {
      sum += buffer[j]
      count++
    }
    out[i] = count > 0 ? sum / count : 0
  }
  return out
}

/** Boost quiet speech so Whisper picks it up more reliably. */
export function normalizeAudio(samples: Float32Array): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]))
  }
  if (peak < 0.01) return samples
  const gain = Math.min(4, 0.85 / peak)
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

/** Drop common Whisper false positives on short/silent clips. */
export function isLikelyHallucination(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length < 2) return true
  return /^(thank you\.?|thanks for watching\.?|subscribe\.?|you\.?|\.+|…+)$/.test(t) ||
    /\b(subtitles? by|amara\.org|copyright)\b/.test(t)
}
