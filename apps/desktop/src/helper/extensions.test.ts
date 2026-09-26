import { afterEach, describe, expect, it } from 'vitest'
import {
  CSS_SNIPPET_SELECTOR,
  loadLocalThemeCss,
  loadThemeCss,
  removeInsertedTheme,
} from './extensions'

afterEach(() => {
  loadLocalThemeCss([])
  removeInsertedTheme()
})

describe('theme CSS cascade', () => {
  it('keeps snippets in separate ordered stylesheets', () => {
    loadLocalThemeCss(['.first { color: red }', '.second { color: blue }'])
    const snippets = [...document.querySelectorAll<HTMLStyleElement>(CSS_SNIPPET_SELECTOR)]
    expect(snippets.map((element) => element.textContent)).toEqual([
      '.first { color: red }',
      '.second { color: blue }',
    ])
    expect(snippets[0].sheet).not.toBe(snippets[1].sheet)
    expect((snippets[1].sheet?.cssRules[0] as CSSStyleRule).style.color).toBe('blue')
  })

  it('keeps later imports at the beginning of their own stylesheet', () => {
    const imported = '@import url("data:text/css,"); .second { color: blue }'
    loadLocalThemeCss(['.first { color: red }', imported])
    const snippets = [...document.querySelectorAll<HTMLStyleElement>(CSS_SNIPPET_SELECTOR)]
    expect(snippets[1].textContent).toBe(imported)
  })

  it('inserts every replacement theme before all enabled snippets', () => {
    loadLocalThemeCss(['.first {}', '.second {}'])
    loadThemeCss('.theme {}')
    loadThemeCss('.replacement {}')
    expect(
      [...document.head.querySelectorAll('#mf-markdown-theme, [data-mf-css-snippet]')].map(
        (element) => element.textContent,
      ),
    ).toEqual(['.replacement {}', '.first {}', '.second {}'])
    loadLocalThemeCss(['.second {}'])
    expect(document.querySelectorAll(CSS_SNIPPET_SELECTOR)).toHaveLength(1)
    loadLocalThemeCss([])
    expect(document.querySelectorAll(CSS_SNIPPET_SELECTOR)).toHaveLength(0)
    expect(document.getElementById('mf-markdown-theme')?.textContent).toBe('.replacement {}')
  })
})
