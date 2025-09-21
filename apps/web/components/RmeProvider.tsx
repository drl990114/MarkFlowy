import React from 'react'
import { darkTheme } from 'theme'
import Loading from './Loading'
import { useRmeThemeProvider } from '../hooks/useRme'

type RmeProviderProps = {
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

const RmeProvider: React.FC<RmeProviderProps> = ({ children }) => {
  const { ThemeProvider, loading, error } = useRmeThemeProvider()

  // 加载中显示Loading组件
  if (loading) {
    return <Loading />
  }

  // 加载错误显示错误信息
  if (error) {
    return <div>Error loading RME: {error.message}</div>
  }

  // 模块未加载完成
  if (!ThemeProvider) {
    return <Loading />
  }

  // 渲染ThemeProvider
  return (
    <ThemeProvider theme={THEME_CONFIG}>
      {children}
    </ThemeProvider>
  )
}

export default RmeProvider
