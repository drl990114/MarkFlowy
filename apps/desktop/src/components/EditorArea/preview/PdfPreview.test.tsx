import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EditorLoadingBoundary } from '../EditorLoadingBoundary'
import PdfPreview from './PdfPreview'
import type { PdfPreviewCallbacks } from './pdfPreviewRuntime'

const open = vi.hoisted(() => vi.fn())
vi.mock('./pdfPreviewRuntime', () => ({ openPdfPreview: open }))
vi.mock('./previewSearch', () => ({ registerPreviewSearch: () => () => {} }))
vi.mock('@/i18n', () => ({ t: (key: string) => key, useTranslation: () => ({ t: (key: string) => key }) }))

beforeEach(() => { vi.useFakeTimers(); open.mockReset(); open.mockReturnValue(new Promise(() => {})) })
afterEach(() => { cleanup(); vi.useRealTimers() })

const callbacks = () => open.mock.calls.at(-1)![3] as PdfPreviewCallbacks
const content = (visible = true) => (
  <TooltipProvider>
    <EditorLoadingBoundary visible={visible}>
      <PdfPreview fileId='pdf' filePath='/test.pdf' active visible={visible} />
    </EditorLoadingBoundary>
  </TooltipProvider>
)

it('uses one delayed pane indicator for PDF preparation and clears it when pages are ready', async () => {
  const view = render(content())
  expect(view.queryByText('document_preview.loading')).toBeNull()
  act(() => { vi.advanceTimersByTime(799) })
  expect(view.queryByRole('progressbar')).toBeNull()
  act(() => { vi.advanceTimersByTime(1) })
  expect(view.getAllByRole('progressbar')).toHaveLength(1)
  await act(async () => { callbacks().onReady(3) })
  expect(view.queryByRole('progressbar')).toBeNull()
  expect(view.container.querySelector('[data-slot="editor-loading-boundary"]')?.getAttribute('aria-busy')).toBe('false')
})

it('stops feedback for password input and failure, then restarts on retry', async () => {
  const view = render(content())
  act(() => { vi.advanceTimersByTime(800) })
  await act(async () => { callbacks().onPassword(vi.fn(), false) })
  expect(view.getByText('document_preview.password_required')).not.toBeNull()
  expect(view.queryByRole('progressbar')).toBeNull()
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'document_preview.cancel' })) })
  expect(view.getByRole('alert')).not.toBeNull()
  fireEvent.click(view.getByRole('button', { name: 'document_preview.retry' }))
  expect(view.queryByRole('progressbar')).toBeNull()
  act(() => { vi.advanceTimersByTime(800) })
  expect(view.getAllByRole('progressbar')).toHaveLength(1)
  await act(async () => { callbacks().onError() })
  expect(view.queryByRole('progressbar')).toBeNull()
  expect(view.getByRole('alert')).not.toBeNull()
})

it('does not show progress for an invisible PDF pane', () => {
  const view = render(content(false))
  act(() => { vi.advanceTimersByTime(1000) })
  expect(open).not.toHaveBeenCalled()
  expect(view.queryByRole('progressbar')).toBeNull()
})
