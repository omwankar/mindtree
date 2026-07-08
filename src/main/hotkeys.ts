import { globalShortcut, BrowserWindow, screen } from 'electron'

import { IPC } from '@shared/types'



/** Pixels to move the overlay per hotkey press. */

const MOVE_STEP = 24



/**

 * Registers global hotkeys. We use Electron's built-in globalShortcut which is

 * cross-platform and dependency-free. Each hotkey forwards an event to the

 * renderer so the UI can react.

 */

export function registerHotkeys(getWindow: () => BrowserWindow | null): void {

  const send = (channel: string): void => {

    const win = getWindow()

    if (win && !win.isDestroyed()) {

      win.webContents.send(channel)

    }

  }



  globalShortcut.register('CommandOrControl+Shift+Space', () => {

    const win = getWindow()

    if (!win || win.isDestroyed()) return

    const visible = win.isVisible()

    if (visible) {

      win.hide()

    } else {

      win.show()

      win.focus()

    }

    send(IPC.hotkeyToggle)

  })



  globalShortcut.register('CommandOrControl+Shift+A', () => send(IPC.hotkeyTriggerAI))

  globalShortcut.register('CommandOrControl+Shift+C', () => send(IPC.hotkeyClear))

  globalShortcut.register('CommandOrControl+Shift+S', () => send(IPC.hotkeyScreen))



  globalShortcut.register('CommandOrControl+Shift+Left', () =>

    moveWindow(getWindow, -MOVE_STEP, 0)

  )

  globalShortcut.register('CommandOrControl+Shift+Right', () =>

    moveWindow(getWindow, MOVE_STEP, 0)

  )

  globalShortcut.register('CommandOrControl+Shift+Up', () =>

    moveWindow(getWindow, 0, -MOVE_STEP)

  )

  globalShortcut.register('CommandOrControl+Shift+Down', () =>

    moveWindow(getWindow, 0, MOVE_STEP)

  )

}



/** Nudge the overlay within the current display's work area. */

function moveWindow(

  getWindow: () => BrowserWindow | null,

  dx: number,

  dy: number

): void {

  const win = getWindow()

  if (!win || win.isDestroyed()) return



  const bounds = win.getBounds()

  const { workArea } = screen.getDisplayMatching(bounds)

  const maxX = workArea.x + workArea.width - bounds.width

  const maxY = workArea.y + workArea.height - bounds.height



  win.setPosition(

    Math.min(maxX, Math.max(workArea.x, bounds.x + dx)),

    Math.min(maxY, Math.max(workArea.y, bounds.y + dy))

  )

}



export function unregisterHotkeys(): void {

  globalShortcut.unregisterAll()

}


