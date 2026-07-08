import { RESUME_TOPIC_KEYWORDS } from '@shared/resumeKnowledge'

/** Detect whether transcribed speech contains a question. */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length < 4) return false
  if (t.endsWith('?')) return true
  if (
    /^(who|what|when|where|why|how|which|can|could|would|should|do|does|did|is|are|will|have|has|tell|explain|describe|walk|share|talk)\b/.test(
      t
    )
  ) {
    return true
  }
  if (
    /\b(what do you think|can you|could you|would you|do you know|any idea|how do you|what is|what are|walk me through|help me understand|tell me about|describe a time|give me an example|have you ever|why did you|why should we|why transition|why move|why join|why leave|tell us about yourself|about your experience|about your background|about your role|about the project|about champagne|about dehaat|about mrfr|about clear edge|market sizing|go to market|gtm|benchmark|swot|porter|pestle|value chain|power bi|capital iq|factiva|prompt engineering|star method|supply chain|market entry|thought leadership|client management|data triangulation|so what|roi|research project|competitive landscape|market intelligence)\b/.test(
      t
    )
  ) {
    return true
  }
  return RESUME_TOPIC_KEYWORDS.some((kw) => t.includes(kw))
}

/** Pull the latest question-like line from formatted transcript rows. */
export function extractLatestQuestion(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = lines[i].replace(/^(You|Meeting|Interviewer|Others):\s*/i, '').trim()
    if (looksLikeQuestion(text)) return text
  }
  return undefined
}
