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
  styledConstants: typeof styledLightTheme
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

  // font
  primaryFontColor: '#000000',
  disabledFontColor: '#9ca3af',
  unselectedFontColor: '#505050',
  labelFontColor: '#9ca3af',

  accentColor: '#0369a1',
  accentColorFocused: '#eef4fa',
  borderColor: '#D2D2D2',
  borderColorFocused: '#C7DEFF',
  bgColor: '#ffffff',
  bgColorSecondary: '#e7e7e7',
  hoverColor: '#d7d7dc',
  warnColor: '#e2b340',
  dangerColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
  successColor: '#00c853',
  boxShadowColor: 'rgba(0, 0, 0, 0.08)',

  // app
  titleBarBgColor: '#DCDCDD',
  titleBarDefaultHoverColor: '#bdbdc2',
  editorTabBgColor: '#E9E9E9',
  editorTabActiveBgColor: '#FAFAFA',
  editorToolbarBgColor: '#EBEBEC',
  fileTreeIndentLineColor: '#E0E0E0',
  fileTreeSelectedBgColor: '#E4E0E0',
  sideBarHeaderBgColor: '#F9F9F9',
  sideBarBgColor: '#F9F9F9',
  statusBarBgColor: '#E9E9E9',
  rightBarBgColor: '#F9F9F9',
  rightBarHeaderBgColor: '#F9F9F9',

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

  // font
  primaryFontColor: '#CACCCA',
  disabledFontColor: '#ffffff80',
  unselectedFontColor: '#ffffff80',
  labelFontColor: '#ffffff80',

  // color
  accentColor: '#2593d0',
  accentColorFocused: '#1c2433',
  borderColor: '#404040',
  borderColorFocused: '#2970BD',
  bgColor: '#131313',
  bgColorSecondary: '#252525',
  hoverColor: '#2b2f33',
  warnColor: '#e2b340',
  dangerColor: '#dc2626',
  tipsBgColor: '#333333',
  successColor: '#00c853',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',

  // app
  titleBarBgColor: '#212326',
  titleBarDefaultHoverColor: '#383838',
  editorTabBgColor: '#232323',
  editorTabActiveBgColor: '#151515',
  editorToolbarBgColor: '#1b1b1b',
  fileTreeIndentLineColor: '#2C2C2C',
  fileTreeSelectedBgColor: '#474646',
  sideBarHeaderBgColor: '#1E1D1E',
  sideBarBgColor: '#1E1D1E',
  statusBarBgColor: '#262626',
  rightBarBgColor: '#1E1D1E',
  rightBarHeaderBgColor: '#1E1D1E',

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

// GitHub Light Theme
const styledGitHubLightTheme = {
  ...common,

  // font
  primaryFontColor: '#24292f',
  disabledFontColor: '#8c959f',
  unselectedFontColor: '#57606a',
  labelFontColor: '#57606a',

  accentColor: '#0969da',
  accentColorFocused: '#ddf4ff',
  borderColor: '#d0d7de',
  borderColorFocused: '#0969da',
  bgColor: '#ffffff',
  bgColorSecondary: '#f6f8fa',
  hoverColor: '#f3f4f6',
  warnColor: '#9a6700',
  dangerColor: '#cf222e',
  tipsBgColor: '#f6f8fa',
  successColor: '#1a7f37',
  boxShadowColor: 'rgba(31, 35, 40, 0.04)',

  // app
  titleBarBgColor: '#f6f8fa',
  titleBarDefaultHoverColor: '#eaeef2',
  editorTabBgColor: '#f6f8fa',
  editorTabActiveBgColor: '#ffffff',
  editorToolbarBgColor: '#f6f8fa',
  fileTreeIndentLineColor: '#d8dee4',
  fileTreeSelectedBgColor: '#ddf4ff',
  sideBarHeaderBgColor: '#f6f8fa',
  sideBarBgColor: '#f6f8fa',
  statusBarBgColor: '#f6f8fa',
  rightBarBgColor: '#f6f8fa',
  rightBarHeaderBgColor: '#f6f8fa',

  // components
  buttonBgColor: '#f6f8fa',
  tooltipBgColor: '#eaeef2',
  dialogBgColor: '#ffffff',
  dialogBackdropColor: '#00000066',
  contextMenuBgColor: '#ffffff',
  contextMenuBgColorHover: '#f3f4f6',

  scrollbarThumbColor: '#8c959f',
  scrollbarTrackColor: '#f6f8fa',
}

