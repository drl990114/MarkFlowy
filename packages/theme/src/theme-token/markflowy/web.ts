import { markflowyDarkTheme } from './index'

export const webSpecificTokens = {
  homeMaxWidth: '1300px',
  primaryBg: '#1f1f1f',
  primaryText: '#ffffff',
  secondaryBg: '#ffffff',
  secondaryText: '#1f1f1f',
  secondaryFontColor: '#a0a0a0',
  navBackground: '#252525',
  footerBgColor: '#1f1f1f',
  sidebarBackground: '#1f1f1f',
  contextMenuSeparatorColor: '#303030',
  fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC Light', 'PingFang SC', 'Microsoft YaHei Light', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'`,
  codemirrorFontFamily: `'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace`,
}

export const webDarkTheme = {
  ...markflowyDarkTheme,
  ...webSpecificTokens,
}
