import { desktopCapturer, screen } from 'electron'
import type { ScreenCaptureResult } from '@shared/types'

/** Max width sent to the vision model — plenty for reading on-screen text. */
const TARGET_WIDTH = 1280
const JPEG_QUALITY = 72

/** Captures the primary display as a JPEG (base64, no data-URL prefix). */
export async function capturePrimaryScreen(): Promise<ScreenCaptureResult> {
  try {
    const display = screen.getPrimaryDisplay()
    const { width, height } = display.size

    // Ask DWM for the scaled size directly — capturing at full (possibly 4K)
    // resolution and downscaling afterwards wastes CPU and IPC bandwidth.
    const scale = Math.min(1, TARGET_WIDTH / width)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale)
      }
    })

    if (sources.length === 0) {
      return { imageBase64: '', width: 0, height: 0, error: 'No screen sources found' }
    }

    const displayId = String(display.id)
    const source =
      sources.find((s) => s.display_id === displayId) ??
      sources.find((s) => /screen|display/i.test(s.name)) ??
      sources[0]

    const image = source.thumbnail
    const size = image.getSize()
    if (image.isEmpty() || size.width === 0 || size.height === 0) {
      return {
        imageBase64: '',
        width: 0,
        height: 0,
        error: 'Screen capture returned an empty image'
      }
    }

    return {
      imageBase64: image.toJPEG(JPEG_QUALITY).toString('base64'),
      width: size.width,
      height: size.height
    }
  } catch (err) {
    return { imageBase64: '', width: 0, height: 0, error: (err as Error).message }
  }
}
