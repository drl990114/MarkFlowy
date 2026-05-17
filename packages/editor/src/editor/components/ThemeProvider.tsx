import type { Langs } from '@markflowy/i18n'
import { changeLng, i18nInit, isInitialized, locales } from '@markflowy/i18n'
import mermaid from 'mermaid'
import { memo, useEffect, useRef } from 'react'
import { ThemeProvider as ScThemeProvider } from 'styled-components'
import { CreateThemeOptions, changeTheme } from '../codemirror'
import { darkTheme, lightTheme } from '../theme'
import { eventBus } from '../utils/eventbus'

export * from './Editor'

type Props = {
  theme?: {
    mode: 'light' | 'dark'
    token?: Record<string, any>
    codemirrorTheme?: CreateThemeOptions
  }
  i18n?: {
    language?: string
  }
  children?: React.ReactNode
}

export const ThemeProvider: React.FC<Props> = memo(({ theme, i18n, children }: Props) => {
  const mode = theme?.mode || 'light'

  const defaultThemeToken = mode === 'dark' ? darkTheme.styledConstants : lightTheme.styledConstants

  const themeToken = theme?.token ? { ...defaultThemeToken, ...theme.token } : defaultThemeToken

  const prevLanguageRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const initI18n = async () => {
      if (!isInitialized()) {
        await i18nInit({ lng: i18n?.language })
      } else if (i18n?.language && prevLanguageRef.current !== i18n.language && i18n.language in locales) {
        await changeLng(i18n.language as Langs)
      }
      prevLanguageRef.current = i18n?.language
    }
    initI18n()
  }, [i18n?.language])

  useEffect(() => {
    const codemirrorTheme =
      theme?.codemirrorTheme || mode === 'dark'
        ? darkTheme.codemirrorTheme
        : lightTheme.codemirrorTheme
    changeTheme(codemirrorTheme)

    mermaid.initialize({
      theme: mode === 'dark' ? 'dark' : 'default',
    })

    eventBus.emit('change-theme')
  }, [mode, theme?.codemirrorTheme, changeTheme])

  return <ScThemeProvider theme={themeToken}>{children}</ScThemeProvider>
})
