export * from './base'
export * from './codemirror'
export * from './darken-colors'

import darkCss from './dark.css'
import lightCss from './light.css'
import { mfCodemirrorDark, mfCodemirrorLight } from './codemirror'
import type { CreateThemeOptions } from '@drl990114/codemirror-themes'

export type ThemeColors = typeof lightTheme
export type ScThemeProps = { theme: ThemeColors }

export type MfTheme = {
  /**
   * should be a unique name
   * @example light
   */
  name: string
  /**
   * light or dark for lib. e.g. mui
   */
  type: 'light' | 'dark'
  /**
   * Replace styled constants
   */
  styledContants: Record<string, string>
  /**
   * Codemirror theme.
   */
  codemirorTheme: CreateThemeOptions
  /**
   * @example
   * .example {
   *    color: blue;
   * }
   */
  globalStyleText?: string
}

export const common = {
  lineHeightBase: '1.6',

  titleBarHeight: '30px',

  fontH1: '28px',
  fontH2: '26px',
  fontH3: '24px',
  fontH4: '22px',
  fontH5: '20px',
  fontH6: '18px',
  fontBase: '15px',
  fontSm: '14px',
  fontXs: '12px',

  smallPadding: '4px',
  midPadding: '8px',
  bigPadding: '12px',

  smallBorderRadius: '6px',
  midBorderRadius: '8px',
  bigBorderRadius: '12px',

  black: '#74757D',
  white: '#E0E0E0',
  gray: '#C0C0C0',
  blue: '#0359D0',

  fontFamily: `'Open Sans', 'Clear Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  codemirrorFontFamily: `'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace`,
}

const styledLightTheme = {
  ...common,

  primaryFontColor: '#000000',
  labelFontColor: '#9ca3af',
  accentColor: '#0369a1',
  borderColor: '#d7d7dc',
  bgColor: '#fdfdfd',
  warnColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
  successColor: '#00c853',
  boxShadowColor: 'rgba(0, 0, 0, 0.08)',
  
  // components
  buttonBgColor: '#f6f7f9',
  tooltipBgColor: '#f6f7f9',
  dialogBgColor: '#f6f7f9',
  contextMenuBgColor: '#f6f7f9',

  titleBarDefaultHoverColor: '#bdbdc2',

  scrollbarThumbColor: '#C4C4C4',
  scrollbarTrackColor: '#e4e4e7',
}

const styledDarkTheme = {
  ...common,

  primaryFontColor: '#c8d1d9',
  labelFontColor: 'rgba(255, 255, 255, 0.5)',
  accentColor: '#1c78aa',
  borderColor: '#363b41',
  bgColor: '#05010d',
  warnColor: '#dc2626',
  tipsBgColor: '#0e1419',
  successColor: '#00c853',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',

  // components
  buttonBgColor: '#21262c',
  tooltipBgColor: '#43414A',
  dialogBgColor: 'rgb(13, 17, 23)',
  contextMenuBgColor: '#43414A',

  titleBarDefaultHoverColor: '#383838',

  scrollbarThumbColor: '#2C3C52',
  scrollbarTrackColor: '#0e1419',
}

export const lightTheme: MfTheme = {
  name: 'MarkFlowy Light',
  type: 'light',
  styledContants: styledLightTheme,
  codemirorTheme: mfCodemirrorLight,
  globalStyleText: lightCss
}

export const darkTheme: MfTheme = {
  name: 'MarkFlowy Dark',
  type: 'dark',
  styledContants: styledDarkTheme,
  codemirorTheme: mfCodemirrorDark,
  globalStyleText: darkCss
}
