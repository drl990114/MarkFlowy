import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import { darkTheme } from 'theme'
import Loading from './Loading'

// 动态导入RME的ThemeProvider，禁用SSR
const RmeThemeProvider = dynamic(() => import('rme').then(mod => ({ default: mod.ThemeProvider })), {
  ssr: false,
  loading: () => <Loading />,
})

type RmeProviderProps = {
  children?: React.ReactNode
}

const RmeProvider: React.FC<RmeProviderProps> = ({ children }) => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const themeProp = {
    mode: 'dark' as const,
    token: {
      ...darkTheme,
      bgColor: '#181a1c',
      fontFamily: darkTheme.fontFamily,
      codemirrorFontFamily: darkTheme.codemirrorFontFamily,
    },
  }

  if (!isClient) {
    return <Loading />
  }

  return (
    <RmeThemeProvider theme={themeProp}>
      {children}
    </RmeThemeProvider>
  )
}

export default RmeProvider