// GitHub Dark Theme
const styledGitHubDarkTheme = {
  ...common,

  // font
  primaryFontColor: '#c9d1d9',
  disabledFontColor: '#484f58',
  unselectedFontColor: '#8b949e',
  labelFontColor: '#8b949e',

  accentColor: '#58a6ff',
  accentColorFocused: '#388bfd26',
  borderColor: '#30363d',
  borderColorFocused: '#58a6ff',
  bgColor: '#0d1117',
  bgColorSecondary: '#161b22',
  hoverColor: '#21262d',
  warnColor: '#d29922',
  dangerColor: '#f85149',
  tipsBgColor: '#161b22',
  successColor: '#3fb950',
  boxShadowColor: 'rgba(0, 0, 0, 0.3)',

  // app
  titleBarBgColor: '#161b22',
  titleBarDefaultHoverColor: '#21262d',
  editorTabBgColor: '#161b22',
  editorTabActiveBgColor: '#0d1117',
  editorToolbarBgColor: '#161b22',
  fileTreeIndentLineColor: '#21262d',
  fileTreeSelectedBgColor: '#388bfd26',
  sideBarHeaderBgColor: '#161b22',
  sideBarBgColor: '#161b22',
  statusBarBgColor: '#161b22',
  rightBarBgColor: '#161b22',
  rightBarHeaderBgColor: '#161b22',

  // components
  buttonBgColor: '#21262d',
  tooltipBgColor: '#30363d',
  dialogBgColor: '#0d1117',
  dialogBackdropColor: '#00000099',
  contextMenuBgColor: '#161b22',
  contextMenuBgColorHover: '#21262d',

  scrollbarThumbColor: '#484f58',
  scrollbarTrackColor: '#0d1117',
}

// GitBook Theme (Light)
const styledGitBookTheme = {
  ...common,

  // font
  primaryFontColor: '#1f2328',
  disabledFontColor: '#9ca3af',
  unselectedFontColor: '#6b7280',
  labelFontColor: '#6b7280',

  accentColor: '#346ddb',
  accentColorFocused: '#e8f0fe',
  borderColor: '#e5e7eb',
  borderColorFocused: '#346ddb',
  bgColor: '#ffffff',
  bgColorSecondary: '#f9fafb',
  hoverColor: '#f3f4f6',
  warnColor: '#ca8a04',
  dangerColor: '#dc2626',
  tipsBgColor: '#f0f9ff',
  successColor: '#16a34a',
  boxShadowColor: 'rgba(0, 0, 0, 0.05)',

  // app
  titleBarBgColor: '#f9fafb',
  titleBarDefaultHoverColor: '#e5e7eb',
  editorTabBgColor: '#f3f4f6',
  editorTabActiveBgColor: '#ffffff',
  editorToolbarBgColor: '#f9fafb',
  fileTreeIndentLineColor: '#e5e7eb',
  fileTreeSelectedBgColor: '#e8f0fe',
  sideBarHeaderBgColor: '#f9fafb',
  sideBarBgColor: '#f9fafb',
  statusBarBgColor: '#f9fafb',
  rightBarBgColor: '#f9fafb',
  rightBarHeaderBgColor: '#f9fafb',

  // components
  buttonBgColor: '#f3f4f6',
  tooltipBgColor: '#e5e7eb',
  dialogBgColor: '#ffffff',
  dialogBackdropColor: '#00000066',
  contextMenuBgColor: '#ffffff',
  contextMenuBgColorHover: '#f3f4f6',

  scrollbarThumbColor: '#d1d5db',
  scrollbarTrackColor: '#f9fafb',
}

