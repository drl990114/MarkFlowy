export * from './base'

import darkCss from './dark.css'
import lightCss from './light.css'

const THEME_ID = 'mf-markdown-theme'

let themeEl: undefined | HTMLStyleElement

export type ThemeColors = typeof lightTheme
export type ScThemeProps = { theme: ThemeColors }

function loadThemeCss(url: string) {
  if (themeEl) themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}

export function loadTheme(theme: 'light' | 'dark') {
  if (theme === 'light') {
    loadThemeCss(lightCss)
  } else {
    loadThemeCss(darkCss)
  }
}

const common = {
  lineHeightBase: '1.6',

  titleBarHeight: "30px",

  fontH1: '28px',
  fontH2: '26px',
  fontH3: '24px',
  fontH4: '22px',
  fontH5: '20px',
  fontH6: '18px',
  fontBase: '15px',
  fontSm: '14px',
  fontXs: '12px',

  fontFamily: `'Open Sans', 'Clear Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  codemirrorFontFamily: `'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace`
}

const lightTheme = {
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

  titleBarDefaultHoverColor: '#bdbdc2',

  scrollbarThumbColor: '#C4C4C4',
  scrollbarTrackColor: '#e4e4e7',
}

const darkTheme = {
  ...common,

  primaryFontColor: 'rgba(255, 255, 255, 0.9)',
  labelFontColor: 'rgba(255, 255, 255, 0.5)',
  accentColor: '#1c78aa',
  borderColor: '#21313d',
  bgColor: '#05010d',
  warnColor: '#dc2626',
  tipsBgColor: '#0e1419',
  successColor: '#00c853',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',

  titleBarDefaultHoverColor: '#383838',

  scrollbarThumbColor: '#2C3C52',
  scrollbarTrackColor: '#0e1419',
}


export {
  lightTheme,
  darkTheme,
}
