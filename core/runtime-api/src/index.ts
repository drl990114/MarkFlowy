import type { MfTheme } from '@markflowy/theme'

// TODO use wasm to improve safety
export function registerTheme(theme: MfTheme) {
  window.__MF__?.theme.registerTheme(theme)
}
