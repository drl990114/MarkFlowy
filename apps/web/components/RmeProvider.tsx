import React, { useEffect } from 'react'
import { darkTheme } from 'theme'
import { preloadRme, useRme, useRmeThemeProvider } from '../hooks/useRme'
import Loading from './Loading'

// 在组件定义前尝试提前触发预加载
if (typeof window !== 'undefined') {
  // 使用新的预加载函数
  preloadRme().catch((err) => {
    console.warn('RME preload attempt failed, will try again:', err)
  })
}

type RmeProviderProps = {
  themeTokens?: Record<string, string>
  children?: React.ReactNode
}

// 静态主题配置，避免函数调用开销
const THEME_CONFIG = {
  mode: 'dark' as const,
  token: {
    ...darkTheme,
    bgColor: '#181a1c',
    fontFamily: darkTheme.fontFamily,
    codemirrorFontFamily: darkTheme.codemirrorFontFamily,
  },
} as const

export const RmePreload = () => {
  useRme()
  return null
}

const RmeProvider: React.FC<RmeProviderProps> = ({ themeTokens, children }) => {
  const { ThemeProvider, loading, error, reload } = useRmeThemeProvider()

  useEffect(() => {
    if (loading && !ThemeProvider && reload) {
      reload().catch(console.warn)
    }
  }, [loading, ThemeProvider, reload])

  if (loading) {
    return <Loading />
  }

  // 加载错误显示错误信息并提供重试选项
  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'white',
          backgroundColor: '#181a1c',
        }}
      >
        <p>Error loading RME: {error.message}</p>
        <button
          onClick={() => reload && reload()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // 模块未加载完成
  if (!ThemeProvider) {
    return <Loading />
  }

  let theme = { ...THEME_CONFIG }
  if (themeTokens) {
    Object.assign(theme.token, themeTokens)
  }

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}

export default RmeProvider
