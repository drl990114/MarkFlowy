import type { CreateThemeOptions } from '../codemirror'
import { darkTheme, lightTheme } from '../theme'

export function resolveCodeMirrorTheme(
  mode: 'dark' | 'light',
  override?: CreateThemeOptions,
): CreateThemeOptions {
  return override ?? (mode === 'dark' ? darkTheme.codemirrorTheme : lightTheme.codemirrorTheme)
}
