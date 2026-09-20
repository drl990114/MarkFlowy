import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clampPdfPage, openPdfPreview, type PdfPreviewCallbacks } from './pdfPreviewRuntime'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  destroy: vi.fn(async () => {}),
  setDocument: vi.fn(),
  options: vi.fn(),
  find: vi.fn(),
  getDocument: vi.fn(),
  task: {
    promise: Promise.resolve({ numPages: 3 }),
    onPassword: undefined as
      | undefined
      | ((submit: (value: string) => void, reason: number) => void),
  },
}))
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
vi.mock('pdfjs-dist/legacy/web/pdf_viewer.mjs', () => {
  class EventBus {
    listeners = new Map<string, { fn: (data: unknown) => void; signal?: AbortSignal }>()
    on(name: string, fn: (data: unknown) => void, options: { signal?: AbortSignal }) {
      this.listeners.set(name, { fn, ...options })
    }
    dispatch(name: string, data: unknown) {
      if (name === 'find') mocks.find(data)
      const listener = this.listeners.get(name)
      if (!listener?.signal?.aborted) listener?.fn(data)
    }
  }
  class PDFViewer {
    currentPageNumber = 1
    currentScale = 1
    currentScaleValue = 'page-width'
    pagesCount = 3
    eventBus: EventBus
    constructor(options: { eventBus: EventBus }) {
      this.eventBus = options.eventBus
      mocks.options(options)
    }
    setDocument(doc: unknown) {
      mocks.setDocument(doc)
      if (doc) this.eventBus.dispatch('pagesinit', {})
    }
  }
  return {
    EventBus,
    PDFViewer,
    PDFLinkService: class {
      setDocument() {}
      setViewer() {}
    },
    PDFFindController: class {},
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
  mocks.task.promise = Promise.resolve({ numPages: 3 })
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
    let complete!: (doc: { numPages: number }) => void
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
    complete({ numPages: 3 })
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
