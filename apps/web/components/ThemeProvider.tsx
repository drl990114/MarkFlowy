import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { darkTheme } from 'theme'
import React, { useMemo } from 'react'

type ThemeProviderProps = {
  children?: React.ReactNode
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const themeProp = useMemo(
    () => ({
      mode: 'dark' as const,
      token: darkTheme,
    }),
    [],
  )

  return (
    <StyledThemeProvider theme={darkTheme}>
      <ZensThemeProvider theme={themeProp}>
        {children}
      </ZensThemeProvider>
    </StyledThemeProvider>
  )
}

export default ThemeProvider
