import { BrowserWindow } from 'electron'
import koffi from 'koffi'

/** WDA_EXCLUDEFROMCAPTURE — omitted from capture; still visible on your monitor (Win10 2004+). */
const WDA_EXCLUDEFROMCAPTURE = 0x11

/** Extended window style index + tool-window flag (removes the window from Alt+Tab). */
const GWL_EXSTYLE = -20
const WS_EX_TOOLWINDOW = 0x00000080
const WS_EX_APPWINDOW = 0x00040000

/** Innocuous title so the window isn't obvious in a casual title/handle scan. */
const GENERIC_WINDOW_TITLE = ''

type SetWindowDisplayAffinityFn = (hwnd: unknown, affinity: number) => boolean
type GetWindowLongFn = (hwnd: unknown, index: number) => number | bigint
type SetWindowLongFn = (hwnd: unknown, index: number, value: number | bigint) => number | bigint

let setWindowDisplayAffinity: SetWindowDisplayAffinityFn | null = null
let getWindowLong: GetWindowLongFn | null = null
let setWindowLong: SetWindowLongFn | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    setWindowDisplayAffinity = user32.func(
      'bool __stdcall SetWindowDisplayAffinity(void * hWnd, uint32 dwAffinity)'
    )
    // *Ptr variants are 64-bit safe; they exist on all supported Windows builds.
    getWindowLong = user32.func(
      'int64 __stdcall GetWindowLongPtrW(void * hWnd, int nIndex)'
    ) as unknown as GetWindowLongFn
    setWindowLong = user32.func(
      'int64 __stdcall SetWindowLongPtrW(void * hWnd, int nIndex, int64 dwNewLong)'
    ) as unknown as SetWindowLongFn
  } catch (err) {
    console.warn('[overlay] native window hardening unavailable:', err)
  }
}

function nativeWindowHandle(win: BrowserWindow): unknown {
  return koffi.decode(win.getNativeWindowHandle(), 'void *')
}

/**
 * Removes the window from the Alt+Tab switcher by flipping it to a tool window.
 * Combined with `skipTaskbar`, this keeps it off the taskbar AND the task switcher.
 */
export function excludeFromAltTab(win: BrowserWindow): void {
  if (process.platform !== 'win32' || !getWindowLong || !setWindowLong) return
  if (win.isDestroyed()) return

  try {
    const hwnd = nativeWindowHandle(win)
    const current = BigInt(getWindowLong(hwnd, GWL_EXSTYLE) as number | bigint)
    const next = (current | BigInt(WS_EX_TOOLWINDOW)) & ~BigInt(WS_EX_APPWINDOW)
    setWindowLong(hwnd, GWL_EXSTYLE, next)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[overlay] excludeFromAltTab failed:', err)
    }
  }
}

/**
 * Keeps the overlay visible on your display but invisible to Zoom, OBS, Meet,
 * Teams, Game Bar, and other screen-capture software.
 */
export function applyCaptureProtection(win: BrowserWindow): void {
  if (win.isDestroyed()) return

  if (process.platform === 'win32') {
    // electron/electron#47834 — set any explicit opacity before content protection.
    win.setOpacity(win.getOpacity() > 0 ? win.getOpacity() : 1)

    // Toggle forces DWM to re-apply the capture-exclusion flag.
    win.setContentProtection(false)
    win.setContentProtection(true)

    if (setWindowDisplayAffinity) {
      const hwnd = nativeWindowHandle(win)
      const ok = setWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
      if (!ok && process.env.NODE_ENV === 'development') {
        console.warn('[overlay] SetWindowDisplayAffinity returned false for hwnd', hwnd)
      }
    }
  } else if (process.platform === 'darwin') {
    win.setContentProtection(true)
  }
}

/** Re-apply capture exclusion after show — DWM can drop the flag until paint completes. */
export function scheduleCaptureReinforcement(win: BrowserWindow): void {
  for (const ms of [0, 50, 150, 500, 1500]) {
    setTimeout(() => {
      if (!win.isDestroyed() && win.isVisible()) {
        applyCaptureProtection(win)
      }
    }, ms)
  }
}

/** Platform-specific BrowserWindow options for a local-only overlay. */
export function overlayWindowOptions(): Electron.BrowserWindowConstructorOptions {
  const base: Electron.BrowserWindowConstructorOptions = {
    title: GENERIC_WINDOW_TITLE,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    opacity: 1
  }

  if (process.platform === 'darwin') {
    return {
      ...base,
      type: 'panel',
      hiddenInMissionControl: true
    }
  }

  return base
}

/** Wire always-on-top, workspace visibility, and capture-exclusion lifecycle hooks. */
export function configureOverlayWindow(win: BrowserWindow): void {
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Keep the title innocuous even if the renderer tries to set document.title.
  win.setTitle(GENERIC_WINDOW_TITLE)
  win.on('page-title-updated', (e) => {
    e.preventDefault()
    win.setTitle(GENERIC_WINDOW_TITLE)
  })

  // macOS: don't surface in the app/window switcher list.
  if (process.platform === 'darwin') {
    win.setSkipTaskbar(true)
  }

  excludeFromAltTab(win)

  const reinforce = (): void => {
    if (win.isDestroyed()) return
    applyCaptureProtection(win)
    excludeFromAltTab(win)
    win.setAlwaysOnTop(true, 'screen-saver')
  }

  win.on('show', () => {
    reinforce()
    scheduleCaptureReinforcement(win)
  })
  win.on('focus', reinforce)
  win.on('blur', reinforce)
  win.on('restore', reinforce)
  win.on('move', reinforce)
  win.on('resize', reinforce)
  win.webContents.on('did-finish-load', reinforce)
  win.webContents.on('did-navigate', reinforce)
}
