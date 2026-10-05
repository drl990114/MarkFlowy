import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import type { EventBus, PDFFindController } from 'pdfjs-dist/types/web/pdf_viewer'
import type * as PdfRuntime from 'pdfjs-dist/legacy/build/pdf.mjs'
import type * as PdfViewerRuntime from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
import { clampPdfPage, openPdfPreview, type PdfPreviewCallbacks } from './pdfPreviewRuntime'

interface ViewerOptions {
  eventBus: EventBus
  findController: PDFFindController
  abortSignal: AbortSignal
}

const mocks = vi.hoisted(() => {
  const createDocument = () => {
    const pages = [
      'B document only. 中⽂ B ⽂档。Print930 plain text. shared.',
      '开始 保存 END930。中⽂ shared.',
      'Replaced930 English shared.',
    ]
    return {
      numPages: pages.length,
      pagesMapper: { pagesNumber: pages.length },
      getPage: vi.fn(async (page: number) => ({
        getTextContent: vi.fn(async () => ({ items: [{ str: pages[page - 1], hasEOL: false }] })),
      })),
    }
  }
  return {
    createDocument,
    read: vi.fn(),
    destroy: vi.fn(async () => {}),
    setDocument: vi.fn(),
    options: vi.fn<(options: ViewerOptions) => void>(),
    find: vi.fn(),
    getDocument: vi.fn(),
    task: {
      promise: Promise.resolve(createDocument()),
      onPassword: undefined as
        | undefined
        | ((submit: (value: string) => void, reason: number) => void),
    },
  }
})
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.read }))
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {},
  AnnotationMode: { ENABLE: 1 },
  AnnotationEditorType: { DISABLE: -1 },
  PasswordResponses: { INCORRECT_PASSWORD: 2 },
  getDocument: (options: unknown) => {
    mocks.getDocument(options)
    return {
      ...mocks.task,
      destroy: mocks.destroy,
      set onPassword(callback: typeof mocks.task.onPassword) {
        mocks.task.onPassword = callback
      },
    }
  },
}))
vi.mock('pdfjs-dist/legacy/web/pdf_viewer.mjs', async (importOriginal) => {
  // The real find controller relies on the core's global export and polyfills.
  const pdf = await vi.importActual<typeof PdfRuntime>(
    'pdfjs-dist/legacy/build/pdf.mjs',
  )
  Object.assign(globalThis, { pdfjsLib: pdf })
  const upstream = await importOriginal<typeof PdfViewerRuntime>()
  class EventBus extends upstream.EventBus {
    dispatch(name: string, data: object) {
      if (name === 'find') mocks.find(data)
      super.dispatch(name, data)
    }
  }
  class PDFViewer {
    currentPageNumber = 1
    currentScale = 1
    currentScaleValue = 'page-width'
    pagesCount = 3
    pdfDocument: PDFDocumentProxy | null = null
    eventBus: EventBus
    findController: PDFFindController
    constructor(options: ViewerOptions) {
      this.eventBus = options.eventBus
      this.findController = options.findController
      this.findController.onIsPageVisible = (page: number) => page === this.currentPageNumber
      mocks.options(options)
    }
    setDocument(doc: PDFDocumentProxy | null) {
      mocks.setDocument(doc)
      if (this.pdfDocument) this.findController.setDocument(null as unknown as PDFDocumentProxy)
      this.pdfDocument = doc
      if (doc) {
        this.eventBus.dispatch('pagesinit', {})
        // Match upstream's asynchronous binding after the first page renders.
        queueMicrotask(() => {
          if (this.pdfDocument === doc) this.findController.setDocument(doc)
        })
      }
    }
  }
  return {
    EventBus,
    PDFViewer,
    PDFLinkService: upstream.PDFLinkService,
    PDFFindController: upstream.PDFFindController,
  }
})

const callbacks = (): PdfPreviewCallbacks => ({
  onReady: vi.fn(),
  onPage: vi.fn(),
  onScale: vi.fn(),
  onMatches: vi.fn(),
  onPassword: vi.fn(),
  onError: vi.fn(),
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue({ code: 'Success', content: btoa('%PDF-test') })
  mocks.task.promise = Promise.resolve(mocks.createDocument())
  mocks.task.onPassword = undefined
})

