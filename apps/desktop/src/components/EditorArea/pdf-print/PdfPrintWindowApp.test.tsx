import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const windowMocks = vi.hoisted(() => ({
  dataHandler: undefined as ((event: { payload: unknown }) => void) | undefined,
  destroy: vi.fn(async () => undefined),
  emitTo: vi.fn<(target: string, event: string, payload: unknown) => Promise<void>>(
    async () => undefined,
  ),
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
  invokeSystemPrint: vi.fn<() => Promise<void>>(async () => undefined),
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
  PDF_PRINT_WINDOW_PREPARED_EVENT,
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
    windowMocks.emitTo.mockReset().mockResolvedValue(undefined)
    windowMocks.listen.mockClear()
    windowMocks.setFocus.mockClear()
    windowMocks.show.mockClear()
    printMocks.createPrintDialogCompletionObserver.mockClear()
    printMocks.invokeSystemPrint.mockReset().mockResolvedValue(undefined)
    printMocks.preparePrintDocument.mockClear()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const transferDocument = async () => {
    await act(async () => {
      root.render(<PdfPrintWindowApp request={{ jobId: '42', sourceLabel: 'main' }} />)
    })
    const payload: PdfPrintWindowPayload = {
      failedImageCount: 0,
      fileName: 'draft.md',
      html: '<p>Current unsaved content</p>',
      interactiveMediaLabel: 'Interactive content',
      jobId: '42',
      sourceLabel: 'main',
    }
    await act(async () => {
      windowMocks.dataHandler?.({ payload })
    })
  }

  it('does not start printing if unmounted while the prepared notification is pending', async () => {
    let preparedDelivered!: () => void
    windowMocks.emitTo.mockImplementation(async (_target, event) => {
      if (event === PDF_PRINT_WINDOW_PREPARED_EVENT)
        await new Promise<void>((resolve) => { preparedDelivered = resolve })
    })
    await transferDocument()
    await vi.waitFor(() => expect(preparedDelivered).toBeTypeOf('function'))
    expect(printMocks.invokeSystemPrint).not.toHaveBeenCalled()

    await act(async () => root.unmount())
    await act(async () => preparedDelivered())

    expect(printMocks.invokeSystemPrint).not.toHaveBeenCalled()
    expect(windowMocks.emitTo.mock.calls.some(([, event]) => event === PDF_PRINT_WINDOW_RESULT_EVENT)).toBe(false)
    expect(windowMocks.destroy).not.toHaveBeenCalled()
    const observer = await printMocks.createPrintDialogCompletionObserver.mock.results[0]!.value
    expect(observer.dispose).toHaveBeenCalledOnce()
  })

  it('keeps the prepared window alive until native printing finishes', async () => {
    let finishPrinting!: () => void
    printMocks.invokeSystemPrint.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishPrinting = resolve }),
    )
    await transferDocument()
    await vi.waitFor(() => expect(printMocks.invokeSystemPrint).toHaveBeenCalledOnce())

    expect(windowMocks.emitTo).toHaveBeenCalledWith('main', PDF_PRINT_WINDOW_PREPARED_EVENT, {
      jobId: '42', sourceLabel: 'main', windowLabel: windowMocks.label,
    })
    expect(windowMocks.emitTo.mock.calls.some(([, event]) => event === PDF_PRINT_WINDOW_RESULT_EVENT)).toBe(false)
    expect(windowMocks.destroy).not.toHaveBeenCalled()

    await act(async () => finishPrinting())

    expect(windowMocks.emitTo).toHaveBeenCalledWith('main', PDF_PRINT_WINDOW_RESULT_EVENT, {
      failedImageCount: 2, jobId: '42', status: 'complete',
    })
    expect(windowMocks.destroy).toHaveBeenCalledOnce()
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
    expect(windowMocks.emitTo).toHaveBeenCalledWith('main', PDF_PRINT_WINDOW_PREPARED_EVENT, {
      jobId: '42',
      sourceLabel: 'main',
      windowLabel: windowMocks.label,
    })
    const preparedCall = windowMocks.emitTo.mock.calls.findIndex(
      (args) => args[1] === PDF_PRINT_WINDOW_PREPARED_EVENT,
    )
    expect(windowMocks.emitTo.mock.invocationCallOrder[preparedCall]).toBeLessThan(
      printMocks.invokeSystemPrint.mock.invocationCallOrder[0]!,
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
