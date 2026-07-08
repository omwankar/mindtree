/**
 * Centralized prompts for MeetMind assessment mode.
 */

import type { AssistMode } from './types'
import { EXAM_CONTEXT } from './examKnowledge'

export const SUGGESTION_SYSTEM_PROMPT = `You are a helpful assistant.`

export const ACTION_ITEM_SYSTEM_PROMPT = `Return ONLY a JSON array of action-item strings, or [] if none.`

const SCREEN_EXAM_PROMPT = `You read assessment questions from a screenshot. The exam has 22 questions: 20 MCQ (Mathematics + Machine Learning) and 2 DSA coding problems.

${EXAM_CONTEXT}

Detect question type from the screenshot:

▸ MCQ (multiple choice — options A/B/C/D or 1/2/3/4):
1. Read the FULL question and EVERY option carefully.
2. Solve using correct math or ML theory (show work internally; do not output steps).
3. Reply with ONLY the correct option — e.g. "B" or "C) Gradient descent". Nothing else — no explanation, no preamble.

▸ CODING (problem statement with constraints, examples, function signature):
1. Read the full problem, constraints, and required language.
2. Write a correct, efficient DSA solution.
3. Reply with ONLY the complete solution in ONE fenced code block. Use the language shown (default Python 3). Match the exact function/class signature on screen.
4. No explanation before or after the code block.

▸ If the screen shows no clear question, loading page, or is unreadable → exactly: NO_QUESTION

Never describe the screenshot. Output only the MCQ option OR the code block OR NO_QUESTION.`

/** System prompt tuned for each assistance mode. */
const MODE_SYSTEM_PROMPTS: Record<AssistMode, string> = {
  assist: SUGGESTION_SYSTEM_PROMPT,
  meeting: SCREEN_EXAM_PROMPT,
  say: SUGGESTION_SYSTEM_PROMPT,
  followup: SUGGESTION_SYSTEM_PROMPT,
  recap: SUGGESTION_SYSTEM_PROMPT,
  custom: `${SCREEN_EXAM_PROMPT}

The user pasted question text below instead of a screenshot. Apply the same MCQ or coding rules.`,
  screen: SCREEN_EXAM_PROMPT,
  review: `You review code the user typed on screen for a DSA assessment problem.

- If correct → exactly: CODE_OK
- If wrong → COMPLETE corrected code in one fenced block (same language/signature). Minimal "// fix:" on changed lines only.
- If no code visible → exactly: NO_CODE`
}

export function systemPromptForMode(mode: AssistMode = 'assist'): string {
  return MODE_SYSTEM_PROMPTS[mode] ?? SUGGESTION_SYSTEM_PROMPT
}

function transcriptBlock(context: string, recentTranscript: string[]): string {
  const transcript = recentTranscript.length
    ? recentTranscript.join('\n')
    : '(no transcript)'
  if (context.trim()) {
    return `Notes:\n${context.trim()}\n\nTranscript:\n${transcript}`
  }
  return `Transcript:\n${transcript}`
}

export function buildSuggestionUserPrompt(context: string, recentTranscript: string[]): string {
  return `${transcriptBlock(context, recentTranscript)}\n\nGive helpful talking points.`
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
    case 'screen':
      return `Screenshot attached. Read the visible MCQ or coding problem. MCQ → only the correct option letter/text. Coding → only complete solution code in one fenced block. If nothing readable → NO_QUESTION.`
    case 'custom':
      return `Pasted question:\n${question?.trim() || '(empty)'}\n\nMCQ → only correct option. Coding → only complete code in one fenced block.`
    case 'review':
      return `Screenshot attached. Review typed code. CODE_OK or corrected code block or NO_CODE.`
    case 'say':
    case 'followup':
    case 'recap':
    case 'assist':
    default:
      return `${base}\n\nHelp with the assessment question.`
  }
}

export function buildActionItemUserPrompt(text: string): string {
  return `Extract action items:\n\n${text}`
}
