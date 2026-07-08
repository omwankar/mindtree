import { BrowserWindow } from 'electron'
import koffi from 'koffi'

const POLL_MS = 40

/** Virtual-key codes (Windows). */
const VK_LCONTROL = 0xa2
const VK_RCONTROL = 0xa3
const VK_LSHIFT = 0xa0
const VK_RSHIFT = 0xa1

type GetAsyncKeyStateFn = (vk: number) => number

let getAsyncKeyState: GetAsyncKeyStateFn | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    getAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int vk)')
  } catch (err) {
    console.warn('[click-through] GetAsyncKeyState unavailable:', err)
  }
}

function ctrlShiftHeldNative(): boolean {
  if (!getAsyncKeyState) return false
  const down = (vk: number): boolean => (getAsyncKeyState!(vk) & 0x8000) !== 0
  const ctrl = down(VK_LCONTROL) || down(VK_RCONTROL)
  const shift = down(VK_LSHIFT) || down(VK_RSHIFT)
  return ctrl && shift
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let targetWin: BrowserWindow | null = null
let passThroughEnabled = true
let interacting = false

function applyMouseIgnore(win: BrowserWindow, ignore: boolean): void {
  if (win.isDestroyed()) return
  win.setIgnoreMouseEvents(ignore, { forward: true })
}

function syncFromModifiers(): void {
  const win = targetWin
  if (!win || win.isDestroyed()) return

  if (!passThroughEnabled) {
    if (interacting) {
      interacting = false
      applyMouseIgnore(win, false)
    }
    return
  }

  const hold = ctrlShiftHeldNative()
  if (hold === interacting) return
  interacting = hold
  applyMouseIgnore(win, !hold)
}

/**
 * When enabled, clicks pass through to apps below unless the user holds
 * Ctrl+Shift — then the overlay captures mouse input for that moment.
 */
export function setPassThroughEnabled(win: BrowserWindow | null, enabled: boolean): void {
  passThroughEnabled = enabled
  if (win && !win.isDestroyed()) {
    targetWin = win
  }

  const target = targetWin
  if (!target || target.isDestroyed()) return

  if (!enabled) {
    interacting = false
    applyMouseIgnore(target, false)
    return
  }

  interacting = false
  applyMouseIgnore(target, true)
  syncFromModifiers()
}

export function startModifierClickThrough(win: BrowserWindow): void {
  stopModifierClickThrough()
  targetWin = win
  passThroughEnabled = true
  interacting = false
  applyMouseIgnore(win, true)

  pollTimer = setInterval(syncFromModifiers, POLL_MS)
}

export function stopModifierClickThrough(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  targetWin = null
  interacting = false
}
