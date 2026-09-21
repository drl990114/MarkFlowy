import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import React from 'react'
import { applicationTheme, websiteTheme } from '../utils/websiteTheme'

type ThemeProviderProps = {
  children?: React.ReactNode
  website?: boolean
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, website = false }) => {
  return (
    <StyledThemeProvider theme={website ? websiteTheme : applicationTheme}>
      {children}
    </StyledThemeProvider>
  )
}

export default ThemeProvider
