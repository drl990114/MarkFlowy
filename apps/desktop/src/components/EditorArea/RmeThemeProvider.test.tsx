import { cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopDarkTheme, desktopLightTheme } from '@markflowy/theme'
import { darkTheme, ThemeProvider } from 'rme'
import * as runtime from 'rme'
import { alignCodeMirrorTheme } from '@/appThemeTokens'
import { EditorThemeContext, type EditorThemeConfig } from '@/editorThemeContext'
import { RmeThemeProvider } from './RmeThemeProvider'

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
