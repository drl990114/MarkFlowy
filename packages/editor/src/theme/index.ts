export * from './base'

import githubDarkCss from './github-dark.css'
import githubLightCss from './github-light.css'

const THEME_ID = 'linebyline-markdown-theme'

let themeEl: undefined | HTMLStyleElement

const loadThemeCss = (url: string) => {
  if (themeEl) {
     themeEl.remove()
  }

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}

export const loadTheme = (theme: 'light' | 'dark') => {
  console.log('githubLightCss', githubLightCss)
  if (theme === 'light') {
    loadThemeCss(githubLightCss)
  } else {
    loadThemeCss(githubDarkCss)
  }
}

