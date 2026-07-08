# MindTree

**MindTree** is a desktop AI exam assistant built with **Electron + React + TypeScript**. It watches your screen, reads assessment questions with vision AI, and shows answers instantly — MCQ letters or full coding solutions.

---

## Features

- **Live screen scan** — automatically captures your display every ~2 seconds and detects new questions
- **Direct answers** — MCQ returns only the correct option (e.g. `B`); coding problems return a complete solution in a code block
- **Vision AI** — Groq Llama 4 Scout (free tier) reads screenshots; OpenRouter / Anthropic fallbacks supported
- **Optional voice** — ElevenLabs text-to-speech can read answers aloud (toggle **Voice** in the panel)
- **Click-through overlay** — **Pass** mode ON by default; hold **Ctrl+Shift** to interact with the panel
- **Capture-safe overlay** — on Windows the overlay is excluded from screen capture so it does not block question detection
- **Exam mode** — tuned for 22-question assessments (20 MCQ Math/ML + 2 DSA coding)

---

## Hotkeys

| Shortcut | Action |
| -------- | ------ |
| `Ctrl+Shift+A` | Scan screen now |
| `Ctrl+Shift+S` | Force rescan |
| `Ctrl+Shift+C` | Clear session |
| `Ctrl+Shift+Space` | Hide / show overlay |
| `Ctrl+Shift` (hold) | Interact with overlay when Pass mode is on |

On macOS, `Ctrl` maps to `Cmd`.

---

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Desktop | Electron 42, electron-vite |
| UI | React 18, TypeScript, Tailwind CSS |
| Screen capture | Electron `desktopCapturer` |
| Vision + answers | Groq, OpenRouter, Anthropic |
| Speech-to-text (optional) | Groq Whisper, Hugging Face, OpenAI |
| Text-to-speech (optional) | ElevenLabs |
| VAD | `@ricky0123/vad-web` |

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/omwankar/mindtree.git
cd mindtree
npm install
```

### 2. Configure API keys

Copy the example env file and add your keys:

```bash
cp .env.example .env
```

| Key | Purpose | Get it from |
| --- | ------- | ----------- |
| `GROQ_API_KEY` | Screen vision + Whisper STT (recommended) | [console.groq.com](https://console.groq.com/keys) |
| `ELEVENLABS_API_KEY` | Optional spoken answers | [elevenlabs.io](https://elevenlabs.io) |
| `OPENROUTER_API_KEY` | Optional Claude/Gemini fallback | [openrouter.ai](https://openrouter.ai/keys) |
| `ANTHROPIC_API_KEY` | Optional Claude direct | [console.anthropic.com](https://console.anthropic.com/) |

You can also enter keys in the in-app **Settings** panel (stored locally in AppData).

> **Never commit `.env`** — it is gitignored. Only `.env.example` with empty placeholders is tracked.

### 3. Run

```bash
npm run dev
```

Open your exam question on screen — the answer appears automatically in the overlay.

### 4. Build installer (Windows)

```bash
npm run package
```

Output: `release/MindTree Setup 1.0.0.exe` (product name from electron-builder config).

---

## How it works

```
Screen → capture → Groq vision → answer on overlay
                              ↘ optional ElevenLabs TTS → speaker
```

1. **Auto-scan** runs on app start (every ~2 s).
2. The vision model reads the visible MCQ or coding problem.
3. **MCQ** → single letter/option only.
4. **Coding** → fenced code block (Python 3 default).
5. Move to the next question → fingerprint change triggers a new scan.

---

## Project structure

```
src/
  main/
    index.ts           # Electron main, IPC
    ai.ts              # Vision + streaming answers
    elevenlabs.ts      # ElevenLabs TTS
    screenCapture.ts   # Primary display capture
    settings.ts        # Local settings + API keys
    overlay.ts         # Capture-exclusion overlay (Windows)
  renderer/src/
    App.tsx            # Main UI
    hooks/
      useScreenWatch.ts    # Auto-scan loop
      useElevenLabsTts.ts  # Audio playback
      useAIAnswer.ts       # Streamed answers
  shared/
    prompts.ts         # Exam / screen prompts
    examKnowledge.ts   # 22-question format hints
    ttsUtils.ts        # Text shaping for TTS
```

---

## Privacy & API usage

- API keys stay on your machine (`.env` or app Settings).
- Screen images are sent only to your configured AI provider for question reading.
- ElevenLabs receives only the short answer text when **Voice** is enabled.
- Use responsibly and comply with your institution's or employer's policies.

---

## License

MIT — see repository for details.

---

## Author

[omwankar](https://github.com/omwankar)
