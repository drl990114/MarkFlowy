import githubDarkCss from './github-dark.css'
import githubLightCss from './github-light.css'

export * from './base'

const THEME_ID = 'linebyline-markdown-theme'

let themeEl: undefined | HTMLStyleElement

function loadThemeCss(url: string) {
  if (themeEl)
    themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}

export function loadTheme(theme: 'light' | 'dark') {
  if (theme === 'light')
    loadThemeCss(githubLightCss)
  else
    loadThemeCss(githubDarkCss)
}
