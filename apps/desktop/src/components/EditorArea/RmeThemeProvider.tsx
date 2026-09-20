import { useContext, useMemo } from 'react'
import type { RmeRuntime } from './rmeRuntime'
import { alignCodeMirrorTheme } from '@/appThemeTokens'
import { EditorThemeContext } from '@/editorThemeContext'
import { FALLBACK_DARK_THEME, FALLBACK_LIGHT_THEME } from '@/stores/useThemeStore'

/** The optional engine supplies its theme implementation only after it is needed. */
export function RmeThemeProvider({
  children,
  runtime,
}: BaseComponentProps & { runtime: RmeRuntime }) {
  const config = useContext(EditorThemeContext)
  const theme = useMemo(() => {
    if (!config) return undefined
    const { darkTheme, lightTheme } = runtime
    const baseTheme =
      config.mode === 'dark' ? darkTheme.codemirrorTheme : lightTheme.codemirrorTheme
    const builtIn = config.name === FALLBACK_LIGHT_THEME || config.name === FALLBACK_DARK_THEME
    return {
      mode: config.mode,
      token: config.token,
      codemirrorTheme:
        config.codemirrorTheme ??
        (builtIn
          ? alignCodeMirrorTheme({ baseTheme, mode: config.mode, theme: config.token })
          : undefined),
    }
  }, [config, runtime])
  const i18n = useMemo(() => ({ language: config?.language }), [config?.language])
  if (!config) return children
  const ThemeProvider = runtime.ThemeProvider
  return (
    <ThemeProvider theme={theme} i18n={i18n}>
      {children}
    </ThemeProvider>
  )
}
