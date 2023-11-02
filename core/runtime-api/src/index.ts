import type { MfTheme } from '@markflowy/theme'

export function registerTheme(theme: MfTheme) {
  window.__MF__?.theme.registerTheme(theme)
}
