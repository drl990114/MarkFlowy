import { styledDarkTheme } from './dark'
import { styledLightTheme } from './light'

export * from './darken-colors'

export * from './ThemeProvider'

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
  fontXs: '13px',

  spaceXXs: '2px',
  spaceXs: '4px',
  spaceSm: '8px',
  spaceBase: '10px',
  spaceL: '12px',
  spaceXl: '16px',

  smallBorderRadius: '4px',
  midBorderRadius: '8px',
  bigBorderRadius: '12px',

  black: '#74757D',
  white: '#E0E0E0',
  gray: '#C0C0C0',
  blue: '#0359D0',

  fontFamily: `'Open Sans', 'Clear Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  codemirrorFontFamily: `'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace`,
}

export const darkTheme = {
  styledConstants: { ...common, ...styledDarkTheme },
}

export const lightTheme = {
  styledConstants: { ...common, ...styledLightTheme },
}
