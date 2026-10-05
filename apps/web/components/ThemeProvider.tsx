import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import React, { useMemo } from 'react'
import { ComponentsThemeProvider, legacyThemeVariables } from 'zens'
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

function ComponentTheme({ children, website = false }: ThemeProviderProps) {
  const { resolvedTheme } = useTheme()
  const token = website ? websiteTheme : applicationTheme
  const variables = useMemo(() => legacyThemeVariables(token), [token])
  return (
    <StyledThemeProvider theme={token}>
      <ComponentsThemeProvider variables={variables} mode={resolvedTheme}>
        {children}
      </ComponentsThemeProvider>
    </StyledThemeProvider>
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
      <ComponentTheme website={website}>{children}</ComponentTheme>
    </PreferenceProvider>
  )
}

export default ThemeProvider
