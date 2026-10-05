import { cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopDarkTheme, desktopLightTheme } from '@markflowy/theme'
import { darkTheme, ThemeProvider } from 'rme'
import * as runtime from 'rme'
import { alignCodeMirrorTheme } from '@/appThemeTokens'
import { EditorThemeContext, type EditorThemeConfig } from '@/editorThemeContext'
import { RmeThemeProvider } from './RmeThemeProvider'
import { SemanticThemeContext } from '@/themes/context'
import { resolveThemeTokens } from '@markflowy/theme/semantic'

vi.mock('rme', () => ({
  darkTheme: { codemirrorTheme: { theme: 'dark', settings: { background: '#111' }, styles: [] } },
  lightTheme: { codemirrorTheme: { theme: 'light', settings: { background: '#fff' }, styles: [] } },
  ThemeProvider: vi.fn(({ children }: { children: React.ReactNode }) => children),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RME theme at the editor boundary', () => {
  it('maps the shared semantic editor, code and syntax roles', () => {
    const tokens = resolveThemeTokens('light', {
      'editor.background': '#112233',
      'editor.foreground': '#ffeecc',
      'editor.muted': '#ccbbaa',
      'editor.code.background': '#223344',
      'editor.code.foreground': '#ddccbb',
      'surface.subtle': '#334455',
      'surface.overlay': '#445566',
      'border.default': '#778899',
      'editor.caret': '#abcdef',
      'syntax.keyword': '#aabbcc',
    })
    render(
      <EditorThemeContext.Provider
        value={{
          name: 'paper/light',
          mode: 'light',
          token: desktopLightTheme,
          codemirrorTheme: undefined,
        }}
      >
        <SemanticThemeContext.Provider value={tokens}>
          <RmeThemeProvider runtime={runtime}>editor</RmeThemeProvider>
        </SemanticThemeContext.Provider>
      </EditorThemeContext.Provider>,
    )
    const theme = vi.mocked(ThemeProvider).mock.lastCall?.[0].theme
    // A dark editor canvas in a light variant must not retain RME's light
    // defaults for bold text, tables, keyboard marks or source delimiters.
    expect(theme?.token).toMatchObject({
      bgColor: '#112233ff',
      primaryFontColor: '#ffeeccff',
      strongFontColor: '#ffeeccff',
      labelFontColor: '#ccbbaaff',
      blockquoteFontColor: '#ccbbaaff',
      placeholderFontColor: '#ccbbaaff',
      tableTrBgColor: '#112233ff',
      tableTrDeepBgColor: '#334455ff',
      tableTdBorderColor: '#778899ff',
      tableHeaderBgColor: '#334455ff',
      kbdBgColor: '#223344ff',
      kbdFontColor: '#ddccbbff',
      kbdBorderColor: '#778899ff',
      codeBgColor: '#223344ff',
      preBgColor: '#223344ff',
      contextMenuBgColor: '#445566ff',
    })
    expect(theme?.codemirrorTheme?.settings).toMatchObject({
      background: '#223344ff',
      caret: '#abcdefff',
    })
    expect(theme?.codemirrorTheme?.styles).toContainEqual(
      expect.objectContaining({ color: '#aabbccff' }),
    )
  })
  it('preserves built-in palette alignment and language updates without remounting editors', () => {
    const mounted = vi.fn()
    const unmounted = vi.fn()
    function Editor() {
      useEffect(() => {
        mounted()
        return unmounted
      }, [])
      return <div>document</div>
    }
    const config: EditorThemeConfig = {
      name: 'MarkFlowy Light',
      mode: 'light',
      token: desktopLightTheme,
      codemirrorTheme: undefined,
      language: 'zh-CN',
    }
    const content = (value: EditorThemeConfig) => (
      <EditorThemeContext.Provider value={value}>
        <RmeThemeProvider runtime={runtime}>
          <Editor />
        </RmeThemeProvider>
      </EditorThemeContext.Provider>
    )
    const view = render(content(config))
    expect(vi.mocked(ThemeProvider).mock.lastCall?.[0]).toMatchObject({
      i18n: { language: 'zh-CN' },
    })
    view.rerender(
      content({
        ...config,
        name: 'MarkFlowy Dark',
        mode: 'dark',
        token: desktopDarkTheme,
        language: 'en',
      }),
    )
    expect(vi.mocked(ThemeProvider).mock.lastCall?.[0]).toMatchObject({
      i18n: { language: 'en' },
      theme: {
        mode: 'dark',
        token: desktopDarkTheme,
        codemirrorTheme: alignCodeMirrorTheme({
          baseTheme: darkTheme.codemirrorTheme,
          mode: 'dark',
          theme: desktopDarkTheme,
        }),
      },
    })
    expect(mounted).toHaveBeenCalledOnce()
    expect(unmounted).not.toHaveBeenCalled()
  })

  it('preserves custom syntax themes and the library fallback for a theme without one', () => {
    const syntaxTheme = darkTheme.codemirrorTheme
    const config: EditorThemeConfig = {
      name: 'Custom',
      mode: 'dark',
      token: desktopDarkTheme,
      codemirrorTheme: syntaxTheme,
      language: 'ja',
    }
    const content = (value: EditorThemeConfig) => (
      <EditorThemeContext.Provider value={value}>
        <RmeThemeProvider runtime={runtime}>editor</RmeThemeProvider>
      </EditorThemeContext.Provider>
    )
    const view = render(content(config))
    expect(vi.mocked(ThemeProvider).mock.lastCall?.[0].theme?.codemirrorTheme).toBe(syntaxTheme)
    view.rerender(content({ ...config, codemirrorTheme: undefined }))
    expect(vi.mocked(ThemeProvider).mock.lastCall?.[0].theme?.codemirrorTheme).toBeUndefined()
  })
})
