/**
 * Prompts for Concentrix Data Engineer interview mode (Vishal Morey).
 */

import type { AssistMode } from './types'
import { clarifyInterviewerQuestion } from './interviewCue'
import {
  CANDIDATE_CONTEXT,
  INTERVIEW_ANSWER_RULES,
  MINERVA_COMPANY_CONTEXT
} from './minervaKnowledge'

const FORMAT_LOCK = `Speak as Vishal Morey. Three prose paragraphs, no headings:
1) concept + how it works (source and target if relevant)
2) Mattress Firm / Impetus example + honest gap
3) why it matters for migration quality
Never **Definition:** **How it works:** **Example:** **Why it matters:** Never apologize.`

const INTERVIEW_KNOWLEDGE = `${INTERVIEW_ANSWER_RULES}\n\n${FORMAT_LOCK}\n\n${MINERVA_COMPANY_CONTEXT}\n\n${CANDIDATE_CONTEXT}\n\n${FORMAT_LOCK}`

export const SUGGESTION_SYSTEM_PROMPT = INTERVIEW_KNOWLEDGE

export const ACTION_ITEM_SYSTEM_PROMPT = `Return ONLY a JSON array of action-item strings, or [] if none.`

const SCREEN_INTERVIEW_PROMPT = `${INTERVIEW_KNOWLEDGE}

You read interview questions from a screenshot (video call captions, shared doc, coding challenge, chat, or notes).

1. Identify the interviewer's question or coding problem on screen.
2. Answer as Vishal Morey using the knowledge above.
3. Technical → three spoken paragraphs: concept, project example, why it matters.
4. Live coding → fenced code first, then two sentences.
5. If no readable question → exactly: NO_QUESTION

Do NOT describe the screenshot.`

const MEETING_INTERVIEW_PROMPT = `${INTERVIEW_KNOWLEDGE}

The interviewer spoke a question (transcript below). Answer as Vishal Morey in three spoken paragraphs: concept, project, why it matters.`

/** System prompt tuned for each assistance mode. */
const MODE_SYSTEM_PROMPTS: Record<AssistMode, string> = {
  assist: INTERVIEW_KNOWLEDGE,
  meeting: MEETING_INTERVIEW_PROMPT,
  say: INTERVIEW_KNOWLEDGE,
  followup: INTERVIEW_KNOWLEDGE,
  recap: INTERVIEW_KNOWLEDGE,
  custom: `${INTERVIEW_KNOWLEDGE}

The user pasted an interview question. Three spoken paragraphs: concept, project, why it matters.`,
  screen: SCREEN_INTERVIEW_PROMPT,
  review: `${INTERVIEW_KNOWLEDGE}

Review code on screen for a technical interview.
- If correct → exactly: CODE_OK
- If wrong → corrected code in one fenced block + brief fix notes
- If no code → exactly: NO_CODE`
}

export function systemPromptForMode(mode: AssistMode = 'assist'): string {
  return MODE_SYSTEM_PROMPTS[mode] ?? INTERVIEW_KNOWLEDGE
}

function transcriptBlock(context: string, recentTranscript: string[]): string {
  const transcript = recentTranscript.length
    ? recentTranscript.map((line) => clarifyInterviewerQuestion(line)).join('\n')
    : '(no transcript)'
  if (context.trim()) {
    return `Notes:\n${context.trim()}\n\nTranscript:\n${transcript}`
  }
  return `Transcript:\n${transcript}`
}

export function buildSuggestionUserPrompt(context: string, recentTranscript: string[]): string {
  return `${transcriptBlock(context, recentTranscript)}\n\nThree spoken paragraphs: concept, project example, why it matters. No headings.`
}

export function buildModeUserPrompt(
  mode: AssistMode,
  context: string,
  recentTranscript: string[],
  question?: string
): string {
  const base = transcriptBlock(context, recentTranscript)
  switch (mode) {
    case 'meeting':
      return `${base}\n\nQuestion to answer (speech already corrected):\n${clarifyInterviewerQuestion(question?.trim() || extractLastInterviewerLine(recentTranscript) || '') || '(identify from transcript)'}\n\nThree spoken paragraphs: (1) concept and how it works (2) CV project + honest gap (3) why it matters. No headings. Do not mention mishearing.`
    case 'screen':
      return `Screenshot attached. Read the visible interview question. Answer as Vishal Morey in three spoken paragraphs: concept, project, why it matters. If nothing readable → NO_QUESTION.`
    case 'custom':
      return `Question to answer:\n${clarifyInterviewerQuestion(question?.trim() || '') || '(empty)'}\n\nThree spoken paragraphs: concept, project, why it matters. No headings. No apology.`
    case 'review':
      return `Screenshot attached. Review SQL/Python/PySpark for a data engineering interview. CODE_OK or corrected code or NO_CODE.`
    case 'say':
    case 'followup':
    case 'recap':
    case 'assist':
    default:
      return `${base}\n\nThree spoken paragraphs as Vishal Morey: concept, project, why it matters. No headings.`
  }
}

function extractLastInterviewerLine(lines: string[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (/^(Interviewer|Others|Meeting):/i.test(line)) {
      return line.replace(/^(Interviewer|Others|Meeting):\s*/i, '').trim()
    }
  }
  const last = lines[lines.length - 1]
  return last?.replace(/^(You|Interviewer|Others):\s*/i, '').trim() ?? ''
}

export function buildActionItemUserPrompt(text: string): string {
  return `Extract action items:\n\n${text}`
}
