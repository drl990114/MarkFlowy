import { darkTheme, lightTheme, loadTheme } from '@markflowy/theme'
import { createTheme } from '@mui/material'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')
  const [themeData, setThemeData] = useState<Record<string, string>>(lightTheme)

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
      setThemeData(lightTheme)
    } else {
      setThemeData(darkTheme)
    }
  }, [theme])

  return {
    theme,
    themeData,
    setTheme,
    muiTheme: theme === 'light' ? muiLightTheme : muiDarkTheme,
  }
}

const [useGlobalTheme] = createGlobalStore(useTheme)

export default useGlobalTheme
