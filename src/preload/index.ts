import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import {
  AppSettings,
  IPC,
  SessionExport,
  SuggestionDoneEvent,
  SuggestionErrorEvent,
  SuggestionRequest,
  SuggestionTokenEvent,
  ScreenCaptureResult,
  TranscribeResult
} from '@shared/types'

const api = {
  transcribe(buffer: ArrayBuffer): Promise<TranscribeResult> {
    return ipcRenderer.invoke(IPC.transcribe, buffer)
  },

  captureScreen(): Promise<ScreenCaptureResult> {
    return ipcRenderer.invoke(IPC.captureScreen)
  },

  startSuggestion(req: SuggestionRequest): void {
    ipcRenderer.send(IPC.suggestionStart, req)
  },

  onSuggestionToken(cb: (e: SuggestionTokenEvent) => void): () => void {
    const handler = (_e: IpcRendererEvent, data: SuggestionTokenEvent): void => cb(data)
    ipcRenderer.on(IPC.suggestionToken, handler)
    return () => ipcRenderer.removeListener(IPC.suggestionToken, handler)
  },

  onSuggestionDone(cb: (e: SuggestionDoneEvent) => void): () => void {
    const handler = (_e: IpcRendererEvent, data: SuggestionDoneEvent): void => cb(data)
    ipcRenderer.on(IPC.suggestionDone, handler)
    return () => ipcRenderer.removeListener(IPC.suggestionDone, handler)
  },

  onSuggestionError(cb: (e: SuggestionErrorEvent) => void): () => void {
    const handler = (_e: IpcRendererEvent, data: SuggestionErrorEvent): void => cb(data)
    ipcRenderer.on(IPC.suggestionError, handler)
    return () => ipcRenderer.removeListener(IPC.suggestionError, handler)
  },

  extractActionItems(text: string): Promise<string[]> {
    return ipcRenderer.invoke(IPC.extractActionItems, text)
  },

  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC.getSettings)
  },

  saveSettings(settings: AppSettings): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC.saveSettings, settings)
  },

  saveSession(data: SessionExport): Promise<string> {
    return ipcRenderer.invoke(IPC.saveSession, data)
  },

  exportMarkdown(data: SessionExport): Promise<string> {
    return ipcRenderer.invoke(IPC.exportMarkdown, data)
  },

  minimize(): void {
    ipcRenderer.send(IPC.windowMinimize)
  },

  toggleExpand(): void {
    ipcRenderer.send(IPC.windowToggleExpand)
  },

  close(): void {
    ipcRenderer.send(IPC.windowClose)
  },

  /** When true, mouse clicks pass through to windows behind this overlay. */
  setClickThrough(passThrough: boolean): void {
    ipcRenderer.send(IPC.setClickThrough, passThrough)
  },

  onHotkey(
    which: 'toggle' | 'trigger-ai' | 'clear' | 'export' | 'screen',
    cb: () => void
  ): () => void {
    const channel =
      which === 'toggle'
        ? IPC.hotkeyToggle
        : which === 'trigger-ai'
          ? IPC.hotkeyTriggerAI
          : which === 'clear'
            ? IPC.hotkeyClear
            : which === 'screen'
              ? IPC.hotkeyScreen
              : IPC.hotkeyExport
    const handler = (): void => cb()
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type MeetMindApi = typeof api
