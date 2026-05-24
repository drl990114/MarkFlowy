import { markflowyDarkTheme } from './index'
import { inkwashTokens } from './web-atelier'

export const webSpecificTokens = {
  homeMaxWidth: '1360px',
  primaryBg: '#141416',
  primaryText: '#e8e6e3',
  secondaryBg: '#1c1c20',
  secondaryText: '#b0ada8',
  secondaryFontColor: '#8a8884',
  navBackground: 'rgba(20, 20, 22, 0.92)',
  footerBgColor: '#0a0a0c',
  sidebarBackground: '#1c1c20',
  contextMenuSeparatorColor: 'rgba(232, 230, 227, 0.08)',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC Light', 'PingFang SC', 'Microsoft YaHei Light', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'",
  codemirrorFontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",

  bgColor: '#1c1c20',
  bgColorSecondary: '#141416',
  primaryFontColor: '#e8e6e3',
  disabledFontColor: '#8a8884',
  unselectedFontColor: '#9a9792',
  labelFontColor: '#8a8884',
  accentColor: '#d4564a',
  accentColorFocused: 'rgba(212, 86, 74, 0.15)',
  borderColor: 'rgba(232, 230, 227, 0.10)',
  borderColorFocused: '#d4564a',
  hoverColor: 'rgba(232, 230, 227, 0.06)',
  warnColor: '#d4a017',
  dangerColor: '#d4564a',
  tipsBgColor: '#1c1c20',
  successColor: '#6b9b6b',
  boxShadowColor: '0 30px 60px -20px rgba(0, 0, 0, 0.5)',

  titleBarBgColor: '#141416',
  titleBarDefaultHoverColor: '#1c1c20',
  editorTabBgColor: '#141416',
  editorTabActiveBgColor: '#1c1c20',
  editorToolbarBgColor: '#141416',
  fileTreeIndentLineColor: 'rgba(232, 230, 227, 0.06)',
  fileTreeSelectedBgColor: 'rgba(232, 230, 227, 0.06)',
  sideBarHeaderBgColor: '#141416',
  sideBarBgColor: '#141416',
  statusBarBgColor: '#141416',
  rightBarBgColor: '#141416',
  rightBarHeaderBgColor: '#141416',

  tocbarProgressBgColor: '#141416',
  tocbarProgressActiveBgColor: '#d4564a',

  buttonBgColor: 'rgba(232, 230, 227, 0.08)',
  tooltipBgColor: '#242428',
  dialogBgColor: '#1c1c20',
  dialogBackdropColor: 'rgba(0, 0, 0, 0.6)',
  contextMenuBgColor: '#1c1c20',
  contextMenuBgColorHover: 'rgba(232, 230, 227, 0.06)',

  scrollbarThumbColor: '#3a3a3e',
  scrollbarTrackColor: '#141416',

  ...inkwashTokens,
}

export const webDarkTheme = {
  ...markflowyDarkTheme,
  ...webSpecificTokens,
}
