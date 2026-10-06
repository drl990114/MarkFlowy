import bus from '@/helper/eventBus'
import { act } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { Toaster, toast as sonnerToast } from 'sonner'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDF_PRINT_EVENT } from './pdfPrintMenuItem'
import { PdfPrintController } from './PdfPrintController'
import type { preparePrintDocument } from './printDocument'
import * as rmeRuntime from '../rmeRuntime'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { PDF_EXPORT_EVENT } from '../pdf-export/pdfExportMenuItem'
import type { PdfExportDialogProps } from '../pdf-export/PdfExportDialog'
import type * as PdfExportService from '../pdf-export/pdfExport'

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
  dismiss: vi.fn<typeof sonnerToast.dismiss>(),
  error: vi.fn<typeof sonnerToast.error>(),
  loading: vi.fn<typeof sonnerToast.loading>(() => 'loading-toast'),
  success: vi.fn<typeof sonnerToast.success>(),
  warning: vi.fn<typeof sonnerToast.warning>(),
}))

const exportMocks = vi.hoisted(() => ({
  probeBrowser: vi.fn(),
  exportPdf: vi.fn(),
  buildDocument: vi.fn(),
  save: vi.fn(),
  reveal: vi.fn(),
}))

const exportUi = vi.hoisted(() => ({ props: undefined as PdfExportDialogProps | undefined }))
const translate = vi.hoisted(() => (key: string, values?: { count?: number; path?: string }) => {
  if (values?.count !== undefined) return `${key}:${values.count}`
  if (values?.path) return `${key}:${values.path}`
  return key
})

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: exportMocks.save }))
vi.mock('@tauri-apps/plugin-opener', () => ({ revealItemInDir: exportMocks.reveal }))
vi.mock('../pdf-export/pdfExport', async (importOriginal) => {
  const original = await importOriginal<typeof PdfExportService>()
  return {
    ...original,
    probePdfBrowser: exportMocks.probeBrowser,
    exportPdfWithBrowser: exportMocks.exportPdf,
  }
})
vi.mock('../pdf-export/pdfExportDocument', () => ({
  buildPdfExportDocument: exportMocks.buildDocument,
}))
vi.mock('../pdf-export/PdfExportDialog', () => ({
  PdfExportDialog: (props: PdfExportDialogProps) => {
    exportUi.props = props
    return (
      <div role='dialog' aria-label='PDF export'>
        <p role='status'>
          {props.busy
            ? 'pdf_export.exporting'
            : props.checking
              ? 'Checking browser'
              : (props.browserInfo?.version ?? 'No browser')}
        </p>
        {props.error ? <p role='alert'>{props.error}</p> : null}
        <button
          disabled={props.busy || props.checking || !props.browserInfo?.compatible}
          onClick={() =>
            props.onExport({ paperSize: 'a4', landscape: false, includeOutline: true })
          }
        >
          Export A4
        </button>
        <button
          disabled={props.busy || props.checking || !props.browserInfo?.compatible}
          onClick={() =>
            props.onExport({ paperSize: 'letter', landscape: true, includeOutline: false })
          }
        >
          Export Letter
        </button>
        <button disabled={props.busy} onClick={props.onPrint}>
          System print
        </button>
        <button onClick={() => props.onOpenChange(false)}>Cancel export</button>
      </div>
    )
  },
}))

