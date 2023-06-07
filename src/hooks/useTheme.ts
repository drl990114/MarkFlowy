import { loadTheme } from '@/editor/theme/theme'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'
import { ThemeProps } from 'styled-components'
import colors from 'windicss/colors'

type Theme = 'light' | 'dark'

export type MThemeProps = ThemeProps<typeof lightThemeColors>

const lightThemeColors = {
  primaryFontColor: 'black',
  labelFontColor: colors.gray[400],
  accentColor: colors.sky[700],
  borderColor: colors.zinc[200],
  bgColor: colors.light[50],
  warnColor: colors.red[600],
  tipsBgColor: '#f6f7f9',
}

const darkThemeColors = {
  primaryFontColor: 'rgba(255, 255, 255, 0.9)',
  labelFontColor: 'rgba(255, 255, 255, 0.9)',
  accentColor: colors.sky[700],
  borderColor: '#30363d',
  bgColor: '#02040a',
  warnColor: colors.red[600],
  tipsBgColor: '#11191f',
}

const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('light')
  const [themeColors, setThemeColors] = useState(lightThemeColors)

  useEffect(() => {
    loadTheme(theme)
    if (theme === 'light') {
      setThemeColors(lightThemeColors)
    } else {
      setThemeColors(darkThemeColors)
    }
  }, [theme])

  return { theme, themeColors, setTheme }
}

const [useGlobalTheme] = createGlobalStore(useTheme)

export default useGlobalTheme
