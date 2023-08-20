import { useEffect, useState } from 'react'
import type { ThemeProps, ThemeProviderProps } from 'styled-components'
import { ThemeProvider } from 'styled-components'
import darkCss from './dark.css'
import lightCss from './light.css'
import { BaseStyle } from './base'
export * from './base'

const THEME_ID = 'linebyline-markdown-theme'

let themeEl: undefined | HTMLStyleElement

export type ThemeColors = typeof lightThemeColors
export type ScThemeProps = ThemeProps<ThemeColors>

function loadThemeCss(url: string) {
  if (themeEl)
    themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}

export function loadTheme(theme: 'light' | 'dark') {
  if (theme === 'light')
    loadThemeCss(lightCss)
  else
    loadThemeCss(darkCss)
}

const lightThemeColors = {
  primaryFontColor: '#000000',
  labelFontColor: '#9ca3af',
  accentColor: '#0369a1',
  borderColor: '#e4e4e7',
  bgColor: '#fdfdfd',
  warnColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
  boxShadowColor: 'rgba(0, 0, 0, 0.08)',
}

const darkThemeColors = {
  primaryFontColor: 'rgba(255, 255, 255, 0.9)',
  labelFontColor: 'rgba(255, 255, 255, 0.9)',
  accentColor: '#1c78aa',
  borderColor: '#21313d',
  bgColor: '#11191f',
  warnColor: '#dc2626',
  tipsBgColor: '#0e1419',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',
}


type Theme = 'light' | 'dark'

export function useTheme(defaultTheme: Theme = 'light') {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [themeColors, setThemeColors] = useState(lightThemeColors)

  useEffect(() => {
    loadTheme(theme)
    if (theme === 'light')
      setThemeColors(lightThemeColors)
    else
      setThemeColors(darkThemeColors)
  }, [theme])

  return {
    theme,
    themeColors,
    setTheme,
  }
}

/**
 * Used to inject global styles, only global references are required once
 * @param props 
 * @returns 
 */
export function EditorGlobalStyles (props: ThemeProviderProps<typeof lightThemeColors>) {
  return <ThemeProvider theme={props.theme}>
    <BaseStyle />
  </ThemeProvider>
}
