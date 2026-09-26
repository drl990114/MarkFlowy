import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseThemeDocument, resolveTheme } from '@markflowy/theme/semantic'
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  factory: vi.fn(),
}))
vi.mock('@/components/EditorArea/capricornRuntimeAdapter', () => ({
  loadCapricornRuntimeFactory: async () => mocks.factory,
  createCapricornRuntimeAdapter: mocks.create,
}))
import { PreviewSurface } from './PreviewSurface'
const labels = {
  preview: 'Preview',
  loadError: 'Failed',
  error: 'Error',
  retry: 'Retry',
  previewNotes: 'Notes',
  previewIdeas: 'Ideas',
  previewWelcome: 'Welcome',
  previewSearch: 'Search preview',
  previewSearchPlaceholder: 'Search…',
  previewNewNote: 'New note',
}
function theme(color: string) {
  const document = parseThemeDocument({
    version: 1,
    id: 'test',
    name: 'Test',
    variants: [
      { id: 'light', name: 'Light', mode: 'light', tokens: { 'editor.background': color } },
    ],
  })
  return resolveTheme(document, document.variants[0])
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockReturnValue({ updateSettings: mocks.update, destroy: mocks.destroy })
})
afterEach(cleanup)
describe('preview document surface', () => {
  it('updates theme settings without replacing the interactive editor', async () => {
    const inspect = vi.fn()
    const view = render(
      <PreviewSurface
        theme={theme('#ffffff')}
        snippets={[]}
        inspect={false}
        labels={labels}
        onInspect={inspect}
      />,
    )
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    const options = mocks.create.mock.calls[0][0].options
    expect(options.handleLinkClick('https://example.com')).toBeUndefined()
    view.rerender(
      <PreviewSurface
        theme={theme('#eeeeee')}
        snippets={[]}
        inspect={false}
        labels={{ ...labels, previewWelcome: '欢迎', previewSearch: '搜索预览' }}
        onInspect={inspect}
      />,
    )
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(view.container.querySelector('[aria-current="page"]')?.textContent).toBe('欢迎.md')
    fireEvent.click(screen.getByRole('button', { name: '搜索预览' }))
    expect(screen.getByRole('textbox', { name: '搜索预览' })).toBeTruthy()
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          '--cap-surface': expect.stringContaining('--mf-theme-editor-background'),
        }),
      }),
    )
    view.unmount()
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
  })
  it('inspects roles and keeps personal CSS snippets in separate style sheets', async () => {
    const inspect = vi.fn()
    const view = render(
      <PreviewSurface
        theme={theme('#ffffff')}
        snippets={[
          { id: 'a', css: 'body{' },
          { id: 'b', css: 'body{color:red}' },
        ]}
        inspect
        labels={labels}
        onInspect={inspect}
      />,
    )
    fireEvent.click(view.container.querySelector('[aria-current="page"]')!)
    expect(inspect).toHaveBeenCalledWith('interaction.selected')
    for (const token of [
      'chrome.titlebar.background',
      'chrome.sidebar.background',
      'chrome.tab.background',
      'chrome.tab.activeBackground',
      'chrome.statusbar.background',
    ]) {
      fireEvent.contextMenu(view.container.querySelector(`[data-theme-token="${token}"]`)!)
      expect(inspect).toHaveBeenLastCalledWith(token)
    }
    expect(
      [...view.container.querySelectorAll('[data-mf-css-snippet]')].map(
        (style) => style.textContent,
      ),
    ).toEqual(['body{', 'body{color:red}'])
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  })
})
