import { invoke } from '@tauri-apps/api/core'
import { inspectPdf, verifyPdfOutline, verifyPdfProbe } from './pdfExportValidation'

export const PDF_BROWSER_EXECUTABLE_PATH_SETTING = 'pdf_browser_executable_path'

export interface PdfExportError {
  code: string
  message: string
  detail?: string
}

export interface PdfBrowserInfo {
  available: boolean
  compatible: boolean
  executablePath?: string
  version?: string
  error?: PdfExportError
}

interface NativeBrowserInfo extends Omit<PdfBrowserInfo, 'compatible'> {
  probePdfBase64?: string
}

export interface PdfExportRequest {
  jobId: string
  html: string
  outputPath: string
  sourcePath?: string
  executablePath: string
  paperSize: 'a4' | 'letter'
  landscape: boolean
  includeOutline: boolean
}

export interface PdfExportResult {
  outputPath: string
}

const browserProbes = new Map<string, { expires: number; promise: Promise<PdfBrowserInfo> }>()
const PROBE_CACHE_MS = 5 * 60_000

export async function probePdfBrowser(
  executablePath?: string,
  refresh = false,
): Promise<PdfBrowserInfo> {
  const path = executablePath?.trim() || undefined
  const key = path ?? ''
  const cached = browserProbes.get(key)
  if (!refresh && cached && cached.expires > Date.now()) return cached.promise
  const promise = (async (): Promise<PdfBrowserInfo> => {
    const excludedExecutables: string[] = []
    let lastIncompatible: PdfBrowserInfo | undefined
    for (;;) {
      const native = await invoke<NativeBrowserInfo>('probe_pdf_browser', {
        executablePath: path,
        ...(excludedExecutables.length ? { excludedExecutables } : {}),
      })
      const { probePdfBase64, ...info } = native
      if (!info.available || !probePdfBase64) {
        return lastIncompatible ?? { ...info, compatible: false }
      }
      try {
        if (verifyPdfProbe(await inspectPdf(probePdfBase64))) {
          return { ...info, compatible: true, error: undefined }
        }
      } catch {
        // Continue automatic detection if another installed browser can export.
      }
      lastIncompatible = {
        ...info,
        compatible: false,
        error: {
          code: 'unsupported_browser',
          message: 'This browser cannot generate PDF heading bookmarks. Update Chrome or Edge.',
        },
      }
      if (path || !info.executablePath || excludedExecutables.includes(info.executablePath)) {
        return lastIncompatible
      }
      excludedExecutables.push(info.executablePath)
    }
  })()
  const entry = { expires: Date.now() + PROBE_CACHE_MS, promise }
  browserProbes.set(key, entry)
  try {
    const info = await promise
    // Missing/failed capabilities can change immediately after installation.
    if (!info.compatible && browserProbes.get(key) === entry) browserProbes.delete(key)
    return info
  } catch (error) {
    if (browserProbes.get(key) === entry) browserProbes.delete(key)
    throw error
  }
}

/** Commit only after the actual bytes and every bookmark destination are verified. */
export async function exportPdfWithBrowser(
  request: PdfExportRequest,
  signal: AbortSignal,
): Promise<PdfExportResult> {
  signal.throwIfAborted()
  const cancel = () => {
    void invoke('cancel_pdf_export', { jobId: request.jobId }).catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  let committed = false
  try {
    const prepared = await invoke<{ jobId: string; pdfBase64: string; headingCount: number }>(
      'prepare_pdf_export',
      {
        request,
      },
    )
    signal.throwIfAborted()
    if (prepared.jobId !== request.jobId) throw new Error('The PDF export job does not match.')
    if (!Number.isInteger(prepared.headingCount) || prepared.headingCount < 0) {
      throw new Error('The PDF export did not report its printable heading count.')
    }
    const inspection = await inspectPdf(prepared.pdfBase64, signal)
    verifyPdfOutline(inspection, prepared.headingCount, request.includeOutline)
    signal.throwIfAborted()
    const result = await invoke<PdfExportResult>('commit_pdf_export', { jobId: request.jobId })
    // A completed atomic commit remains successful if cancellation races its reply.
    committed = true
    return result
  } finally {
    signal.removeEventListener('abort', cancel)
    if (!committed) await invoke('cancel_pdf_export', { jobId: request.jobId }).catch(() => {})
  }
}

export function getPdfExportFileName(fileName: string): string {
  return `${fileName.replace(/\.(?:md|markdown)$/i, '') || 'document'}.pdf`
}
