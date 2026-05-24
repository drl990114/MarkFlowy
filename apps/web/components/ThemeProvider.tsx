import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import { darkTheme } from 'theme'
import React from 'react'

type ThemeProviderProps = {
  children?: React.ReactNode
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <StyledThemeProvider theme={darkTheme}>
      {children}
    </StyledThemeProvider>
  )
}

export default ThemeProvider
