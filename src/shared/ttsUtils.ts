/** Turn an on-screen AI answer into short spoken text for ElevenLabs. */
export function textForSpeech(answer: string): string {
  const trimmed = answer.trim()
  if (!trimmed) return ''

  if (/^no[_\s-]?question\.?$/i.test(trimmed)) return ''

  if (/```[\s\S]*```/.test(trimmed)) {
    return 'Coding solution is ready on screen.'
  }

  const mcq = trimmed.match(/^([A-D])(?:[\).:\s]|$)/i) ?? trimmed.match(/^([A-D])$/i)
  if (mcq) {
    return `The answer is ${mcq[1].toUpperCase()}.`
  }

  if (trimmed.length <= 80) return trimmed

  return trimmed.slice(0, 400)
}
