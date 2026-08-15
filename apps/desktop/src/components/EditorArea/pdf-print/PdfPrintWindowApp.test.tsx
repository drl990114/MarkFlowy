import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const windowMocks = vi.hoisted(() => ({
  dataHandler: undefined as ((event: { payload: unknown }) => void) | undefined,
  destroy: vi.fn(async () => undefined),
  emitTo: vi.fn(async () => undefined),
  label: 'mf-pdf-print-main-42',
  listen: vi.fn(async (_event: string, handler: (event: { payload: unknown }) => void) => {
    windowMocks.dataHandler = handler
    return () => {
      windowMocks.dataHandler = undefined
    }
  }),
  setFocus: vi.fn(async () => undefined),
  show: vi.fn(async () => undefined),
}))

const printMocks = vi.hoisted(() => ({
  createPrintDialogCompletionObserver: vi.fn(async () => ({
    dispose: vi.fn(),
    settled: Promise.resolve(),
  })),
  invokeSystemPrint: vi.fn(async () => undefined),
  preparePrintDocument: vi.fn(async () => ({ failedImageCount: 2 })),
}))

vi.mock('@tauri-apps/api/event', () => ({
  emitTo: windowMocks.emitTo,
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    destroy: windowMocks.destroy,
    label: windowMocks.label,
    listen: windowMocks.listen,
    setFocus: windowMocks.setFocus,
    show: windowMocks.show,
  }),
}))

vi.mock('rme', async () => {
  const React = await import('react')
  return {
    WysiwygThemeWrapper: ({
      children,
      rootFontSize,
      rootLineHeight,
    }: {
      children: ReactNode
      rootFontSize?: string
      rootLineHeight?: string
    }) =>
      React.createElement(
        'div',
        { 'data-font-size': rootFontSize, 'data-line-height': rootLineHeight },
        children,
      ),
  }
})

vi.mock('./printDialogCompletion', () => ({
  createPrintDialogCompletionObserver: printMocks.createPrintDialogCompletionObserver,
}))

vi.mock('./printDocument', () => ({
  invokeSystemPrint: printMocks.invokeSystemPrint,
  preparePrintDocument: printMocks.preparePrintDocument,
}))

import { PdfPrintWindowApp } from './PdfPrintWindowApp'
import {
  PDF_PRINT_WINDOW_READY_EVENT,
  PDF_PRINT_WINDOW_RESULT_EVENT,
  type PdfPrintWindowPayload,
} from './pdfPrintWindow'

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('PdfPrintWindowApp', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    windowMocks.dataHandler = undefined
    windowMocks.destroy.mockClear()
    windowMocks.emitTo.mockClear()
    windowMocks.listen.mockClear()
    windowMocks.setFocus.mockClear()
    windowMocks.show.mockClear()
    printMocks.createPrintDialogCompletionObserver.mockClear()
    printMocks.invokeSystemPrint.mockClear()
    printMocks.preparePrintDocument.mockClear()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders the transferred document and prints only from the dedicated window', async () => {
    await act(async () => {
      root.render(
        <PdfPrintWindowApp request={{ jobId: '42', sourceLabel: 'main' }} />,
      )
    })
    await vi.waitFor(() =>
      expect(windowMocks.emitTo).toHaveBeenCalledWith(
        'main',
        PDF_PRINT_WINDOW_READY_EVENT,
        expect.objectContaining({ jobId: '42', windowLabel: windowMocks.label }),
      ),
    )

    const payload: PdfPrintWindowPayload = {
      editorCodeFontFamily: 'Fira Code',
      editorRootFontFamily: 'Open Sans',
      failedImageCount: 1,
      fileName: 'draft.md',
      html: '<p><strong>Current unsaved content</strong></p>',
      interactiveMediaLabel: 'Interactive content',
      jobId: '42',
      rootFontSize: '18px',
      rootLineHeight: '1.8',
      sourceLabel: 'main',
    }
    await act(async () => {
      windowMocks.dataHandler?.({ payload })
    })

    await vi.waitFor(() => expect(printMocks.invokeSystemPrint).toHaveBeenCalledOnce())
    expect(container.querySelector('.mf-preview-content strong')?.textContent).toBe(
      'Current unsaved content',
    )
    expect(container.querySelector('[data-font-size="18px"]')).not.toBeNull()
    expect(windowMocks.show).toHaveBeenCalledOnce()
    expect(windowMocks.setFocus).toHaveBeenCalledOnce()
    expect(printMocks.preparePrintDocument).toHaveBeenCalledWith(
      expect.objectContaining({ interactiveMediaLabel: 'Interactive content' }),
    )
    await vi.waitFor(() =>
      expect(windowMocks.emitTo).toHaveBeenCalledWith('main', PDF_PRINT_WINDOW_RESULT_EVENT, {
        failedImageCount: 2,
        jobId: '42',
        status: 'complete',
      }),
    )
    expect(windowMocks.destroy).toHaveBeenCalledOnce()
  })
})
