export type Speaker = 'You' | 'Others'

export interface TranscriptSegment {
  id: string
  speaker: Speaker
  text: string
  /** epoch ms */
  timestamp: number
}

export interface ActionItem {
  id: string
  text: string
  /** epoch ms */
  createdAt: number
  done: boolean
}

/** Speech-to-text backend. "auto" prefers free providers (Groq → Hugging Face) before paid ones. */
export type SttProvider = 'auto' | 'groq' | 'huggingface' | 'openai' | 'openrouter'

/** AI answer backend. "auto" prefers free Groq, then OpenRouter, then Anthropic. */
export type AiProvider = 'auto' | 'groq' | 'openrouter' | 'anthropic'

export interface AppSettings {
  /** When set, used for Claude via OpenRouter (STT skipped when free STT keys exist). */
  openRouterApiKey: string
  openaiApiKey: string
  anthropicApiKey: string
  /** Free tier at console.groq.com — Whisper large v3. */
  groqApiKey: string
  /** Free tier at huggingface.co/settings/tokens — whisper-large-v3. */
  huggingfaceApiKey: string
  /** Which STT API to use. */
  sttProvider: SttProvider
  /** Which AI (chat/vision) API to use for answers. */
  aiProvider: AiProvider
  /** ISO-639-1 language code for Whisper, e.g. "en". Empty = auto-detect. */
  language: string
  /** When true, questions detected in the transcript auto-trigger a suggestion. */
  autoDetectQuestions: boolean
  /** Periodically capture the screen and auto-answer visible questions. */
  screenWatchEnabled: boolean
  /** Seconds between screen captures while watch is on. */
  screenWatchIntervalSec: number
  /** ElevenLabs API key for text-to-speech. */
  elevenlabsApiKey: string
  /** ElevenLabs voice ID (see elevenlabs.io/voice-library). */
  elevenlabsVoiceId: string
  /** Speak answers aloud via ElevenLabs when a new answer arrives. */
  ttsEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  groqApiKey: '',
  huggingfaceApiKey: '',
  sttProvider: 'auto',
  aiProvider: 'auto',
  language: 'en',
  autoDetectQuestions: false,
  screenWatchEnabled: true,
  screenWatchIntervalSec: 2,
  elevenlabsApiKey: '',
  elevenlabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
  ttsEnabled: false
}

/** The Cluely-style assistance modes the user can switch between. */
export type AssistMode =
  | 'assist'
  | 'meeting'
  | 'say'
  | 'followup'
  | 'recap'
  | 'custom'
  | 'screen'
  | 'review'

/** Payload sent to the main process to request a streamed Claude suggestion. */
export interface SuggestionRequest {
  /** Unique id so the renderer can correlate streamed tokens. */
  requestId: string
  /** Free-form meeting context the user pasted (agenda / topic / notes). */
  context: string
  /** The most recent transcript lines, oldest → newest. */
  recentTranscript: string[]
  /** Which assistance mode this request is for. Defaults to "assist". */
  mode?: AssistMode
  /** The user's free-form question (only used when mode === "custom"). */
  question?: string
  /** JPEG base64 (no data-URL prefix) for screen-watch / vision requests. */
  screenImageBase64?: string
}

export interface ScreenCaptureResult {
  imageBase64: string
  width: number
  height: number
  error?: string
}

export interface SuggestionTokenEvent {
  requestId: string
  token: string
}

export interface SuggestionDoneEvent {
  requestId: string
  fullText: string
}

export interface SuggestionErrorEvent {
  requestId: string
  message: string
}

export interface TranscribeResult {
  text: string
  error?: string
}

export interface SpeakResult {
  audioBase64: string
  mimeType: string
  error?: string
}

export interface SessionExport {
  transcript: TranscriptSegment[]
  suggestions: string[]
  actionItems: ActionItem[]
  context: string
}

/** IPC channel names shared between main and renderer. */
export const IPC = {
  transcribe: 'audio:transcribe',
  suggestionStart: 'ai:suggestion:start',
  suggestionToken: 'ai:suggestion:token',
  suggestionDone: 'ai:suggestion:done',
  suggestionError: 'ai:suggestion:error',
  extractActionItems: 'ai:action-items:extract',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  saveSession: 'session:save',
  exportMarkdown: 'session:export',
  windowMinimize: 'window:minimize',
  windowToggleExpand: 'window:toggle-expand',
  windowClose: 'window:close',
  /** true = clicks pass through to apps below; false = window captures clicks */
  setClickThrough: 'window:set-click-through',
  hotkeyToggle: 'hotkey:toggle',
  hotkeyTriggerAI: 'hotkey:trigger-ai',
  hotkeyClear: 'hotkey:clear',
  hotkeyExport: 'hotkey:export',
  hotkeyScreen: 'hotkey:screen',
  captureScreen: 'screen:capture',
  speakText: 'tts:speak'
} as const

/** Sentinel returned by the vision model when no question is visible. */
export const NO_QUESTION_SENTINEL = 'NO_QUESTION'