vi.mock('@/helper/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: translate }),
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
    useAppSettingStore.setState({
      settingData: {
        editor_code_font_family: 'Fira Code',
        editor_root_font_family: 'Open Sans',
      },
    })
    exportUi.props = undefined
    exportMocks.probeBrowser.mockReset().mockResolvedValue({
      available: true,
      compatible: true,
      version: 'Chromium 130',
      executablePath: '/local/chromium',
    })
    exportMocks.buildDocument.mockReset().mockResolvedValue({
      html: '<html><body>Prepared PDF snapshot</body></html>',
      headingCount: 2,
    })
    exportMocks.exportPdf.mockReset().mockResolvedValue({ outputPath: '/exports/draft.pdf' })
    exportMocks.save.mockReset().mockResolvedValue('/exports/draft.pdf')
    exportMocks.reveal.mockReset().mockResolvedValue(undefined)
    printMocks.preparePrintDocument.mockReset().mockResolvedValue({ failedImageCount: 0 })
    printMocks.openPdfPrintWindow.mockReset().mockResolvedValue({
      failedImageCount: 0,
      jobId: '1',
      status: 'complete',
    })
    Object.values(toastMocks).forEach((mock) => mock.mockReset())
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  async function renderController(
    getContent = () => '# Current unsaved Markdown',
    filePath?: string,
    withNotifications = false,
  ) {
    await act(async () => {
      root.render(
        <>
          <PdfPrintController
            active
            enabled
            fileName='draft.md'
            filePath={filePath}
            getContent={getContent}
            delegateOptions={{}}
            styleToken={{ rootFontSize: '18px', rootLineHeight: '1.8' }}
          />
          {withNotifications ? <Toaster closeButton /> : null}
        </>,
      )
    })
  }

  async function requestPrint() {
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    await waitFor(() => expect(printMocks.openPdfPrintWindow).toHaveBeenCalled())
  }

  async function requestExport() {
    await act(async () => bus.emit(PDF_EXPORT_EVENT))
    await screen.findByRole('dialog', { name: 'PDF export' })
    await waitFor(() => expect(exportUi.props?.checking).toBe(false))
  }

  async function clickExport(name = 'Export A4') {
    await act(async () => fireEvent.click(screen.getByRole('button', { name })))
  }

  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    return { promise, resolve, reject }
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
    expect(printMocks.openPdfPrintWindow.mock.calls[0]?.[0].html).toContain('Cold Mermaid render')
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
      () =>
        new Promise((resolve) => {
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

  it.each([
    { button: 'Export A4', paperSize: 'a4', landscape: false, includeOutline: true },
    { button: 'Export Letter', paperSize: 'letter', landscape: true, includeOutline: false },
  ])('exports the captured unsaved document with selected options: $button', async (options) => {
    const getContent = vi.fn(() => '# Captured unsaved document')
    await renderController(getContent, '/notes/draft.md')
    await requestExport()
    expect(previewState.docs).toEqual([])

    // Editing or renaming after opening the dialog must not change this job.
    getContent.mockReturnValue('# Later document content')
    await renderController(getContent, '/other/renamed.md')
    await clickExport(options.button)
    await waitFor(() => expect(exportMocks.exportPdf).toHaveBeenCalledOnce())

    expect(getContent).toHaveBeenCalledOnce()
    expect(previewState.docs).toContain('# Captured unsaved document')
    expect(previewState.docs).not.toContain('# Later document content')
    expect(exportMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'draft.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      }),
    )
    expect(exportMocks.buildDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Captured unsaved document'),
        title: 'draft.md',
        fileFolderPath: '/notes',
        paperSize: options.paperSize,
        landscape: options.landscape,
      }),
    )
    expect(exportMocks.exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: '/notes/draft.md',
        outputPath: '/exports/draft.pdf',
        executablePath: '/local/chromium',
        html: '<html><body>Prepared PDF snapshot</body></html>',
        paperSize: options.paperSize,
        landscape: options.landscape,
        includeOutline: options.includeOutline,
        jobId: expect.any(String),
      }),
      expect.any(AbortSignal),
    )
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    expect(toastMocks.success).toHaveBeenCalledWith(
      'pdf_export.success:/exports/draft.pdf',
      expect.any(Object),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('does not render or prepare resources when the native save picker is cancelled', async () => {
    exportMocks.save.mockResolvedValueOnce(null)
    const load = vi.spyOn(rmeRuntime, 'loadRmeRuntime')
    await renderController()
    await requestExport()
    await clickExport()

    expect(load).not.toHaveBeenCalled()
    expect(previewState.docs).toEqual([])
    expect(printMocks.preparePrintDocument).not.toHaveBeenCalled()
    expect(exportMocks.buildDocument).not.toHaveBeenCalled()
    expect(exportMocks.exportPdf).not.toHaveBeenCalled()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Export A4' }).disabled).toBe(
      false,
    )
    await clickExport()
    await waitFor(() => expect(exportMocks.exportPdf).toHaveBeenCalledOnce())
  })

  it.each([
    { available: true, compatible: false },
    { available: false, compatible: true },
  ])(
    'rejects unsupported or unavailable browser capabilities before opening a save picker: %j',
    async (capability) => {
      exportMocks.probeBrowser.mockResolvedValue({
        ...capability,
        version: 'Unsupported browser',
        executablePath: '/unsupported/browser',
      })
      await renderController()
      await requestExport()
      // Exercise the controller guard even if a caller invokes its callback.
      await act(async () =>
        exportUi.props?.onExport({ paperSize: 'a4', landscape: false, includeOutline: true }),
      )
      expect(exportMocks.save).not.toHaveBeenCalled()
      expect(previewState.docs).toEqual([])
      expect(exportMocks.exportPdf).not.toHaveBeenCalled()
    },
  )

  it('cancels resource preparation and releases the lock before a PDF process starts', async () => {
    printMocks.preparePrintDocument.mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          )
        }),
    )
    await renderController()
    await requestExport()
    await clickExport()
    await waitFor(() => expect(printMocks.preparePrintDocument).toHaveBeenCalledOnce())
    const preparationSignal = printMocks.preparePrintDocument.mock.calls[0]![0].signal!
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel export' })))

    expect(preparationSignal.aborted).toBe(true)
    expect(exportMocks.buildDocument).not.toHaveBeenCalled()
    expect(exportMocks.exportPdf).not.toHaveBeenCalled()
    expect(toastMocks.error).not.toHaveBeenCalled()
    expect(document.querySelector('.mf-pdf-print-root')).toBeNull()
    printMocks.preparePrintDocument.mockResolvedValue({ failedImageCount: 0 })
    await requestPrint()
  })

  it('aborts a running PDF export and keeps a newer dialog alive when old work rejects', async () => {
    const oldExport = deferred<{ outputPath: string }>()
    exportMocks.exportPdf.mockReturnValueOnce(oldExport.promise)
    const getContent = vi.fn(() => '# First snapshot')
    await renderController(getContent)
    await requestExport()
    await clickExport()
    await waitFor(() => expect(exportMocks.exportPdf).toHaveBeenCalledOnce())
    const signal = exportMocks.exportPdf.mock.calls[0]![1] as AbortSignal

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel export' })))
    expect(signal.aborted).toBe(true)
    getContent.mockReturnValue('# New snapshot')
    await requestExport()
    await act(async () => oldExport.reject(new DOMException('Old export cancelled', 'AbortError')))

    expect(screen.getByRole('dialog', { name: 'PDF export' })).toBeTruthy()
    expect(toastMocks.error).not.toHaveBeenCalled()
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    expect(getContent).toHaveBeenCalledTimes(2)
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    await clickExport()
    await waitFor(() => expect(exportMocks.exportPdf).toHaveBeenCalledTimes(2))
    expect(exportMocks.buildDocument.mock.calls.at(-1)?.[0].html).toContain('New snapshot')
  })

  it('ignores a save picker reply after export cancellation', async () => {
    const picker = deferred<string | null>()
    exportMocks.save.mockReturnValueOnce(picker.promise)
    const load = vi.spyOn(rmeRuntime, 'loadRmeRuntime')
    await renderController()
    await requestExport()
    await clickExport()
    expect(exportMocks.save).toHaveBeenCalledOnce()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel export' })))
    await act(async () => picker.resolve('/exports/cancelled.pdf'))

    expect(load).not.toHaveBeenCalled()
    expect(previewState.docs).toEqual([])
    expect(exportMocks.exportPdf).not.toHaveBeenCalled()
    expect(toastMocks.error).not.toHaveBeenCalled()
    await requestPrint()
  })

  it('uses the captured snapshot for system print fallback without a compatible browser', async () => {
    exportMocks.probeBrowser.mockResolvedValue({ available: false, compatible: false })
    const getContent = vi.fn(() => '# Print fallback snapshot')
    await renderController(getContent)
    await requestExport()
    getContent.mockReturnValue('# Later content')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'System print' })))
    await waitFor(() => expect(printMocks.openPdfPrintWindow).toHaveBeenCalledOnce())

    expect(printMocks.openPdfPrintWindow.mock.calls[0]?.[0].html).toContain(
      'Print fallback snapshot',
    )
    expect(getContent).toHaveBeenCalledOnce()
    expect(exportMocks.save).not.toHaveBeenCalled()
    expect(exportMocks.exportPdf).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shares one lock across export, duplicate export and system print requests', async () => {
    const picker = deferred<string | null>()
    exportMocks.save.mockReturnValueOnce(picker.promise)
    const getContent = vi.fn(() => '# One document snapshot')
    await renderController(getContent)
    await act(async () => {
      bus.emit(PDF_EXPORT_EVENT)
      bus.emit(PDF_EXPORT_EVENT)
      bus.emit(PDF_PRINT_EVENT)
    })
    await screen.findByRole('dialog', { name: 'PDF export' })
    await waitFor(() => expect(exportUi.props?.checking).toBe(false))
    expect(getContent).toHaveBeenCalledOnce()
    expect(exportMocks.probeBrowser).toHaveBeenCalledOnce()
    await clickExport()
    await act(async () => {
      exportUi.props?.onExport({ paperSize: 'letter', landscape: true, includeOutline: false })
      exportUi.props?.onPrint()
      bus.emit(PDF_PRINT_EVENT)
    })
    expect(exportMocks.save).toHaveBeenCalledOnce()
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    expect(getContent).toHaveBeenCalledOnce()
    await act(async () => picker.resolve('/exports/draft.pdf'))
    await waitFor(() => expect(exportMocks.exportPdf).toHaveBeenCalledOnce())
  })

  it('ignores an export request while system print preparation owns the shared lock', async () => {
    const preparation = deferred<{ failedImageCount: number }>()
    printMocks.preparePrintDocument.mockReturnValueOnce(preparation.promise)
    const getContent = vi.fn(() => '# Already printing')
    await renderController(getContent)
    await act(async () => bus.emit(PDF_PRINT_EVENT))
    await waitFor(() => expect(printMocks.preparePrintDocument).toHaveBeenCalledOnce())
    await act(async () => bus.emit(PDF_EXPORT_EVENT))
    expect(getContent).toHaveBeenCalledOnce()
    expect(exportMocks.probeBrowser).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => preparation.resolve({ failedImageCount: 0 }))
    await waitFor(() => expect(printMocks.openPdfPrintWindow).toHaveBeenCalledOnce())
  })

  it('discards an obsolete browser probe when settings change while the dialog is open', async () => {
    const first = deferred<PdfExportService.PdfBrowserInfo>()
    const current = deferred<PdfExportService.PdfBrowserInfo>()
    exportMocks.probeBrowser
      .mockReset()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(current.promise)
    await renderController()
    await act(async () => bus.emit(PDF_EXPORT_EVENT))
    await screen.findByRole('dialog', { name: 'PDF export' })
    await act(async () =>
      useAppSettingStore.setState({ settingData: { pdf_browser_executable_path: '/new/browser' } }),
    )
    await waitFor(() => expect(exportMocks.probeBrowser).toHaveBeenLastCalledWith('/new/browser'))
    await act(async () =>
      current.resolve({
        available: true,
        compatible: true,
        version: 'New browser',
        executablePath: '/new/browser',
      }),
    )
    await act(async () =>
      first.resolve({
        available: true,
        compatible: true,
        version: 'Old browser',
        executablePath: '/old/browser',
      }),
    )
    expect(screen.getByRole('status').textContent).toBe('New browser')

    await clickExport()
    await waitFor(() => expect(exportMocks.exportPdf).toHaveBeenCalledOnce())
    expect(exportMocks.exportPdf.mock.calls[0]?.[0].executablePath).toBe('/new/browser')
  })

  it('clears a failed probe message after the browser path is corrected', async () => {
    exportMocks.probeBrowser.mockRejectedValueOnce(new Error('Initial browser probe failed'))
    await renderController()
    await requestExport()
    expect(screen.getByRole('alert').textContent).toBe('Initial browser probe failed')
    await act(async () =>
      useAppSettingStore.setState({
        settingData: { pdf_browser_executable_path: '/corrected/browser' },
      }),
    )
    await waitFor(() => expect(exportUi.props?.checking).toBe(false))
    expect(screen.getByRole('status').textContent).toBe('Chromium 130')
    expect(screen.queryByRole('alert')).toBeNull()
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

    act(() => {
      bus.emit(PDF_PRINT_EVENT)
      bus.emit(PDF_EXPORT_EVENT)
    })
    await act(async () => Promise.resolve())

    expect(getContent).not.toHaveBeenCalled()
    expect(printMocks.openPdfPrintWindow).not.toHaveBeenCalled()
    expect(exportMocks.probeBrowser).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  describe('PDF export notifications with real Sonner', () => {
    beforeEach(() => {
      toastMocks.loading.mockImplementation(sonnerToast.loading)
      toastMocks.dismiss.mockImplementation(sonnerToast.dismiss)
      toastMocks.success.mockImplementation(sonnerToast.success)
      toastMocks.error.mockImplementation(sonnerToast.error)
      toastMocks.warning.mockImplementation(sonnerToast.warning)
    })

    async function renderWithNotifications() {
      await renderController(undefined, undefined, true)
      act(() => sonnerToast.info('Existing notice', { duration: Infinity }))
      await screen.findByText('Existing notice')
    }

    async function expectNoLoadingNotifications() {
      // Sonner queues creation and animates removal. Checking only dismiss()
      // misses a loading notification inserted after it was dismissed.
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 500))
      })
      expect(document.querySelectorAll('[data-sonner-toast][data-type="loading"]')).toHaveLength(
        0,
      )
      expect(screen.getByText('Existing notice')).toBeTruthy()
    }

    it('keeps dialog progress through hydration replacement and only notifies on completion', async () => {
      const first = deferred<void>()
      const current = deferred<void>()
      previewState.hydration = { settled: first.promise }
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
      await renderWithNotifications()
      await requestExport()
      await clickExport()
      expect(screen.getByRole('status').textContent).toBe('pdf_export.exporting')

      const firstSignal = printMocks.preparePrintDocument.mock.calls[0]![0].signal!
      await act(async () => {
        first.resolve()
        previewState.onHydrationChange?.(null)
        previewState.hydration = { settled: current.promise }
        previewState.onHydrationChange?.(previewState.hydration)
      })
      expect(firstSignal.aborted).toBe(true)
      expect(printMocks.preparePrintDocument).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('status').textContent).toBe('pdf_export.exporting')
      expect(exportMocks.exportPdf).not.toHaveBeenCalled()

      await act(async () => current.resolve())
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await expectNoLoadingNotifications()
      expect(screen.getByText('pdf_export.success:/exports/draft.pdf')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'contextmenu.explorer.show_in_folder' }))
      expect(exportMocks.reveal).toHaveBeenCalledWith('/exports/draft.pdf')
      expect(toastMocks.error).not.toHaveBeenCalled()
    })

    it('leaves an error notification without stale progress after an immediate preparation failure', async () => {
      printMocks.preparePrintDocument.mockRejectedValueOnce(new Error('PDF resources failed'))
      await renderWithNotifications()
      await requestExport()
      await clickExport()
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await expectNoLoadingNotifications()
      expect(screen.getByText('PDF resources failed')).toBeTruthy()
      expect(exportMocks.exportPdf).not.toHaveBeenCalled()
      expect(toastMocks.success).not.toHaveBeenCalled()
    })

    it.each(['cancel', 'unmount'] as const)(
      'leaves no progress notification after %s during preparation and allows another export',
      async (end) => {
        printMocks.preparePrintDocument.mockImplementationOnce(
          ({ signal }) =>
            new Promise((_resolve, reject) => {
              signal?.addEventListener(
                'abort',
                () => reject(new DOMException('Cancelled', 'AbortError')),
                { once: true },
              )
            }),
        )
        await renderWithNotifications()
        await requestExport()
        await clickExport()
        expect(screen.getByRole('status').textContent).toBe('pdf_export.exporting')
        const preparationSignal = printMocks.preparePrintDocument.mock.calls[0]![0].signal!
        const toaster = document.querySelector('[data-sonner-toaster]')
        await act(async () => {
          if (end === 'cancel') {
            fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }))
          } else {
            // Keep the same Toaster mounted while the editor/controller unmounts.
            root.render(
              <>
                {null}
                <Toaster closeButton />
              </>,
            )
          }
        })
        expect(preparationSignal.aborted).toBe(true)
        expect(document.querySelector('[data-sonner-toaster]')).toBe(toaster)
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(exportMocks.exportPdf).not.toHaveBeenCalled()
        await expectNoLoadingNotifications()
        expect(toastMocks.error).not.toHaveBeenCalled()
        expect(toastMocks.success).not.toHaveBeenCalled()

        if (end === 'unmount') await renderController(undefined, undefined, true)
        await requestExport()
        await clickExport()
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        await expectNoLoadingNotifications()
        expect(exportMocks.exportPdf).toHaveBeenCalledOnce()
        expect(screen.getByText('pdf_export.success:/exports/draft.pdf')).toBeTruthy()
      },
    )
  })
})
