import githubDarkCss from './github-dark.css?inline'
import githubLightCss from './github-light.css?inline'

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
  if (theme === 'light') {
    loadThemeCss(githubLightCss)
  } else {
    loadThemeCss(githubDarkCss)
  }
}
