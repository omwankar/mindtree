import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { loadProjectEnv } from './env'

loadProjectEnv()
import { is } from '@electron-toolkit/utils'
import { setupAudioCapture } from './audioCapture'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import {
  configureOverlayWindow,
  overlayWindowOptions
} from './overlay'
import {
  setPassThroughEnabled,
  startModifierClickThrough,
  stopModifierClickThrough
} from './clickThrough'
import { transcribeAudio } from './whisper'
import { capturePrimaryScreen } from './screenCapture'
import { synthesizeSpeech } from './elevenlabs'
import { extractActionItems, streamSuggestion } from './ai'
import { loadSettings, saveSettings } from './settings'
import { exportMarkdown, saveSession } from './store'
import {
  AppSettings,
  IPC,
  SessionExport,
  SuggestionRequest
} from '@shared/types'

let mainWindow: BrowserWindow | null = null

// Compact floating card (control bar + 660px card), centered near the top.
const WINDOW_WIDTH = 700
const WINDOW_HEIGHT = 560
const COLLAPSED_HEIGHT = 96
let expanded = true

function createWindow(): void {
  const primary = screen.getPrimaryDisplay()
  const { width: screenW, x: workX, y: workY } = primary.workArea

  mainWindow = new BrowserWindow({
    ...overlayWindowOptions(),
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: workX + Math.round((screenW - WINDOW_WIDTH) / 2),
    y: workY + 24,
    resizable: false,
    movable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  configureOverlayWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (mainWindow) startModifierClickThrough(mainWindow)
  })

  mainWindow.on('closed', () => {
    stopModifierClickThrough()
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function registerIpc(): void {
  ipcMain.handle(IPC.transcribe, async (_e, buffer: ArrayBuffer) => {
    return transcribeAudio(buffer)
  })

  ipcMain.handle(IPC.captureScreen, async () => capturePrimaryScreen())

  ipcMain.handle(IPC.speakText, async (_e, text: string) => synthesizeSpeech(text))

  ipcMain.on(IPC.suggestionStart, (event, req: SuggestionRequest) => {
    const sender = event.sender
    void streamSuggestion(req, {
      onToken: (token) =>
        sender.send(IPC.suggestionToken, { requestId: req.requestId, token }),
      onDone: (fullText) =>
        sender.send(IPC.suggestionDone, { requestId: req.requestId, fullText }),
      onError: (message) =>
        sender.send(IPC.suggestionError, { requestId: req.requestId, message })
    })
  })

  ipcMain.handle(IPC.extractActionItems, async (_e, text: string) => {
    return extractActionItems(text)
  })

  ipcMain.handle(IPC.getSettings, async () => loadSettings())
  ipcMain.handle(IPC.saveSettings, async (_e, settings: AppSettings) =>
    saveSettings(settings)
  )

  ipcMain.handle(IPC.saveSession, async (_e, data: SessionExport) => saveSession(data))
  ipcMain.handle(IPC.exportMarkdown, async (_e, data: SessionExport) => {
    const path = exportMarkdown(data)
    return path
  })

  ipcMain.on(IPC.windowMinimize, () => mainWindow?.minimize())
  ipcMain.on(IPC.windowClose, () => mainWindow?.close())
  ipcMain.on(IPC.windowToggleExpand, () => {
    if (!mainWindow) return
    expanded = !expanded
    mainWindow.setBounds({ height: expanded ? WINDOW_HEIGHT : COLLAPSED_HEIGHT })
  })

  ipcMain.on(IPC.setClickThrough, (_e, passThrough: boolean) => {
    setPassThroughEnabled(mainWindow, passThrough)
  })
}

app.whenReady().then(async () => {
  app.setName('MeetMind')
  await setupAudioCapture()
  registerIpc()
  createWindow()
  registerHotkeys(getWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  stopModifierClickThrough()
  unregisterHotkeys()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
