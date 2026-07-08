import { useEffect, useState } from 'react'
import type { AiProvider, AppSettings, SttProvider } from '@shared/types'

const STT_PROVIDERS: { value: SttProvider; label: string }[] = [
  { value: 'auto', label: 'Auto (Groq → Hugging Face → OpenAI → OpenRouter)' },
  { value: 'groq', label: 'Groq — free Whisper' },
  { value: 'huggingface', label: 'Hugging Face — free Whisper' },
  { value: 'openai', label: 'OpenAI Whisper (paid)' },
  { value: 'openrouter', label: 'OpenRouter audio (needs $0.50+ balance)' }
]

const AI_PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'auto', label: 'Auto (Groq free → OpenRouter → Anthropic)' },
  { value: 'groq', label: 'Groq — Llama 4 Scout (free, vision)' },
  { value: 'openrouter', label: 'OpenRouter — Claude / Gemini' },
  { value: 'anthropic', label: 'Anthropic — Claude direct' }
]

interface SettingsProps {
  open: boolean
  initial: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => void
}

const LANGUAGES: { code: string; label: string }[] = [
  { code: '', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' }
]

export function Settings({ open, initial, onClose, onSave }: SettingsProps): JSX.Element | null {
  const [form, setForm] = useState<AppSettings>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  if (!open) return null

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="no-drag absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-[13px] font-semibold text-white">Settings</span>
        <button
          onClick={onClose}
          className="w-6 h-6 grid place-items-center rounded text-white/60 hover:text-white hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-[12px]">
        <Field label="Speech-to-text provider">
          <select
            value={form.sttProvider}
            onChange={(e) => update('sttProvider', e.target.value as SttProvider)}
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          >
            {STT_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value} className="bg-zinc-900">
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          For free testing, use Groq or Hugging Face below. OpenRouter audio requires paid balance.
        </p>

        <Field label="AI answers provider (chat + screen vision)">
          <select
            value={form.aiProvider}
            onChange={(e) => update('aiProvider', e.target.value as AiProvider)}
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value} className="bg-zinc-900">
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          Groq is free and answers screen questions with Llama 4 Scout vision — one key covers both
          speech and AI answers.
        </p>

        <Field label="Groq API key (free STT — recommended for testing)">
          <input
            type="password"
            value={form.groqApiKey}
            onChange={(e) => update('groqApiKey', e.target.value)}
            placeholder="gsk_…"
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          Free at console.groq.com — Whisper large v3, generous free tier.
        </p>

        <Field label="Hugging Face token (free STT alternative)">
          <input
            type="password"
            value={form.huggingfaceApiKey}
            onChange={(e) => update('huggingfaceApiKey', e.target.value)}
            placeholder="hf_…"
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          Free at huggingface.co/settings/tokens — rate-limited whisper-large-v3.
        </p>

        <Field label="OpenRouter API key (Claude chat — optional)">
          <input
            type="password"
            value={form.openRouterApiKey}
            onChange={(e) => update('openRouterApiKey', e.target.value)}
            placeholder="sk-or-v1-…"
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          Used for AI Assist when set. Not used for speech if Groq/HF keys exist.
        </p>

        <Field label="OpenAI API key (Whisper fallback)">
          <input
            type="password"
            value={form.openaiApiKey}
            onChange={(e) => update('openaiApiKey', e.target.value)}
            placeholder="sk-…"
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>

        <Field label="Anthropic API key (Claude)">
          <input
            type="password"
            value={form.anthropicApiKey}
            onChange={(e) => update('anthropicApiKey', e.target.value)}
            placeholder="sk-ant-…"
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>

        <Field label="ElevenLabs API key (text-to-speech)">
          <input
            type="password"
            value={form.elevenlabsApiKey}
            onChange={(e) => update('elevenlabsApiKey', e.target.value)}
            placeholder="sk_…"
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          Free tier at elevenlabs.io — speaks MCQ answers aloud (e.g. &quot;The answer is B&quot;).
        </p>

        <Field label="ElevenLabs voice ID">
          <input
            type="text"
            value={form.elevenlabsVoiceId}
            onChange={(e) => update('elevenlabsVoiceId', e.target.value)}
            placeholder="21m00Tcm4TlvDq8ikWAM"
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          Default is Rachel. Pick another voice ID from your ElevenLabs voice library.
        </p>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-white/80">Auto-speak answers (ElevenLabs)</span>
          <input
            type="checkbox"
            checked={form.ttsEnabled}
            onChange={(e) => update('ttsEnabled', e.target.checked)}
            className="accent-emerald-400 w-4 h-4"
          />
        </label>
        <p className="text-[11px] text-white/40 -mt-2">
          When on, each new answer is read aloud. Toggle Voice in the main panel anytime.
        </p>

        <Field label="Transcription language">
          <select
            value={form.language}
            onChange={(e) => update('language', e.target.value)}
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-zinc-900">
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-white/80">Screen watch (auto-answer on-screen questions)</span>
          <input
            type="checkbox"
            checked={form.screenWatchEnabled}
            onChange={(e) => update('screenWatchEnabled', e.target.checked)}
            className="accent-emerald-400 w-4 h-4"
          />
        </label>
        <p className="text-[11px] text-white/40 -mt-2">
          Periodically captures your screen and answers visible questions without asking you.
        </p>

        <Field label="Screen watch interval (seconds)">
          <input
            type="number"
            min={2}
            max={60}
            value={form.screenWatchIntervalSec}
            onChange={(e) =>
              update('screenWatchIntervalSec', Math.min(60, Math.max(2, Number(e.target.value) || 2)))
            }
            className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-white outline-none focus:border-accent"
          />
        </Field>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-white/80">Auto-detect questions (speech)</span>
          <input
            type="checkbox"
            checked={form.autoDetectQuestions}
            onChange={(e) => update('autoDetectQuestions', e.target.checked)}
            className="accent-emerald-400 w-4 h-4"
          />
        </label>
        <p className="text-[11px] text-white/40 -mt-2">
          When on, meeting questions are detected from speech and answered automatically.
        </p>

        <p className="text-[11px] text-white/40">
          Keys are stored locally in this app&apos;s data folder and never leave your machine except
          to call the configured API provider.
        </p>

        <div className="space-y-2 pt-1">
          <span className="block text-white/60">Keyboard shortcuts</span>
          <div className="rounded-md bg-black/30 border border-white/10 p-2.5 space-y-1.5 text-[11px] text-white/50">
            <div className="flex justify-between gap-3">
              <kbd className="text-white/70">Ctrl+Shift+Space</kbd>
              <span>Toggle overlay visibility</span>
            </div>
            <div className="flex justify-between gap-3">
              <kbd className="text-white/70">Ctrl+Shift+A</kbd>
              <span>Trigger Assist</span>
            </div>
            <div className="flex justify-between gap-3">
              <kbd className="text-white/70">Ctrl+Shift+S</kbd>
              <span>Scan screen now</span>
            </div>
            <div className="flex justify-between gap-3">
              <kbd className="text-white/70">Ctrl+Shift+C</kbd>
              <span>Clear session</span>
            </div>
            <div className="flex justify-between gap-3">
              <kbd className="text-white/70">Ctrl+Shift+↑ ↓ ← →</kbd>
              <span>Move overlay</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-3 py-2 border-t border-white/10">
        <button
          onClick={onClose}
          className="flex-1 py-1.5 rounded-md text-white/70 hover:bg-white/10 text-[12px]"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          className="flex-1 py-1.5 rounded-md bg-accent/90 hover:bg-accent text-black font-medium text-[12px]"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-1">
      <label className="block text-white/60">{label}</label>
      {children}
    </div>
  )
}
