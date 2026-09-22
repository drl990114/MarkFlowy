import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import React from 'react'
import Head from 'next/head'
import { ThemeProvider as PreferenceProvider } from 'next-themes'
import { applicationTheme, websiteTheme, websiteThemes } from '../utils/websiteTheme'
import { useTheme } from '../hooks/useTheme'

type ThemeProviderProps = {
  children?: React.ReactNode
  website?: boolean
}

function ThemeColor() {
  const { resolvedTheme } = useTheme()
  return (
    <Head>
      <meta name='theme-color' content={websiteThemes[resolvedTheme].webPaper} />
    </Head>
  )
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, website = false }) => {
  return (
    <PreferenceProvider
      attribute='data-mf-theme'
      storageKey='mf-web-theme'
      defaultTheme='system'
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColor />
      <StyledThemeProvider theme={website ? websiteTheme : applicationTheme}>
        {children}
      </StyledThemeProvider>
    </PreferenceProvider>
  )
}

export default ThemeProvider
