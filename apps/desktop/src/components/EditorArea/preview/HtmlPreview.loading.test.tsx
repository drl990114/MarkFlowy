import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditorLoadingBoundary } from '../EditorLoadingBoundary'
import HtmlPreview from './HtmlPreview'
import type { PreparedHtmlPreview } from './htmlPreviewDocument'

const prepare = vi.hoisted(() => vi.fn())
vi.mock('./htmlPreviewDocument', () => ({ HTML_PREVIEW_SANDBOX: 'allow-scripts', prepareHtmlPreview: prepare }))
vi.mock('@/i18n', () => ({ t: (key: string) => key, useTranslation: () => ({ t: (key: string) => key }) }))

beforeEach(() => { vi.useFakeTimers(); prepare.mockReset() })
afterEach(() => { cleanup(); vi.useRealTimers() })

it('reports HTML preparation to its pane without flashing a second loading surface', async () => {
  let resolve!: (value: PreparedHtmlPreview) => void
  prepare.mockReturnValue(new Promise<PreparedHtmlPreview>((done) => { resolve = done }))
  const view = render(<EditorLoadingBoundary><HtmlPreview content='<p>hello</p>' /></EditorLoadingBoundary>)
  const owner = view.container.querySelector('[data-slot="editor-loading-boundary"]')!
  expect(owner.getAttribute('aria-busy')).toBe('true')
  expect(view.container.querySelector('[data-slot="html-preview"]')?.getAttribute('aria-busy')).toBe('true')
  expect(view.queryByText('document_preview.loading')).toBeNull()
  act(() => { vi.advanceTimersByTime(799) })
  expect(view.queryByRole('progressbar')).toBeNull()
  await act(async () => { resolve({ html: '<p>hello</p>', blockedResources: 0, dispose: vi.fn() }) })
  expect(owner.getAttribute('aria-busy')).toBe('false')
  expect(view.container.querySelector('iframe')).not.toBeNull()
  expect(view.container.querySelector('[data-slot="html-preview"]')?.getAttribute('aria-busy')).toBe('false')
  act(() => { vi.advanceTimersByTime(1000) })
  expect(view.queryByRole('progressbar')).toBeNull()
})

it('ends delayed feedback when HTML preparation fails', async () => {
  let reject!: (error: Error) => void
  prepare.mockReturnValue(new Promise<PreparedHtmlPreview>((_done, fail) => { reject = fail }))
  const view = render(<EditorLoadingBoundary><HtmlPreview content='broken' /></EditorLoadingBoundary>)
  act(() => { vi.advanceTimersByTime(800) })
  expect(view.getAllByRole('progressbar')).toHaveLength(1)
  await act(async () => { reject(new Error('unavailable')) })
  expect(view.getByRole('alert').textContent).toBe('document_preview.load_failed')
  expect(view.queryByRole('progressbar')).toBeNull()
  expect(view.container.querySelector('[data-slot="editor-loading-boundary"]')?.getAttribute('aria-busy')).toBe('false')
})
