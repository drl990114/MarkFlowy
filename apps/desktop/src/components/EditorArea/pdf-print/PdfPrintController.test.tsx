import bus from '@/helper/eventBus'
import { act } from 'react'
import { waitFor } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDF_PRINT_EVENT } from './pdfPrintMenuItem'
import { PdfPrintController } from './PdfPrintController'
import type { preparePrintDocument } from './printDocument'
import * as rmeRuntime from '../rmeRuntime'

const previewState = vi.hoisted(() => ({
  docs: [] as string[],
  error: null as Error | null,
  hydration: { settled: Promise.resolve() },
  onHydrationChange: undefined as
    | ((hydration: { settled: Promise<void> } | null) => void)
    | undefined,
}))

const printMocks = vi.hoisted(() => ({
  openPdfPrintWindow: vi.fn(),
  preparePrintDocument: vi.fn<typeof preparePrintDocument>(),
}))

const toastMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(() => 'loading-toast'),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/helper/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      values?.count === undefined ? key : `${key}:${values.count}`,
  }),
}))

vi.mock('@/stores/useAppSettingStore', () => ({
  default: (selector: (state: unknown) => unknown) =>
    selector({
      settingData: {
        editor_code_font_family: 'Fira Code',
        editor_root_font_family: 'Open Sans',
      },
    }),
}))

vi.mock('zens', () => ({
  toast: toastMocks,
}))

vi.mock('rme', async () => {
  const React = await import('react')

  return {
    Preview: (props: {
      doc: string
      onError?: (error: Error) => void
      onImageHydrationChange?: (hydration: { settled: Promise<void> } | null) => void
    }) => {
      const { doc, onError, onImageHydrationChange } = props
      const callbacks = React.useRef({ onError, onImageHydrationChange })
      callbacks.current = { onError, onImageHydrationChange }
      const hydration = previewState.hydration
      previewState.docs.push(doc)
      previewState.onHydrationChange = onImageHydrationChange
      React.useLayoutEffect(() => {
        if (previewState.error) callbacks.current.onError?.(previewState.error)
        callbacks.current.onImageHydrationChange?.(hydration)
        return () => callbacks.current.onImageHydrationChange?.(null)
      }, [doc, hydration])
      return React.createElement(
        'div',
        { className: 'mf-preview-content' },
        React.createElement('article', { 'data-preview-doc': doc }, doc),
      )
    },
  }
})

vi.mock('./printDocument', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    preparePrintDocument: printMocks.preparePrintDocument,
  }
})

