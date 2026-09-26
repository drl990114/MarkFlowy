import type { ResolvedTheme, ThemeTokenName } from '@markflowy/theme/semantic'

export const PREVIEW_CHANNEL = 'mf-theme-preview-v1'
export interface ThemePreviewLabels {
  preview: string
  loadError: string
  error: string
  retry: string
}
export interface ThemePreviewState {
  theme: ResolvedTheme
  snippets: readonly { id: string; css: string }[]
  inspect: boolean
  labels: ThemePreviewLabels
}
export type PreviewMessage =
  | { channel: typeof PREVIEW_CHANNEL; session: string; type: 'hello' | 'ready' | 'connect' }
  | { channel: typeof PREVIEW_CHANNEL; session: string; type: 'update'; state: ThemePreviewState }
  | { channel: typeof PREVIEW_CHANNEL; session: string; type: 'inspect'; token: ThemeTokenName }

export function isPreviewMessage(value: unknown, session: string): value is PreviewMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return (
    message.channel === PREVIEW_CHANNEL &&
    message.session === session &&
    ['hello', 'ready', 'connect', 'update', 'inspect'].includes(String(message.type))
  )
}

/** Custom Tauri protocols may serialize their origin as null in WebKit. */
export function matchesPreviewOrigin(origin: string, url: URL) {
  return (
    origin === url.origin || (url.origin === 'null' && origin === `${url.protocol}//${url.host}`)
  )
}
export function previewTargetOrigin(url: URL) {
  return url.origin === 'null' ? '*' : url.origin
}
