import { codemirrorLight, codemirrorDark } from './codemirror'
import { styledDarkTheme } from './dark'
import { styledLightTheme } from './light'

export * from './WysiwygThemeWrapper'
export * from './SourceCodeThemeWrapper'

export const tableSelectorSize = 15

export const common = {
  lineHeightBase: '1.6',

  titleBarHeight: '30px',
  titleBarControlBtnWidth: '50px',

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
  white: '#E0E0E0',
  gray: '#C0C0C0',
  blue: '#0359D0',

  fontFamily: `'Open Sans', 'Clear Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  codemirrorFontFamily: `'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace`,
}

export const darkTheme = {
  codemirrorTheme: codemirrorDark,
  styledConstants: { ...common, ...styledDarkTheme },
}

export const lightTheme = {
  codemirrorTheme: codemirrorLight,
  styledConstants: { ...common, ...styledLightTheme },
}
