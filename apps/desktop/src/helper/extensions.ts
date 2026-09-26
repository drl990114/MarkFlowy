let themeEl: undefined | HTMLStyleElement
const THEME_ID = 'mf-markdown-theme'
const LOCAL_THEME_ID = 'mf-local-themes'
export const CSS_SNIPPET_SELECTOR = 'style[data-mf-css-snippet]'

export function loadThemeCss(css: string) {
  if (themeEl) themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.textContent = css
  const snippets = document.getElementById(LOCAL_THEME_ID)
  document.head.insertBefore(themeEl, snippets)
}

export function loadLocalThemeCss(cssContents: string[]) {
  document.querySelectorAll(CSS_SNIPPET_SELECTOR).forEach((element) => element.remove())
  document.getElementById(LOCAL_THEME_ID)?.remove()
  // A separate stylesheet keeps @import valid and confines CSS parse errors to one snippet.
  cssContents.forEach((css, index) => {
    const element = document.createElement('style')
    element.setAttribute('data-mf-css-snippet', '')
    if (index === 0) element.id = LOCAL_THEME_ID
    element.textContent = css
    document.head.appendChild(element)
  })
}

export function removeInsertedTheme() {
  if (themeEl) themeEl.remove()
}
