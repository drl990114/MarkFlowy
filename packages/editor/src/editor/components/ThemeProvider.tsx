import { ThemeProvider as ScThemeProvider } from 'styled-components'
import { CreateThemeOptions, changeTheme } from '../codemirror'
import { memo, useEffect } from 'react'
import { darkTheme, lightTheme } from '../theme'
import { changeLng, i18nInit } from '../i18n'
import mermaid from 'mermaid'
import { eventBus } from '../utils/eventbus'

export * from './Editor'

type Props = {
  theme?: {
    mode: 'light' | 'dark'
    /**
     * Some theme variables can be modified through the token attribute in theme.
     */
    token?: Record<string, any>
    /**
     * The sourcode editor theme.
     */
    codemirrorTheme?: CreateThemeOptions
  }
  i18n?: {
    locales?: Record<string, Record<'translation', Record<string, any>>>
    language?: string
  }
  locales?: Record<string, any>
  children?: React.ReactNode
}

export const ThemeProvider: React.FC<Props> = memo(({ theme, i18n, children }: Props) => {
  const mode = theme?.mode || 'light'

  const defaultThemeToken = mode === 'dark' ? darkTheme.styledConstants : lightTheme.styledConstants

  const themeToken = theme?.token ? { ...defaultThemeToken, ...theme.token } : defaultThemeToken

  useEffect(() => {
    if (i18n?.locales) {
      i18nInit(i18n.locales).then(() => {
        if (i18n?.language) {
          changeLng(i18n?.language)
        }
      })
    }
  }, [i18n])

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
