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
const labels = { preview: 'Preview', loadError: 'Failed', error: 'Error', retry: 'Retry' }
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
        labels={labels}
        onInspect={inspect}
      />,
    )
    expect(mocks.create).toHaveBeenCalledTimes(1)
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
    fireEvent.click(screen.getByRole('button', { name: 'New note' }))
    expect(inspect).toHaveBeenCalledWith('accent.background')
    expect(
      [...view.container.querySelectorAll('[data-mf-css-snippet]')].map(
        (style) => style.textContent,
      ),
    ).toEqual(['body{', 'body{color:red}'])
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  })
})