describe('PDF reader lifecycle', () => {
  it('uses local resources, clamps navigation/zoom, searches through PDF.js and disposes on close', async () => {
    const controller = new AbortController()
    const events = callbacks()
    const handle = await openPdfPreview(
      document.createElement('div'),
      document.createElement('div'),
      '/report.pdf',
      events,
      controller.signal,
    )
    expect(mocks.read).toHaveBeenCalledWith('read_u8_array_from_file', { filePath: '/report.pdf' })
    expect(mocks.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        cMapUrl: '/mf-pdf-assets/cmaps/',
        wasmUrl: '/mf-pdf-assets/wasm/',
      }),
    )
    expect(mocks.options).toHaveBeenCalledWith(
      expect.objectContaining({ annotationEditorMode: -1, abortSignal: expect.any(AbortSignal) }),
    )
    expect(events.onReady).toHaveBeenCalledWith(3)
    handle.goToPage(99)
    expect(handle.capture().page).toBe(3)
    handle.zoomBy(100)
    handle.search('中文', true, true)
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({ query: '中文', findPrevious: true, highlightAll: true }),
    )
    controller.abort()
    handle.dispose()
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(mocks.setDocument).toHaveBeenLastCalledWith(null)
    expect(mocks.options.mock.calls[0][0].abortSignal.aborted).toBe(true)
    handle.search('stale')
    expect(mocks.find).toHaveBeenCalledTimes(1)
  })

  it('discards a read that completes after the tab closes', async () => {
    const controller = new AbortController()
    let complete!: (data: { code: string; content: string }) => void
    mocks.read.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const opening = openPdfPreview(
      document.createElement('div'),
      document.createElement('div'),
      '/report.pdf',
      callbacks(),
      controller.signal,
    )
    controller.abort()
    complete({ code: 'Success', content: btoa('%PDF') })
    await expect(opening).rejects.toThrow()
    expect(mocks.getDocument).not.toHaveBeenCalled()
  })

  it('supports password retries without retaining a working password callback after close', async () => {
    const controller = new AbortController()
    const events = callbacks()
    let complete!: (doc: ReturnType<typeof mocks.createDocument>) => void
    mocks.task.promise = new Promise((resolve) => {
      complete = resolve
    })
    const opening = openPdfPreview(
      document.createElement('div'),
      document.createElement('div'),
      '/secret.pdf',
      events,
      controller.signal,
    )
    await vi.waitFor(() => expect(mocks.task.onPassword).toBeDefined())
    const submit = vi.fn()
    mocks.task.onPassword!(submit, 2)
    expect(events.onPassword).toHaveBeenCalledWith(expect.any(Function), true)
    const callback = vi.mocked(events.onPassword).mock.calls[0][0]
    callback('correct')
    expect(submit).toHaveBeenCalledWith('correct')
    complete(mocks.createDocument())
    const handle = await opening
    handle.dispose()
    callback('stale')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('rejects missing files and invalid documents and destroys failed loading tasks', async () => {
    mocks.read.mockResolvedValueOnce({ code: 'NotFound', content: 'Not found' })
    await expect(
      openPdfPreview(
        document.createElement('div'),
        document.createElement('div'),
        '/missing.pdf',
        callbacks(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('Not found')
    let fail!: (error: Error) => void
    mocks.task.promise = new Promise((_resolve, reject) => {
      fail = reject
    })
    const opening = openPdfPreview(
      document.createElement('div'),
      document.createElement('div'),
      '/bad.pdf',
      callbacks(),
      new AbortController().signal,
    )
    await vi.waitFor(() => expect(mocks.task.onPassword).toBeDefined())
    fail(new Error('Invalid PDF'))
    await expect(opening).rejects.toThrow('Invalid PDF')
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
  })

  it.each([
    [NaN, 1],
    [-5, 1],
    [1.9, 1],
    [100, 3],
  ])('bounds page input %s to %s', (input, expected) => {
    expect(clampPdfPage(input, 3)).toBe(expected)
  })
})

describe('PDF text search', () => {
  const openSearchPreview = async () => {
    const events = callbacks()
    const handle = await openPdfPreview(
      document.createElement('div'),
      document.createElement('div'),
      '/search.pdf',
      events,
      new AbortController().signal,
    )
    return { handle, events, ...mocks.options.mock.calls[0][0] }
  }

  it.each([
    ['Print930', 1, 1],
    ['END930', 2, 1],
    ['中文', 1, 2],
  ] as const)('finds %s in extracted page text', async (query, page, total) => {
    const { handle, events, eventBus, findController } = await openSearchPreview()
    const highlights = vi.fn()
    eventBus.on('updatetextlayermatches', highlights)

    handle.search(query)

    await vi.waitFor(() => expect(events.onMatches).toHaveBeenLastCalledWith(1, total))
    expect(handle.capture().page).toBe(page)
    expect(findController.selected).toEqual({ pageIdx: page - 1, matchIdx: 0 })
    expect(findController.highlightMatches).toBe(true)
    expect(highlights).toHaveBeenCalledWith(
      expect.objectContaining({ source: findController, pageIndex: page - 1 }),
    )
    handle.dispose()
  })

  it('moves to next and previous matches on other pages and reports their positions', async () => {
    const { handle, events } = await openSearchPreview()
    handle.search('shared')
    await vi.waitFor(() => expect(events.onMatches).toHaveBeenLastCalledWith(1, 3))

    handle.search('shared', true)
    await vi.waitFor(() => expect(events.onMatches).toHaveBeenLastCalledWith(2, 3))
    expect(handle.capture().page).toBe(2)

    handle.search('shared', true, true)
    await vi.waitFor(() => expect(events.onMatches).toHaveBeenLastCalledWith(1, 3))
    expect(handle.capture().page).toBe(1)
    handle.dispose()
  })

  it('does not publish matches from text extraction that finishes after close', async () => {
    let finishExtraction!: (content: { items: { str: string; hasEOL: boolean }[] }) => void
    const textContent = new Promise<{ items: { str: string; hasEOL: boolean }[] }>((resolve) => {
      finishExtraction = resolve
    })
    const document = await mocks.task.promise
    document.getPage.mockResolvedValue({ getTextContent: vi.fn(() => textContent) })
    const { handle, events, findController } = await openSearchPreview()
    handle.search('shared', true)
    await vi.waitFor(() => expect(document.getPage).toHaveBeenCalled())

    handle.dispose()
    vi.mocked(events.onMatches).mockClear()
    finishExtraction({ items: [{ str: 'shared', hasEOL: false }] })
    await textContent
    await Promise.resolve()
    expect(findController.state).toBeNull()
    expect(findController.pageMatches).toEqual([])
    expect(events.onMatches).not.toHaveBeenCalled()
  })
})
