import { darkThemeColors, lightThemeColors, loadTheme } from '@markflowy/theme'
import { createTheme } from '@mui/material'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')
  const [themeColors, setThemeColors] = useState<Record<string, string>>(lightThemeColors)

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
    loadTheme(theme)
    if (theme === 'light') {
      setThemeColors(lightThemeColors)
    } else {
      setThemeColors(darkThemeColors)
    }
  }, [theme])

  return {
    theme,
    themeColors,
    setTheme,
    muiTheme: theme === 'light' ? muiLightTheme : muiDarkTheme,
  }
}

const [useGlobalTheme] = createGlobalStore(useTheme)

export default useGlobalTheme
