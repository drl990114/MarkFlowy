import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import SnippetPreview from './SnippetPreview'

const mocks = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), t: (key: string) => key }))
vi.mock('@/components/EditorArea/capricornRuntimeAdapter', () => ({
  loadCapricornRuntimeFactory: mocks.load,
}))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: mocks.t }),
  i18n: { language: 'en', dir: () => 'ltr', on: () => {}, off: () => {}, t: mocks.t },
}))
vi.mock('@/stores/useThemeStore', () => ({ default: () => 'light' }))
const session = {
  commands: { insertCodeBlock: vi.fn(), insertMathBlock: vi.fn(), insertMermaidBlock: vi.fn() },
  updateSettings: vi.fn(),
  setMode: vi.fn(),
  waitForResources: vi.fn(),
  destroy: vi.fn(),
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue(mocks.create)
  mocks.create.mockReturnValue(session)
  session.waitForResources.mockResolvedValue(undefined)
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
})

describe('isolated snippet preview lifecycle', () => {
  it.each(['math', 'mermaid', 'code'] as const)(
    'creates %s with block commands then makes it read-only',
    async (kind) => {
      const snippet = { id: 'draft', kind, title: 'Draft', source: '\n  ${literal}\n' }
      render(<SnippetPreview snippet={snippet} />)
      await waitFor(() => expect(session.setMode).toHaveBeenCalledWith('preview'))
      expect(mocks.create).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          markdown: '',
          autoFocus: false,
          snippets: false,
          copilot: false,
        }),
      )
      expect(session.updateSettings).toHaveBeenCalledWith({ readOnly: true })
      const command =
        kind === 'math'
          ? session.commands.insertMathBlock
          : kind === 'mermaid'
            ? session.commands.insertMermaidBlock
            : session.commands.insertCodeBlock
      expect(command.mock.calls[0][0]).toBe(snippet.source)
      expect(screen.queryByRole('alert')).toBeNull()
    },
  )

  it('disposes a failed temporary editor so an error never exposes a writable surface', async () => {
    session.commands.insertMathBlock.mockImplementationOnce(() => {
      throw new Error('invalid source')
    })
    render(
      <SnippetPreview snippet={{ id: 'draft', kind: 'math', title: 'Draft', source: '\\frac{' }} />,
    )
    await screen.findByRole('alert')
    expect(session.destroy).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert').textContent).toContain('snippets.previewError')
    cleanup()
    await act(async () => {})
    expect(session.destroy).toHaveBeenCalledOnce()
  })

  it('does not construct a late runtime after the preview has been closed', async () => {
    let resolve!: (factory: typeof mocks.create) => void
    mocks.load.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const preview = render(
      <SnippetPreview snippet={{ id: 'draft', kind: 'code', title: 'Draft', source: 'x' }} />,
    )
    preview.unmount()
    await act(async () => {
      resolve(mocks.create)
    })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