vi.mock('./pdfPrintWindow', () => ({
  openPdfPrintWindow: printMocks.openPdfPrintWindow,
}))

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('PdfPrintController', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    document.title = 'MarkFlowy'
    previewState.docs = []
    previewState.error = null
    previewState.hydration = { settled: Promise.resolve() }
    previewState.onHydrationChange = undefined
    printMocks.preparePrintDocument.mockReset().mockResolvedValue({ failedImageCount: 0 })
    printMocks.openPdfPrintWindow.mockReset().mockResolvedValue({
      failedImageCount: 0,
      jobId: '1',
      status: 'complete',
    })
    Object.values(toastMocks).forEach((mock) => mock.mockClear())
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  async function renderController(getContent = () => '# Current unsaved Markdown') {
    await act(async () => {
      root.render(
        <PdfPrintController
          active
          enabled
          fileName='draft.md'
          getContent={getContent}
          delegateOptions={{}}
          styleToken={{ rootFontSize: '18px', rootLineHeight: '1.8' }}
        />,
      )
    })
  }

  async function requestPrint() {
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    await waitFor(() => expect(printMocks.openPdfPrintWindow).toHaveBeenCalled())
  }

  it('loads the renderer only on demand and releases the print lock after an import failure', async () => {
    const load = vi
      .spyOn(rmeRuntime, 'loadRmeRuntime')
      .mockRejectedValueOnce(new Error('Renderer unavailable'))
    await renderController()
    expect(load).not.toHaveBeenCalled()
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith('Renderer unavailable'))
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    await requestPrint()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not mount a renderer after its editor closes while the import is pending', async () => {
    const runtime = await rmeRuntime.loadRmeRuntime()
    let resolve!: (value: typeof runtime) => void
    vi.spyOn(rmeRuntime, 'loadRmeRuntime').mockReturnValueOnce(
      new Promise((yes) => {
        resolve = yes
      }),
    )
    await renderController()
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    await act(async () => root.render(null))
    await act(async () => resolve(runtime))
    expect(previewState.docs).toEqual([])
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    await renderController()
    await requestPrint()
  })

  it.each(['source', 'wysiwyg', 'preview'])(
    'renders the current unsaved Markdown when requested from %s mode',
    async (mode) => {
      const getContent = vi.fn(() => `# Unsaved from ${mode}`)
      await renderController(getContent)
      await requestPrint()

      expect(getContent).toHaveBeenCalledOnce()
      expect(previewState.docs).toContain(`# Unsaved from ${mode}`)
      expect(printMocks.preparePrintDocument).toHaveBeenCalledOnce()
      expect(printMocks.openPdfPrintWindow.mock.calls[0]?.[0].html).toContain(
        `# Unsaved from ${mode}`,
      )
    },
  )

  it('does not open the print window until document preparation finishes', async () => {
    let finishPreparation!: (value: { failedImageCount: number }) => void
    printMocks.preparePrintDocument.mockReturnValue(
      new Promise((resolve) => {
        finishPreparation = resolve
      }),
    )
    await renderController()

    act(() => bus.emit(PDF_PRINT_EVENT))
    await act(async () => Promise.resolve())
    const printRoot = document.querySelector<HTMLElement>('.mf-pdf-print-root')
    expect(getComputedStyle(printRoot!).display).not.toBe('none')
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()

    await act(async () => {
      finishPreparation({ failedImageCount: 0 })
      await vi.waitFor(() => expect(printMocks.openPdfPrintWindow).toHaveBeenCalledOnce())
    })
  })

  it('restarts preparation when a theme rerender settles an obsolete hydration', async () => {
    let settleFirst!: () => void
    let settleCurrent!: () => void
    previewState.hydration = {
      settled: new Promise<void>((resolve) => {
        settleFirst = resolve
      }),
    }
    const currentHydration = {
      settled: new Promise<void>((resolve) => {
        settleCurrent = resolve
      }),
    }
    printMocks.preparePrintDocument.mockImplementation(
      ({ hydration, signal }) =>
        new Promise((resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Preparation replaced', 'AbortError')),
            { once: true },
          )
          void hydration.settled.then(() => resolve({ failedImageCount: 0 }))
        }),
    )
    const getContent = vi.fn(() => '# Cold Mermaid render')
    await renderController(getContent)
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    expect(printMocks.preparePrintDocument).toHaveBeenCalledOnce()
    const firstSignal = printMocks.preparePrintDocument.mock.calls[0]![0].signal!

    await act(async () => {
      // Preview settles the old promise during layout cleanup before publishing
      // the replacement that is still rendering its cold Mermaid dependency.
      settleFirst()
      previewState.onHydrationChange?.(null)
      previewState.hydration = currentHydration
      previewState.onHydrationChange?.(currentHydration)
    })

    expect(firstSignal.aborted).toBe(true)
    expect(printMocks.preparePrintDocument).toHaveBeenCalledTimes(2)
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    expect(toastMocks.error).not.toHaveBeenCalled()
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    expect(getContent).toHaveBeenCalledOnce()

    await act(async () => settleCurrent())
    await waitFor(() => expect(printMocks.openPdfPrintWindow).toHaveBeenCalledOnce())
    expect(printMocks.openPdfPrintWindow.mock.calls[0]?.[0].html).toContain(
      'Cold Mermaid render',
    )
  })

  it('keeps an opened print window alive when Preview hydration changes', async () => {
    let closeWindow!: () => void
    printMocks.openPdfPrintWindow.mockImplementation(
      () =>
        new Promise((resolve) => {
          closeWindow = () => resolve(null)
        }),
    )
    const getContent = vi.fn(() => '# Snapshot already transferred')
    await renderController(getContent)
    await requestPrint()
    const printSignal = printMocks.openPdfPrintWindow.mock.calls[0]![1] as AbortSignal

    await act(async () => {
      previewState.onHydrationChange?.(null)
      previewState.hydration = { settled: Promise.resolve() }
      previewState.onHydrationChange?.(previewState.hydration)
    })
    await act(async () => bus.emit(PDF_PRINT_EVENT))

    expect(printSignal.aborted).toBe(false)
    expect(printMocks.openPdfPrintWindow).toHaveBeenCalledOnce()
    expect(getContent).toHaveBeenCalledOnce()
    await act(async () => closeWindow())
    expect(document.querySelector('.mf-pdf-print-root')).toBeNull()
  })

  it('keeps the main window unchanged and cleans up after the print window closes', async () => {
    printMocks.preparePrintDocument.mockResolvedValue({ failedImageCount: 1 })
    printMocks.openPdfPrintWindow.mockImplementation(async (printDocument) => {
      expect(document.title).toBe('MarkFlowy')
      const printRoot = document.querySelector<HTMLElement>('.mf-pdf-print-root')
      expect(printRoot?.getAttribute('aria-hidden')).toBe('true')
      expect(getComputedStyle(container).display).not.toBe('none')
      expect(getComputedStyle(printRoot!).display).not.toBe('none')
      expect(printDocument).toMatchObject({
        editorCodeFontFamily: 'Fira Code',
        editorRootFontFamily: 'Open Sans',
        failedImageCount: 1,
        fileName: 'draft.md',
        jobId: expect.any(String),
        rootFontSize: '18px',
        rootLineHeight: '1.8',
      })
      return { failedImageCount: 1, jobId: '1', status: 'complete' }
    })
    await renderController()
    await requestPrint()

    await act(async () => {
      await vi.waitFor(() => expect(document.querySelector('.mf-pdf-print-root')).toBeNull())
    })
    expect(toastMocks.warning).toHaveBeenCalledWith(
      'contextmenu.editor_tab.export_pdf_image_warning:1',
    )
    expect(toastMocks.success).not.toHaveBeenCalled()
    expect(document.title).toBe('MarkFlowy')
    expect(toastMocks.dismiss).toHaveBeenCalledWith('loading-toast')
  })

  it('dismisses progress when prepared even if native completion never arrives', async () => {
    let closeWindow!: () => void
    printMocks.openPdfPrintWindow.mockImplementation(
      () => new Promise((resolve) => {
        closeWindow = () => resolve(null)
      }),
    )
    await renderController()
    await requestPrint()
    expect(toastMocks.dismiss).not.toHaveBeenCalled()

    const [, printSignal, options] = printMocks.openPdfPrintWindow.mock.calls[0]!
    await act(async () => options.onPrepared())

    expect(toastMocks.dismiss).toHaveBeenCalledWith('loading-toast')
    expect(toastMocks.success).not.toHaveBeenCalled()
    expect(printSignal.aborted).toBe(false)
    expect(document.querySelector('.mf-pdf-print-root')).not.toBeNull()
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    expect(printMocks.openPdfPrintWindow).toHaveBeenCalledOnce()
    await act(async () => closeWindow())
    expect(document.querySelector('.mf-pdf-print-root')).toBeNull()
  })

  it('cancels printing on renderer errors and performs cleanup', async () => {
    previewState.error = new Error('Mermaid failed')
    await renderController()

    await act(async () => bus.emit(PDF_PRINT_EVENT))
    await waitFor(() => expect(toastMocks.error).toHaveBeenCalled())

    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    expect(document.title).toBe('MarkFlowy')
    expect(document.querySelector('.mf-pdf-print-root')).toBeNull()
  })

  it.each([new Error('Finish composing before using this action.'), 'Snapshot unavailable'])(
    'releases the print task when content cannot be read: %s',
    async (error) => {
      const getContent = vi.fn((): string => {
        // External editor implementations can throw non-Error values.
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw error
      })
      await renderController(getContent)

      act(() => {
        expect(() => bus.emit(PDF_PRINT_EVENT)).not.toThrow()
      })
      expect(toastMocks.error).toHaveBeenCalledWith(error instanceof Error ? error.message : error)
      expect(previewState.docs).toEqual([])
      expect(printMocks.preparePrintDocument).not.toHaveBeenCalled()
      expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
      expect(document.querySelector('.mf-pdf-print-root')).toBeNull()

      getContent.mockReturnValue('# Committed after retry')
      await requestPrint()
      expect(getContent).toHaveBeenCalledTimes(2)
      expect(printMocks.openPdfPrintWindow.mock.calls[0]?.[0].html).toContain(
        'Committed after retry',
      )
    },
  )

  it('rejects duplicate print requests while one task is preparing', async () => {
    let finishPreparation!: (value: { failedImageCount: number }) => void
    printMocks.preparePrintDocument.mockReturnValue(
      new Promise((resolve) => {
        finishPreparation = resolve
      }),
    )
    const getContent = vi.fn(() => '# One print job')
    await renderController(getContent)

    act(() => {
      bus.emit(PDF_PRINT_EVENT)
      bus.emit(PDF_PRINT_EVENT)
    })
    await act(async () => Promise.resolve())
    expect(getContent).toHaveBeenCalledOnce()
    expect(printMocks.preparePrintDocument).toHaveBeenCalledOnce()

    await act(async () => {
      finishPreparation({ failedImageCount: 0 })
      await vi.waitFor(() => expect(printMocks.openPdfPrintWindow).toHaveBeenCalledOnce())
    })
  })

  it('does not subscribe when the active file is not Markdown', async () => {
    const getContent = vi.fn(() => 'plain text')
    await act(async () => {
      root.render(
        <PdfPrintController
          active
          enabled={false}
          fileName='notes.txt'
          getContent={getContent}
          delegateOptions={{}}
          styleToken={{}}
        />,
      )
    })

    act(() => bus.emit(PDF_PRINT_EVENT))
    await act(async () => Promise.resolve())

    expect(getContent).not.toHaveBeenCalled()
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
  })
})
