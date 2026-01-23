export type ThemeColors = typeof darkTheme
export type ScThemeProps = { theme: ThemeColors }

export const common = {
  lineHeightBase: '1.6',

  titleBarHeight: '30px',
  titleBarControlBtnWidth: '50px',

  fontH1: '28px',
  fontH2: '26px',
  fontH3: '24px',
  fontH4: '22px',
  fontH5: '20px',
  fontH6: '18px',
  fontBase: '15px',
  fontSm: '14px',
  fontXs: '12px',

  spaceXs: '4px',
  spaceSm: '8px',
  spaceBase: '10px',
  spaceL: '12px',
  spaceXl: '16px',

  smallBorderRadius: '4px',
  midBorderRadius: '8px',
  bigBorderRadius: '12px',

  homeMaxWidth: '1300px',

  black: '#74757D',
  white: '#ffffff',
  gray: '#C0C0C0',
  blue: '#0359D0',
  primaryBg: '#08060d',
  primaryText: '#ffffff',
  secondaryBg: '#ffffff',
  secondaryText: '#08060d',

  fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'`,
  codemirrorFontFamily: `'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace`,
}

const styledDarkTheme = {
  ...common,

  // font
  primaryFontColor: '#edecec',
  disabledFontColor: '#ffffff80',
  unselectedFontColor: '#ffffff80',
  labelFontColor: '#ffffff80',

  // color
  accentColor: '#2593d0',
  accentColorFocused: '#1c2433',
  borderColor: '#303030',
  borderColorFocused: '#505050',
  bgColor: '#14120b',
  bgColorSecondary: '#1b1913',
  hoverColor: '#2b2f33',
  warnColor: '#e2b340',
  dangerColor: '#dc2626',
  tipsBgColor: '#333333',
  successColor: '#00c853',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',

  // components
  navBackground: '#14120b',
  footerBgColor: '#1b1913',
  sidebarBackground: '#1b1913',
  buttonBgColor: '#21262c',
  tooltipBgColor: '#43414A',
  dialogBgColor: '#151515',
  dialogBackdropColor: '#00000099',
  contextMenuBgColor: '#18191B',
  contextMenuBgColorHover: '#2D3134',

  scrollbarThumbColor: '#2C3C52',
  scrollbarTrackColor: '#0e1419',
}

export const darkTheme = styledDarkTheme
