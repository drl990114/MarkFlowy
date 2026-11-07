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
    expect(mocks.create.mock.calls[0][0].container).toBe(
      view.container.querySelector('.mf-editor-content[data-mf-capricorn-runtime]'),
    )
    expect(options.markdown).toMatch(/- \[x\] .+\n {2}- \[ \]/)
    expect(options.markdown).toMatch(/- \[ \] .+\n {2}- \[x\]/)
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
  it('applies draft CSS to the document scope without affecting preview controls or remounting', async () => {
    mocks.create.mockImplementation(({ container }: { container: HTMLElement }) => {
      const content = document.createElement('div')
      content.setAttribute('data-cap-content', '')
      const heading = document.createElement('h1')
      heading.textContent = 'Document heading'
      content.append(heading)
      container.append(content)
      return { updateSettings: mocks.update, destroy: mocks.destroy }
    })
    const renderPreview = (spacing: string) => (
      <>
        <h1>Outside the document</h1>
        <PreviewSurface
          theme={theme('#ffffff')}
          snippets={[
            {
              id: 'draft',
              css: `.mf-editor-content [data-cap-content] h1 { letter-spacing: ${spacing}; }`,
            },
          ]}
          inspect={false}
          labels={labels}
          onInspect={vi.fn()}
        />
      </>
    )
    const view = render(renderPreview('1px'))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    const heading = screen.getByRole('heading', { name: 'Document heading' })
    expect(getComputedStyle(heading).letterSpacing).toBe('1px')
    expect(
      getComputedStyle(screen.getByRole('heading', { name: 'Outside the document' })).letterSpacing,
    ).not.toBe('1px')

    view.rerender(renderPreview('2px'))
    expect(getComputedStyle(heading).letterSpacing).toBe('2px')
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.destroy).not.toHaveBeenCalled()
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
