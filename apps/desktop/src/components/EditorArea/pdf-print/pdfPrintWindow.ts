import { emitTo } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'

export const PDF_PRINT_WINDOW_DATA_EVENT = 'mf-pdf-print-window-data'
export const PDF_PRINT_WINDOW_READY_EVENT = 'mf-pdf-print-window-ready'
export const PDF_PRINT_WINDOW_RESULT_EVENT = 'mf-pdf-print-window-result'

const PDF_PRINT_JOB_PARAM = 'mf-pdf-print-job'
const PDF_PRINT_SOURCE_PARAM = 'mf-pdf-print-source'
const PRINT_WINDOW_READY_TIMEOUT_MS = 15_000

export interface PdfPrintWindowDocument {
  editorCodeFontFamily?: string
  editorRootFontFamily?: string
  failedImageCount: number
  fileName: string
  html: string
  interactiveMediaLabel: string
  jobId: string
  rootFontSize?: string
  rootLineHeight?: string
}

export interface PdfPrintWindowPayload extends PdfPrintWindowDocument {
  sourceLabel: string
}

export interface PdfPrintWindowRequest {
  jobId: string
  sourceLabel: string
}

interface PdfPrintWindowReadyMessage extends PdfPrintWindowRequest {
  windowLabel: string
}

export interface PdfPrintWindowResult {
  error?: string
  failedImageCount: number
  jobId: string
  status: 'complete' | 'error'
}

function createAbortError(): DOMException {
  return new DOMException('Print task was cancelled', 'AbortError')
}

export function getPdfPrintWindowRequest(
  search: string = window.location.search,
): PdfPrintWindowRequest | null {
  const params = new URLSearchParams(search)
  const jobId = params.get(PDF_PRINT_JOB_PARAM)
  const sourceLabel = params.get(PDF_PRINT_SOURCE_PARAM)
  return jobId && sourceLabel ? { jobId, sourceLabel } : null
}

function createPdfPrintWindowUrl(request: PdfPrintWindowRequest): string {
  const params = new URLSearchParams({
    [PDF_PRINT_JOB_PARAM]: request.jobId,
    [PDF_PRINT_SOURCE_PARAM]: request.sourceLabel,
  })
  return `index.html?${params.toString()}`
}

function getPrintWindowLabel(sourceLabel: string, jobId: string): string {
  const safeSourceLabel = sourceLabel.replace(/[^a-zA-Z0-9-/:_]/g, '-')
  const safeJobId = jobId.replace(/[^a-zA-Z0-9-/:_]/g, '-')
  return `mf-pdf-print-${safeSourceLabel}-${safeJobId}`
}

export async function openPdfPrintWindow(
  document: PdfPrintWindowDocument,
  signal: AbortSignal,
  readyTimeoutMs = PRINT_WINDOW_READY_TIMEOUT_MS,
): Promise<PdfPrintWindowResult | null> {
  if (signal.aborted) throw createAbortError()

  const sourceWindow = getCurrentWebviewWindow()
  const windowLabel = getPrintWindowLabel(sourceWindow.label, document.jobId)
  const payload: PdfPrintWindowPayload = {
    ...document,
    sourceLabel: sourceWindow.label,
  }
  let printWindow: WebviewWindow | undefined
  let readyTimeout: number | undefined
  let unlistenReady: (() => void) | undefined
  let unlistenResult: (() => void) | undefined
  let settled = false

  return new Promise<PdfPrintWindowResult | null>((resolve, reject) => {
    const cleanup = () => {
      if (readyTimeout !== undefined) window.clearTimeout(readyTimeout)
      readyTimeout = undefined
      signal.removeEventListener('abort', handleAbort)
      unlistenReady?.()
      unlistenResult?.()
      unlistenReady = undefined
      unlistenResult = undefined
    }
    const settle = (
      result: PdfPrintWindowResult | null,
      error?: unknown,
      destroyWindow = false,
    ) => {
      if (settled) return
      settled = true
      cleanup()
      if (destroyWindow) void printWindow?.destroy().catch(() => undefined)
      if (error) reject(error)
      else resolve(result)
    }
    const fail = (error: unknown) => {
      settle(null, error instanceof Error ? error : new Error(String(error)), true)
    }
    const handleAbort = () => settle(null, createAbortError(), true)

    signal.addEventListener('abort', handleAbort, { once: true })

    void (async () => {
      unlistenReady = await sourceWindow.listen<PdfPrintWindowReadyMessage>(
        PDF_PRINT_WINDOW_READY_EVENT,
        ({ payload: ready }) => {
          if (
            ready.jobId !== document.jobId ||
            ready.sourceLabel !== sourceWindow.label ||
            ready.windowLabel !== windowLabel
          ) {
            return
          }

          if (readyTimeout !== undefined) window.clearTimeout(readyTimeout)
          readyTimeout = undefined
          void emitTo(windowLabel, PDF_PRINT_WINDOW_DATA_EVENT, payload).catch(fail)
        },
      )
      if (settled) {
        unlistenReady()
        return
      }

      unlistenResult = await sourceWindow.listen<PdfPrintWindowResult>(
        PDF_PRINT_WINDOW_RESULT_EVENT,
        ({ payload: result }) => {
          if (result.jobId !== document.jobId) return
          if (result.status === 'error') {
            fail(new Error(result.error || 'PDF print window failed'))
          } else {
            settle(result)
          }
        },
      )
      if (settled) {
        unlistenResult()
        return
      }

      printWindow = new WebviewWindow(windowLabel, {
        center: true,
        decorations: true,
        dragDropEnabled: false,
        focus: false,
        height: 900,
        minHeight: 500,
        minWidth: 600,
        resizable: true,
        skipTaskbar: true,
        title: document.fileName,
        url: createPdfPrintWindowUrl({
          jobId: document.jobId,
          sourceLabel: sourceWindow.label,
        }),
        visible: false,
        width: 816,
      })
      void printWindow.once('tauri://error', ({ payload: error }) => fail(error))
      void printWindow.once('tauri://destroyed', () => settle(null))
      readyTimeout = window.setTimeout(
        () => fail(new Error('Timed out while opening the PDF print window')),
        readyTimeoutMs,
      )
    })().catch(fail)
  })
}
