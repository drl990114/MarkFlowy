export type ThemeColors = typeof lightTheme
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

  black: '#74757D',
  white: '#ffffff',
  gray: '#C0C0C0',
  blue: '#0359D0',

  fontFamily: `"Open Sans", sans-serif`,
  codemirrorFontFamily: `'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace`,
}

const styledLightTheme = {
  ...common,

  primaryFontColor: '#000000',
  labelFontColor: '#9ca3af',
  accentColor: '#0369a1',
  borderColor: '#d7d7dc',
  bgColor: '#fdfdfd',
  hoverColor: '#d7d7dc',
  warnColor: '#e2b340',
  dangerColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
  successColor: '#00c853',
  boxShadowColor: 'rgba(0, 0, 0, 0.08)',
  
  // components
  navBackground: '#fff',
}

const styledDarkTheme = {
  ...common,

  primaryFontColor: '#ffffff',
  labelFontColor: 'rgba(255, 255, 255, 0.5)',
  accentColor: '#1c78aa',
  borderColor: '#363b41',
  hoverColor: '#1f2225',
  warnColor: '#e2b340',
  dangerColor: '#dc2626',
  tipsBgColor: '#0e1419',
  successColor: '#00c853',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',

  // components
  navBackground: '#1d1f21',
  bgColor: '#1d1f21',
  footerBgColor: '#181a1c',
  sidebarBackground: '#1b1d1f',
}

export const lightTheme = styledLightTheme
export const darkTheme = styledDarkTheme
