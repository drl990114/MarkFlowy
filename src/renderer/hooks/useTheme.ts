import { loadTheme } from '@/editor/theme/theme'
import { createTheme } from '@mui/material'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'
import { ThemeProps } from 'styled-components'

type Theme = 'light' | 'dark'

export type ThemeColors = typeof lightThemeColors
export type MThemeProps = ThemeProps<ThemeColors>

const lightThemeColors = {
  primaryFontColor: '#000000',
  labelFontColor: '#9ca3af',
  accentColor: '#0369a1',
  borderColor: '#e4e4e7',
  bgColor: '#fdfdfd',
  warnColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
}

const darkThemeColors = {
  primaryFontColor: 'rgba(255, 255, 255, 0.9)',
  labelFontColor: 'rgba(255, 255, 255, 0.9)',
  accentColor: '#0369a1',
  borderColor: '#30363d',
  bgColor: '#02040a',
  warnColor: '#dc2626',
  tipsBgColor: '#11191f',
}

const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('light')
  const [themeColors, setThemeColors] = useState(lightThemeColors)

  const muiDarkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  const muiLightTheme = createTheme({
    palette: {
      mode: 'light',
    },
  });

  useEffect(() => {
    loadTheme(theme)
    if (theme === 'light') {
      setThemeColors(lightThemeColors)
    } else {
      setThemeColors(darkThemeColors)
    }
  }, [theme])

  return { theme, themeColors, setTheme, muiTheme: theme === 'light' ? muiLightTheme : muiDarkTheme }
}

const [useGlobalTheme] = createGlobalStore(useTheme)

export default useGlobalTheme
