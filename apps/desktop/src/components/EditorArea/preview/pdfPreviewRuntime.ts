import { invoke } from '@tauri-apps/api/core'
import { FileResultCode, type FileSysResult } from '@/helper/filesys'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import type { PDFViewer } from 'pdfjs-dist/types/web/pdf_viewer'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

export interface PdfViewState {
  page: number
  scale: string
  scrollTop: number
  scrollLeft: number
}

export interface PdfPreviewHandle {
  dispose: () => void
  capture: () => PdfViewState
  goToPage: (page: number) => void
  zoomBy: (factor: number) => void
  fitWidth: () => void
  search: (query: string, again?: boolean, previous?: boolean) => void
}

export interface PdfPreviewCallbacks {
  onReady: (pages: number) => void
  onPage: (page: number) => void
  onScale: (scale: number) => void
  onMatches: (current: number, total: number) => void
  onPassword: (submit: (password: string) => void, incorrect: boolean) => void
  onError: () => void
}

export function clampPdfPage(page: number, count: number): number {
  return Math.max(1, Math.min(count, Math.trunc(Number.isFinite(page) ? page : 1)))
}

async function readPdf(path: string) {
  const result = await invoke<FileSysResult>('read_u8_array_from_file', { filePath: path })
  if (result.code !== FileResultCode.Success) throw new Error(result.content)
  return Uint8Array.from(atob(result.content), (character) => character.charCodeAt(0))
}

export async function openPdfPreview(
  container: HTMLDivElement,
  pagesElement: HTMLDivElement,
  path: string,
  callbacks: PdfPreviewCallbacks,
  signal: AbortSignal,
  restored?: PdfViewState,
): Promise<PdfPreviewHandle> {
  let loadingTask: PDFDocumentLoadingTask | undefined
  let viewer: PDFViewer | undefined
  const lifetime = new AbortController()
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    signal.removeEventListener('abort', dispose)
    // PDFViewer.setDocument(null) is the upstream teardown API; its generated
    // declaration incorrectly excludes null in this release.
    viewer?.setDocument(null as unknown as PDFDocumentProxy)
    lifetime.abort()
    if (loadingTask) void loadingTask.destroy().catch(() => {})
  }
  signal.addEventListener('abort', dispose, { once: true })
  const guard = () => {
    signal.throwIfAborted()
    lifetime.signal.throwIfAborted()
  }
  try {
    const [pdf, bytes] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      readPdf(path),
    ])
    guard()
    // The viewer reads the core's global export during module evaluation.
    const { EventBus, PDFViewer, PDFLinkService, PDFFindController } = await import(
      'pdfjs-dist/legacy/web/pdf_viewer.mjs'
    )
    guard()
    pdf.GlobalWorkerOptions.workerSrc = workerUrl
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    linkService.externalLinkEnabled = false
    const findController = new PDFFindController({ eventBus, linkService })
    const options = {
      container,
      viewer: pagesElement,
      eventBus,
      linkService,
      findController,
      annotationMode: pdf.AnnotationMode.ENABLE,
      annotationEditorMode: pdf.AnnotationEditorType.DISABLE,
      imageResourcesPath: '/mf-pdf-assets/images/',
      // Supported by upstream; currently omitted from its generated public type.
      abortSignal: lifetime.signal,
    }
    const pdfViewer = (viewer = new PDFViewer(options))
    linkService.setViewer(pdfViewer)
    const events = { signal: lifetime.signal }
    eventBus.on(
      'pagesinit',
      () => {
        if (disposed) return
        pdfViewer.currentScaleValue = restored?.scale ?? 'page-width'
        pdfViewer.currentPageNumber = clampPdfPage(restored?.page ?? 1, pdfViewer.pagesCount)
        if (restored) {
          container.scrollTop = restored.scrollTop
          container.scrollLeft = restored.scrollLeft
        }
        callbacks.onPage(pdfViewer.currentPageNumber)
        callbacks.onScale(pdfViewer.currentScale)
        callbacks.onReady(pdfViewer.pagesCount)
      },
      events,
    )
    eventBus.on(
      'pagechanging',
      ({ pageNumber }: { pageNumber: number }) => {
        if (!disposed) callbacks.onPage(pageNumber)
      },
      events,
    )
    eventBus.on(
      'scalechanging',
      ({ scale }: { scale: number }) => {
        if (!disposed) callbacks.onScale(scale)
      },
      events,
    )
    eventBus.on(
      'updatefindmatchescount',
      ({ matchesCount }: { matchesCount: { current: number; total: number } }) => {
        if (!disposed) callbacks.onMatches(matchesCount.current, matchesCount.total)
      },
      events,
    )
    eventBus.on(
      'updatefindcontrolstate',
      ({ matchesCount }: { matchesCount: { current: number; total: number } }) => {
        if (!disposed && matchesCount) callbacks.onMatches(matchesCount.current, matchesCount.total)
      },
      events,
    )
    eventBus.on(
      'pagerendered',
      ({ error }: { error?: unknown }) => {
        if (!disposed && error) callbacks.onError()
      },
      events,
    )
    loadingTask = pdf.getDocument({
      data: bytes,
      cMapUrl: '/mf-pdf-assets/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/mf-pdf-assets/standard_fonts/',
      wasmUrl: '/mf-pdf-assets/wasm/',
    })
    loadingTask.onPassword = (updatePassword: (password: string) => void, reason: number) => {
      if (!disposed)
        callbacks.onPassword((password) => {
          if (!disposed) updatePassword(password)
        }, reason === pdf.PasswordResponses.INCORRECT_PASSWORD)
    }
    const document = await loadingTask.promise
    guard()
    pdfViewer.setDocument(document)
    linkService.setDocument(document)
    return {
      dispose,
      capture: () => ({
        page: pdfViewer.currentPageNumber,
        scale: pdfViewer.currentScaleValue,
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
      }),
      goToPage: (page) => {
        if (!disposed) pdfViewer.currentPageNumber = clampPdfPage(page, document.numPages)
      },
      zoomBy: (factor) => {
        if (!disposed)
          pdfViewer.currentScale = Math.max(0.25, Math.min(5, pdfViewer.currentScale * factor))
      },
      fitWidth: () => {
        if (!disposed) pdfViewer.currentScaleValue = 'page-width'
      },
      search: (query, again = false, previous = false) => {
        if (!disposed)
          eventBus.dispatch('find', {
            source: pdfViewer,
            type: again ? 'again' : '',
            query,
            caseSensitive: false,
            entireWord: false,
            highlightAll: true,
            findPrevious: previous,
            matchDiacritics: false,
          })
      },
    }
  } catch (error) {
    dispose()
    throw error
  }
}
