export * from './base'

import darkCss from './dark.css'
import lightCss from './light.css'

const THEME_ID = 'mf-markdown-theme'

let themeEl: undefined | HTMLStyleElement

export type ThemeColors = typeof lightThemeColors
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

const lightThemeColors = {
  primaryFontColor: '#000000',
  labelFontColor: '#9ca3af',
  accentColor: '#0369a1',
  borderColor: '#e4e4e7',
  bgColor: '#fdfdfd',
  warnColor: '#dc2626',
  tipsBgColor: '#f6f7f9',
  successColor: '#00c853',
  boxShadowColor: 'rgba(0, 0, 0, 0.08)',
  scrollbarThumbColor: '#C4C4C4',
  scrollbarTrackColor: '#e4e4e7',
}

const darkThemeColors = {
  primaryFontColor: 'rgba(255, 255, 255, 0.9)',
  labelFontColor: 'rgba(255, 255, 255, 0.5)',
  accentColor: '#1c78aa',
  borderColor: '#21313d',
  bgColor: '#11191f',
  warnColor: '#dc2626',
  tipsBgColor: '#0e1419',
  successColor: '#00c853',
  boxShadowColor: 'rgba(255, 255, 255, 0.04)',
  scrollbarThumbColor: '#2C3C52',
  scrollbarTrackColor: '#0e1419',
}


export {
  lightThemeColors,
  darkThemeColors,
}
