/**
 * Copies VAD + ONNX runtime assets into the renderer public folder so
 * AudioWorklet and WASM load same-origin (required in Electron).
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vadSrc = join(root, 'node_modules/@ricky0123/vad-web/dist')
const ortSrc = join(root, 'node_modules/onnxruntime-web/dist')
const outVad = join(root, 'src/renderer/public/vad')
const outOrt = join(outVad, 'ort')

function copy(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[setup:vad] missing: ${src}`)
    return
  }
  copyFileSync(src, dest)
}

mkdirSync(outOrt, { recursive: true })

const vadFiles = [
  'vad.worklet.bundle.min.js',
  'silero_vad_legacy.onnx',
  'silero_vad_v5.onnx'
]
for (const f of vadFiles) {
  copy(join(vadSrc, f), join(outVad, f))
}

const ortFiles = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']
for (const f of ortFiles) {
  copy(join(ortSrc, f), join(outOrt, f))
}

console.log('[setup:vad] VAD assets copied to src/renderer/public/vad/')
