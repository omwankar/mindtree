import { getDeepSeekKey } from './settings'

export const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions'
export const DEEPSEEK_CHAT_MODEL = 'deepseek-chat'

export function isDeepSeekEnabled(): boolean {
  return Boolean(getDeepSeekKey())
}

export function deepSeekHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getDeepSeekKey()}`,
    'Content-Type': 'application/json'
  }
}
