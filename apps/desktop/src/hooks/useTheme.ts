import { useTheme as useEditorTheme } from '@linebyline/editor'
import { createTheme } from '@mui/material'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'
import type { ThemeProps } from 'styled-components'

type Theme = 'light' | 'dark'

export type ThemeColors = typeof lightThemeColors
export type ScThemeProps = ThemeProps<ThemeColors>

const lightThemeColors = {
  primaryFontColor: '#000000',
  labelFontColor: '#9ca3af',
  accentColor: '#0369a1',
  borderColor: '#e4e4e7',
  bgColor: '#fdfdfd',
  warnColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
  boxShadowColor: 'rgba(0, 0, 0, 0.08)',
  scrollbarThumbColor: '#C4C4C4 ',
  scrollbarTrackColor: '#e4e4e7',
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
  scrollbarThumbColor: '#2C3C52',
  scrollbarTrackColor: '#0e1419',
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')
  const { themeColors: editorThemeColors, setTheme: setEditorTheme } = useEditorTheme('light')
  const [themeColors, setThemeColors] = useState(lightThemeColors)

  const muiDarkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
    typography: {
      htmlFontSize: 18,
    },
  })

  const muiLightTheme = createTheme({
    palette: {
      mode: 'light',
    },
    typography: {
      htmlFontSize: 18,
    },
  })

  useEffect(() => {
    if (theme === 'light') {
      setEditorTheme('light')
      setThemeColors(lightThemeColors)
    } else {
      setEditorTheme('dark')
      setThemeColors(darkThemeColors)
    }
  }, [setEditorTheme, theme])

  return {
    theme,
    themeColors,
    editorThemeColors,
    setTheme,
    muiTheme: theme === 'light' ? muiLightTheme : muiDarkTheme,
  }
}

const [useGlobalTheme] = createGlobalStore(useTheme)

export default useGlobalTheme