// Sepia Theme (类似 GitBook 的护眼暖色主题)
const styledSepiaTheme = {
  ...common,

  // font
  primaryFontColor: '#5c4b37',
  disabledFontColor: '#a89984',
  unselectedFontColor: '#7c6f64',
  labelFontColor: '#7c6f64',

  accentColor: '#b57614',
  accentColorFocused: '#f5e6d3',
  borderColor: '#d5c4a1',
  borderColorFocused: '#b57614',
  bgColor: '#fbf1c7',
  bgColorSecondary: '#f2e5bc',
  hoverColor: '#ebdbb2',
  warnColor: '#d79921',
  dangerColor: '#cc241d',
  tipsBgColor: '#f5e6d3',
  successColor: '#79740e',
  boxShadowColor: 'rgba(60, 56, 54, 0.08)',

  // app
  titleBarBgColor: '#f2e5bc',
  titleBarDefaultHoverColor: '#ebdbb2',
  editorTabBgColor: '#f2e5bc',
  editorTabActiveBgColor: '#fbf1c7',
  editorToolbarBgColor: '#f2e5bc',
  fileTreeIndentLineColor: '#d5c4a1',
  fileTreeSelectedBgColor: '#ebdbb2',
  sideBarHeaderBgColor: '#f2e5bc',
  sideBarBgColor: '#f2e5bc',
  statusBarBgColor: '#f2e5bc',
  rightBarBgColor: '#f2e5bc',
  rightBarHeaderBgColor: '#f2e5bc',

  // components
  buttonBgColor: '#f2e5bc',
  tooltipBgColor: '#ebdbb2',
  dialogBgColor: '#fbf1c7',
  dialogBackdropColor: '#00000066',
  contextMenuBgColor: '#fbf1c7',
  contextMenuBgColorHover: '#f2e5bc',

  scrollbarThumbColor: '#bdae93',
  scrollbarTrackColor: '#f2e5bc',
}

// Nord Theme (流行的冷色深色主题)
const styledNordTheme = {
  ...common,

  // font
  primaryFontColor: '#eceff4',
  disabledFontColor: '#4c566a',
  unselectedFontColor: '#d8dee9',
  labelFontColor: '#d8dee9',

  accentColor: '#88c0d0',
  accentColorFocused: '#3b4252',
  borderColor: '#3b4252',
  borderColorFocused: '#88c0d0',
  bgColor: '#2e3440',
  bgColorSecondary: '#3b4252',
  hoverColor: '#434c5e',
  warnColor: '#ebcb8b',
  dangerColor: '#bf616a',
  tipsBgColor: '#3b4252',
  successColor: '#a3be8c',
  boxShadowColor: 'rgba(0, 0, 0, 0.2)',

  // app
  titleBarBgColor: '#3b4252',
  titleBarDefaultHoverColor: '#434c5e',
  editorTabBgColor: '#3b4252',
  editorTabActiveBgColor: '#2e3440',
  editorToolbarBgColor: '#3b4252',
  fileTreeIndentLineColor: '#434c5e',
  fileTreeSelectedBgColor: '#434c5e',
  sideBarHeaderBgColor: '#3b4252',
  sideBarBgColor: '#3b4252',
  statusBarBgColor: '#3b4252',
  rightBarBgColor: '#3b4252',
  rightBarHeaderBgColor: '#3b4252',

  // components
  buttonBgColor: '#3b4252',
  tooltipBgColor: '#434c5e',
  dialogBgColor: '#2e3440',
  dialogBackdropColor: '#00000099',
  contextMenuBgColor: '#3b4252',
  contextMenuBgColorHover: '#434c5e',

  scrollbarThumbColor: '#4c566a',
  scrollbarTrackColor: '#2e3440',
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

export const githubLightTheme: MfTheme = {
  name: 'GitHub Light',
  mode: 'light',
  styledConstants: styledGitHubLightTheme,
}

export const githubDarkTheme: MfTheme = {
  name: 'GitHub Dark',
  mode: 'dark',
  styledConstants: styledGitHubDarkTheme,
}

export const gitbookTheme: MfTheme = {
  name: 'GitBook',
  mode: 'light',
  styledConstants: styledGitBookTheme,
}

export const sepiaTheme: MfTheme = {
  name: 'Sepia',
  mode: 'light',
  styledConstants: styledSepiaTheme,
}

export const nordTheme: MfTheme = {
  name: 'Nord',
  mode: 'dark',
  styledConstants: styledNordTheme,
}

// 所有内置主题列表
export const builtInThemes: MfTheme[] = [
  lightTheme,
  darkTheme,
  githubLightTheme,
  githubDarkTheme,
  gitbookTheme,
  sepiaTheme,
  nordTheme,
]
