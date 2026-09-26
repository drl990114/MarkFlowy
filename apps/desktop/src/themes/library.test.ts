import { beforeEach, describe, expect, it, vi } from 'vitest'
import { builtInThemes, type MfTheme } from '@markflowy/theme'
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  applyTheme: vi.fn(),
  applyThemeSelection: vi.fn(),
  setState: vi.fn(),
  css: vi.fn(),
  themeState: {
    themes: [] as MfTheme[],
    curTheme: undefined as MfTheme | undefined,
    lightThemeName: 'MarkFlowy Light',
    darkThemeName: 'MarkFlowy Dark',
    themeMode: 'light',
    systemTheme: 'light',
  },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@/stores/useThemeStore', () => ({
  FALLBACK_LIGHT_THEME: 'MarkFlowy Light',
  FALLBACK_DARK_THEME: 'MarkFlowy Dark',
  default: {
    setState: mocks.setState,
    getState: () => ({
      ...mocks.themeState,
      applyTheme: mocks.applyTheme,
      applyThemeSelection: mocks.applyThemeSelection,
    }),
  },
}))
vi.mock('@/helper/extensions', () => ({ loadLocalThemeCss: mocks.css }))
import { useThemeLibrary } from './library'
const paper = {
  version: 1 as const,
  id: 'paper',
  name: 'Paper',
  variants: [{ id: 'light', name: 'Light', mode: 'light' as const, tokens: {} }],
}
beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mocks.themeState, {
    themes: [...builtInThemes],
    curTheme: builtInThemes.find((theme) => theme.name === 'MarkFlowy Light'),
    lightThemeName: 'MarkFlowy Light',
    darkThemeName: 'MarkFlowy Dark',
    themeMode: 'light',
    systemTheme: 'light',
  })
  mocks.setState.mockImplementation((state) => Object.assign(mocks.themeState, state))
  mocks.applyTheme.mockImplementation(() => {
    const state = mocks.themeState
    const mode = state.themeMode === 'system' ? state.systemTheme : state.themeMode
    const name = mode === 'dark' ? state.darkThemeName : state.lightThemeName
    state.curTheme =
      state.themes.find((theme) => theme.name === name && theme.mode === mode) ??
      builtInThemes.find(
        (theme) => theme.name === `MarkFlowy ${mode === 'dark' ? 'Dark' : 'Light'}`,
      )
  })
  mocks.applyThemeSelection.mockImplementation(async (selection) =>
    Object.assign(mocks.themeState, selection),
  )
  useThemeLibrary.setState({
    revision: 0,
    loaded: false,
    documents: [],
    snippets: [],
    error: undefined,
  })
})
describe('theme library', () => {
  it('loads declarative themes and only enabled CSS in stored order', async () => {
    mocks.invoke.mockResolvedValue({
      revision: 1,
      documents: [paper],
      snippets: [
        { id: 'a', name: 'a', css: 'a{}', enabled: true },
        { id: 'b', name: 'b', css: 'b{}', enabled: false },
        { id: 'c', name: 'c', css: 'c{}', enabled: true },
      ],
    })
    await useThemeLibrary.getState().reload()
    expect(mocks.invoke).toHaveBeenCalledWith('get_theme_library')
    expect(mocks.css).toHaveBeenCalledWith(['a{}', 'c{}'])
    expect(useThemeLibrary.getState().documents).toEqual([paper])
    expect(mocks.applyTheme).toHaveBeenCalledWith(false)
  })
  it('does not change active themes or CSS on failed persistence', async () => {
    mocks.invoke.mockRejectedValue(new Error('disk full'))
    await expect(
      useThemeLibrary.getState().mutate({ type: 'save', document: paper, replace: false }),
    ).rejects.toThrow('disk full')
    expect(mocks.applyTheme).not.toHaveBeenCalled()
    expect(mocks.css).not.toHaveBeenCalled()
  })
  it('validates before invoking native writes', async () => {
    await expect(
      useThemeLibrary
        .getState()
        .mutate({ type: 'save', document: { ...paper, id: '../escape' }, replace: false }),
    ).rejects.toThrow('Invalid')
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
  it('ignores older events after newer mutation responses', async () => {
    mocks.invoke
      .mockResolvedValueOnce({ revision: 4, documents: [paper], snippets: [] })
      .mockResolvedValueOnce({ revision: 3, documents: [], snippets: [] })
    await useThemeLibrary.getState().reload()
    await useThemeLibrary.getState().reload()
    expect(useThemeLibrary.getState().revision).toBe(4)
    expect(useThemeLibrary.getState().documents).toHaveLength(1)
  })
  it('preserves a selected identity through invalid reads and restores it when repaired', async () => {
    mocks.themeState.lightThemeName = 'paper/light'
    mocks.invoke
      .mockResolvedValueOnce({ revision: 1, documents: [{ ...paper, variants: [] }], snippets: [] })
      .mockResolvedValueOnce({ revision: 2, documents: [paper], snippets: [] })
    await useThemeLibrary.getState().reload()
    expect(mocks.themeState.lightThemeName).toBe('paper/light')
    expect(mocks.applyThemeSelection).not.toHaveBeenCalled()
    expect(useThemeLibrary.getState().error).toContain('temporary light fallback')
    await useThemeLibrary.getState().reload()
    expect(mocks.themeState.themes.some((theme) => theme.name === 'paper/light')).toBe(true)
    expect(mocks.themeState.lightThemeName).toBe('paper/light')
    expect(useThemeLibrary.getState().error).toBeUndefined()
  })
  it('clears both deleted variant selections through one settings transaction', async () => {
    mocks.themeState.lightThemeName = 'paper/light'
    mocks.themeState.darkThemeName = 'paper/dark'
    mocks.invoke.mockResolvedValue({ revision: 1, documents: [], snippets: [] })
    await useThemeLibrary.getState().mutate({ type: 'remove', id: 'paper' })
    expect(mocks.applyThemeSelection).toHaveBeenCalledOnce()
    expect(mocks.applyThemeSelection).toHaveBeenCalledWith({
      lightThemeName: 'MarkFlowy Light',
      darkThemeName: 'MarkFlowy Dark',
    })
    expect(useThemeLibrary.getState().error).toBeUndefined()
  })
  it('does not reapply a theme for snippet edits or duplicate revision responses', async () => {
    const base = { revision: 1, documents: [paper], snippets: [] }
    mocks.invoke
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({
        ...base,
        revision: 2,
        snippets: [{ id: 'a', name: 'A', css: 'a{}', enabled: true }],
      })
    await useThemeLibrary.getState().reload()
    await useThemeLibrary.getState().reload()
    await useThemeLibrary.getState().mutate({ type: 'disableSnippets' })
    expect(mocks.applyTheme).toHaveBeenCalledOnce()
    expect(mocks.css).toHaveBeenCalledTimes(2)
  })
  it('coalesces matching revisions while catalog preparation is yielding', async () => {
    const documents = Array.from({ length: 9 }, (_, index) => ({ ...paper, id: `paper-${index}` }))
    mocks.invoke.mockResolvedValue({ revision: 1, documents, snippets: [] })
    const first = useThemeLibrary.getState().reload()
    await Promise.resolve()
    const second = useThemeLibrary.getState().reload()
    await Promise.all([first, second])
    expect(useThemeLibrary.getState().documents).toHaveLength(9)
    expect(mocks.applyTheme).toHaveBeenCalledOnce()
    expect(mocks.css).toHaveBeenCalledOnce()
  })

  it('refreshes startup appearance when the selected document changes', async () => {
    mocks.themeState.lightThemeName = 'paper/light'
    const updated = {
      ...paper,
      variants: [{ ...paper.variants[0], tokens: { 'surface.canvas': '#abcdef' } }],
    }
    mocks.invoke
      .mockResolvedValueOnce({ revision: 1, documents: [paper], snippets: [] })
      .mockResolvedValueOnce({ revision: 2, documents: [updated], snippets: [] })
    await useThemeLibrary.getState().reload()
    mocks.applyTheme.mockClear()
    await useThemeLibrary.getState().reload()
    expect(mocks.applyTheme).toHaveBeenCalledExactlyOnceWith(true)
  })
  it('rejects ambiguous duplicate document ids without dropping unrelated documents', async () => {
    mocks.invoke.mockResolvedValue({
      revision: 1,
      documents: [paper, { ...paper, name: 'Duplicate' }, { ...paper, id: 'other' }],
      snippets: [],
    })
    await useThemeLibrary.getState().reload()
    expect(useThemeLibrary.getState().documents.map((document) => document.id)).toEqual(['other'])
    expect(useThemeLibrary.getState().error).toContain('Duplicate theme id: paper')
  })
  it('prioritizes the configured startup identity while preserving catalog order', async () => {
    mocks.themeState.lightThemeName = 'paper/light'
    mocks.invoke.mockResolvedValue({
      revision: 1,
      documents: [{ ...paper, id: 'first' }, paper],
      snippets: [],
    })
    await useThemeLibrary.getState().reload()
    expect(mocks.setState.mock.calls[0][0].themes.at(-1).name).toBe('paper/light')
    expect(useThemeLibrary.getState().documents.map((document) => document.id)).toEqual([
      'first',
      'paper',
    ])
  })
})
