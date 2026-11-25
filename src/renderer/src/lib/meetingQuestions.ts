import { MINERVA_TOPIC_KEYWORDS } from '@shared/minervaKnowledge'

/** Detect whether transcribed speech contains an interview question. */
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
    /\b(tell me about yourself|walk me through|help me understand|tell me about|describe a time|give me an example|have you ever|why did you|why should we|why this role|why join|why concentrix|about your experience|about your background|about your project|how would you|what is your experience|star method|data migration|etl|elt|azure data factory|databricks|dataverse|dynamics|py spark|pipeline)\b/.test(
      t
    )
  ) {
    return true
  }
  if (
    /\b(let's say|lets say|suppose|imagine|legacy crm|cutover|incremental load|full load|reconcile|source to target|how would you migrate|how would you handle)\b/.test(
      t
    )
  ) {
    return true
  }
  return MINERVA_TOPIC_KEYWORDS.some((kw) => t.includes(kw))
}

/** Pull the latest question-like line from formatted transcript rows. */
export function extractLatestQuestion(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = lines[i].replace(/^(You|Meeting|Interviewer|Others):\s*/i, '').trim()
    if (looksLikeQuestion(text)) return text
  }
  return undefined
}
