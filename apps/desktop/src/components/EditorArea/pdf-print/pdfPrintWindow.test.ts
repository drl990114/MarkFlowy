import { beforeEach, describe, expect, it, vi } from 'vitest'

const tauriMocks = vi.hoisted(() => {
  const sourceHandlers = new Map<string, (event: { payload: unknown }) => void>()
  const windows: {
    destroy: ReturnType<typeof vi.fn>
    handlers: Map<string, (event: { payload: unknown }) => void>
    label: string
    options: Record<string, unknown>
  }[] = []
  const sourceWindow = {
    label: 'main',
    listen: vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
      sourceHandlers.set(event, handler)
      return () => sourceHandlers.delete(event)
    }),
  }

  return {
    emitTo: vi.fn(async () => undefined),
    sourceHandlers,
    sourceWindow,
    windows,
  }
})

vi.mock('@tauri-apps/api/event', () => ({
  emitTo: tauriMocks.emitTo,
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => tauriMocks.sourceWindow,
  WebviewWindow: class MockWebviewWindow {
    destroy = vi.fn(async () => undefined)
    handlers = new Map<string, (event: { payload: unknown }) => void>()
    label: string
    options: Record<string, unknown>

    constructor(label: string, options: Record<string, unknown>) {
      this.label = label
      this.options = options
      tauriMocks.windows.push(this)
    }

    async once(event: string, handler: (event: { payload: unknown }) => void) {
      this.handlers.set(event, handler)
      return () => this.handlers.delete(event)
    }
  },
}))

import {
  getPdfPrintWindowRequest,
  openPdfPrintWindow,
  PDF_PRINT_WINDOW_DATA_EVENT,
  PDF_PRINT_WINDOW_READY_EVENT,
  PDF_PRINT_WINDOW_RESULT_EVENT,
  type PdfPrintWindowDocument,
} from './pdfPrintWindow'

const printDocument: PdfPrintWindowDocument = {
  editorCodeFontFamily: 'Fira Code',
  editorRootFontFamily: 'Open Sans',
  failedImageCount: 0,
  fileName: 'draft.md',
  html: '<p>Current unsaved content</p>',
  interactiveMediaLabel: 'Interactive content',
  jobId: '42',
  rootFontSize: '16px',
  rootLineHeight: '1.65',
}

describe('PDF print window protocol', () => {
  beforeEach(() => {
    tauriMocks.emitTo.mockClear()
    tauriMocks.sourceHandlers.clear()
    tauriMocks.sourceWindow.listen.mockClear()
    tauriMocks.windows.length = 0
  })

  it('recognizes only dedicated print-window URLs', () => {
    expect(getPdfPrintWindowRequest('?mf-pdf-print-job=42&mf-pdf-print-source=main')).toEqual({
      jobId: '42',
      sourceLabel: 'main',
    })
    expect(getPdfPrintWindowRequest('?unrelated=true')).toBeNull()
  })

  it('opens a hidden dedicated window and sends the prepared document after its handshake', async () => {
    const printing = openPdfPrintWindow(printDocument, new AbortController().signal)

    await vi.waitFor(() => expect(tauriMocks.windows).toHaveLength(1))
    const printWindow = tauriMocks.windows[0]!
    expect(printWindow.label).toBe('mf-pdf-print-main-42')
    expect(printWindow.options).toMatchObject({
      skipTaskbar: true,
      title: 'draft.md',
      visible: false,
      width: 816,
    })

    tauriMocks.sourceHandlers.get(PDF_PRINT_WINDOW_READY_EVENT)?.({
      payload: { jobId: '42', sourceLabel: 'main', windowLabel: printWindow.label },
    })
    await vi.waitFor(() => expect(tauriMocks.emitTo).toHaveBeenCalled())
    expect(tauriMocks.emitTo).toHaveBeenCalledWith(
      printWindow.label,
      PDF_PRINT_WINDOW_DATA_EVENT,
      expect.objectContaining({
        html: '<p>Current unsaved content</p>',
        jobId: '42',
        sourceLabel: 'main',
      }),
    )

    tauriMocks.sourceHandlers.get(PDF_PRINT_WINDOW_RESULT_EVENT)?.({
      payload: { failedImageCount: 0, jobId: '42', status: 'complete' },
    })
    await expect(printing).resolves.toEqual({
      failedImageCount: 0,
      jobId: '42',
      status: 'complete',
    })
  })

  it('treats closing the dedicated window as a print cancellation', async () => {
    const printing = openPdfPrintWindow(printDocument, new AbortController().signal)
    await vi.waitFor(() => expect(tauriMocks.windows).toHaveLength(1))

    tauriMocks.windows[0]?.handlers.get('tauri://destroyed')?.({ payload: null })
    await expect(printing).resolves.toBeNull()
  })

  it('destroys the dedicated window when the owning editor is closed', async () => {
    const abortController = new AbortController()
    const printing = openPdfPrintWindow(printDocument, abortController.signal)
    await vi.waitFor(() => expect(tauriMocks.windows).toHaveLength(1))

    abortController.abort()
    await expect(printing).rejects.toMatchObject({ name: 'AbortError' })
    expect(tauriMocks.windows[0]?.destroy).toHaveBeenCalledOnce()
  })
})
