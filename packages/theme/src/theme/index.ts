export * from './darken-colors'

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
  mode: 'light' | 'dark'
  /**
   * Replace styled constants
   */
  styledConstants: Record<string, string>
  /**
   * Codemirror theme.
   */
  codemirrorTheme?: CreateThemeOptions
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
  titleBarControlBtnWidth: '50px',
  statusBarHeight: '32px',

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

  fontFamily: `'Open Sans', 'Clear Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  codemirrorFontFamily: `'Fira Code', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace`,
}

const styledLightTheme = {
  ...common,

  primaryFontColor: '#000000',
  labelFontColor: '#9ca3af',
  accentColor: '#0369a1',
  borderColor: '#d7d7dc',
  bgColor: '#f7f7f7',
  bgColorSecondary: "#e7e7e7",
  hoverColor: '#d7d7dc',
  warnColor: '#e2b340',
  dangerColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
  successColor: '#00c853',
  boxShadowColor: 'rgba(0, 0, 0, 0.08)',

  // app
  titleBarBgColor: '#DCDCDD',
  titleBarDefaultHoverColor: '#bdbdc2',
  editorTabBgColor: '#EBEBEC',
  editorTabActiveBgColor: '#FAFAFA',
  editorToolbarBgColor: '#EBEBEC',
  fileTreeIndentLineColor: '#E0E0E0',
  sideBarHeaderBgColor: '#EBEBEC',
  sideBarBgColor: '#f2f2f2',
  statusBarBgColor: '#EBEBEC',
  rightBarBgColor: '#f2f2f2',
  rightBarHeaderBgColor: '#EBEBEC',

  // components
  buttonBgColor: '#f6f7f9',
  tooltipBgColor: '#d7d7dc',
  dialogBgColor: '#f6f7f9',
  dialogBackdropColor: '#00000066',
  contextMenuBgColor: '#FFFFFF',
  contextMenuBgColorHover: '#E8E8EC',

  scrollbarThumbColor: '#C4C4C4',
  scrollbarTrackColor: '#e4e4e7',
}

const styledDarkTheme = {
  ...common,

  primaryFontColor: '#c8d1d9',
  labelFontColor: 'rgba(255, 255, 255, 0.5)',
  accentColor: '#2593d0',
  borderColor: '#363b41',
  bgColor: '#151515',
  bgColorSecondary: "#252525",
  hoverColor: '#2b2f33',
  warnColor: '#e2b340',
  dangerColor: '#dc2626',
  tipsBgColor: '#333333',
  successColor: '#00c853',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',

  // app
  titleBarBgColor: '#212326',
  titleBarDefaultHoverColor: '#383838',
  editorTabBgColor: '#1b1b1b',
  editorTabActiveBgColor: '#151515',
  editorToolbarBgColor: '#1b1b1b',
  fileTreeIndentLineColor: '#2C2C2C',
  sideBarHeaderBgColor: '#1b1b1b',
  sideBarBgColor: '#1E1D1E',
  statusBarBgColor: '#262626',
  rightBarBgColor: '#1E1D1E',
  rightBarHeaderBgColor: '#1b1b1b',

  // components
  buttonBgColor: '#21262c',
  tooltipBgColor: '#43414A',
  dialogBgColor: '#151515',
  dialogBackdropColor: '#00000099',
  contextMenuBgColor: '#18191B',
  contextMenuBgColorHover: '#2D3134',

  scrollbarThumbColor: '#2C3C52',
  scrollbarTrackColor: '#0e1419',
}

export const lightTheme: MfTheme = {
  name: 'MarkFlowy Light',
  mode: 'light',
  styledConstants: styledLightTheme,
}

export const darkTheme: MfTheme = {
  name: 'MarkFlowy Dark',
  mode: 'dark',
  styledConstants: styledDarkTheme,
}
