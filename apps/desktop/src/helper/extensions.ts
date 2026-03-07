let themeEl: undefined | HTMLStyleElement
const THEME_ID = 'mf-markdown-theme'
const LOCAL_THEME_ID = 'mf-local-themes'

export function loadThemeCss(url: string) {
  if (themeEl) themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}

export function loadLocalThemeCss(cssContents: string[]) {
  let localThemeEl = document.getElementById(LOCAL_THEME_ID)
  if (localThemeEl) {
    localThemeEl.remove()
  }

  if (cssContents.length === 0) {
    return
  }

  localThemeEl = document.createElement('style')
  localThemeEl.setAttribute('id', LOCAL_THEME_ID)
  localThemeEl.innerHTML = cssContents.join('\n')
  document.head.appendChild(localThemeEl)
}

export function removeInsertedTheme() {
  if (themeEl) themeEl.remove()
}
