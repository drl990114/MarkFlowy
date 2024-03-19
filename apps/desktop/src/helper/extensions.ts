let themeEl: undefined | HTMLStyleElement
const THEME_ID = 'mf-markdown-theme'

export function loadThemeCss(url: string) {
  if (themeEl) themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}


export function removeInsertedTheme() {
  if (themeEl) themeEl.remove()
}
