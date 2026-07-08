import { desktopCapturer, session, systemPreferences } from 'electron'

const AUDIO_PERMISSIONS = new Set(['media', 'microphone', 'audioCapture'])

function allowsAudioOnly(details: Electron.MediaAccessPermissionRequest): boolean {
  const types = details.mediaTypes
  if (!types?.length) return true
  return types.includes('audio') && !types.includes('video')
}

/**
 * Wires mic + meeting (system loopback) capture permissions for the renderer.
 * Meeting audio on Windows uses desktopCapturer loopback via getDisplayMedia.
 */
export async function setupAudioCapture(): Promise<void> {
  session.defaultSession.setPermissionCheckHandler((_wc, permission, _origin, details) => {
    if (permission !== 'media') return AUDIO_PERMISSIONS.has(permission)
    if (details.mediaType === 'video') return false
    return details.mediaType === 'audio' || details.mediaType === 'unknown' || !details.mediaType
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission === 'media') {
      callback(allowsAudioOnly(details as Electron.MediaAccessPermissionRequest))
      return
    }
    callback(AUDIO_PERMISSIONS.has(permission))
  })

  // Auto-provide primary screen + system audio loopback (no picker dialog).
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 }
      })
      const screen = sources[0]
      if (!screen) {
        callback({})
        return
      }
      if (process.platform === 'win32' || process.platform === 'linux') {
        callback({ video: screen, audio: 'loopback' })
      } else {
        // macOS has no WASAPI-style loopback — still attach screen for getDisplayMedia.
        callback({ video: screen, audio: 'loopback' })
      }
    } catch (err) {
      console.error('[audioCapture] display media handler failed:', err)
      callback({})
    }
  }, { useSystemPicker: false })

  if (process.platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone')
      if (status !== 'granted') {
        await systemPreferences.askForMediaAccess('microphone')
      }
    } catch (err) {
      console.error('[audioCapture] mic permission request failed:', err)
    }
  }
}
