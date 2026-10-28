import type { PdfBrowserInfo, PdfExportError } from './pdfExport'

export function getPdfBrowserFailure(
  info?: PdfBrowserInfo,
): 'not_found' | 'invalid_executable' | 'incompatible' | 'failed' {
  switch (info?.error?.code) {
    case 'not_found':
      return 'not_found'
    case 'invalid_executable':
      return 'invalid_executable'
    case 'unsupported_browser':
      return 'incompatible'
    case undefined:
      return info?.available ? 'incompatible' : 'not_found'
    default:
      return 'failed'
  }
}

export function normalizePdfBrowserError(error: unknown): PdfExportError {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return {
      code: error.code,
      message: error.message,
      ...('detail' in error && typeof error.detail === 'string' ? { detail: error.detail } : {}),
    }
  }
  return {
    code: 'browser_check_failed',
    message:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'The PDF export browser could not be checked.',
  }
}
