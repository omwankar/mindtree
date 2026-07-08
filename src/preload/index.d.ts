import type { MeetMindApi } from './index'

declare global {
  interface Window {
    api: MeetMindApi
  }
}

export {}
