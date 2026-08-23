import { invoke } from '@tauri-apps/api/core'

export const PANDOC_EXECUTABLE_PATH_SETTING = 'pandoc_executable_path'
export const PANDOC_INSTALL_URL = 'https://pandoc.org/installing.html'

export const PANDOC_OUTPUT_FORMATS = ['docx', 'odt', 'epub'] as const

export type PandocOutputFormat = (typeof PANDOC_OUTPUT_FORMATS)[number]

export type PandocErrorCode =
  | 'not_found'
  | 'invalid_executable'
  | 'unsupported_format'
  | 'conversion_failed'
  | 'timed_out'
  | 'output_commit_failed'

export interface PandocError {
  code: PandocErrorCode
  message: string
  detail?: string
  exitCode?: number
}

export interface PandocInfo {
  available: boolean
  compatible: boolean
  version?: string
  executablePath?: string
  supportedFormats: PandocOutputFormat[]
  error?: PandocError
}

export interface PandocExportRequest {
  source: string
  format: PandocOutputFormat
  outputPath: string
  executablePath?: string
  resourcePaths: string[]
}

export interface PandocExportResult {
  outputPath: string
  warnings: string[]
}

export function probePandoc(executablePath?: string): Promise<PandocInfo> {
  return invoke<PandocInfo>('probe_pandoc', { executablePath })
}

export function exportMarkdownWithPandoc(
  request: PandocExportRequest,
): Promise<PandocExportResult> {
  return invoke<PandocExportResult>('export_markdown_with_pandoc', { request })
}

export function isPandocError(value: unknown): value is PandocError {
  if (!value || typeof value !== 'object') return false

  const code = (value as { code?: unknown }).code
  return typeof code === 'string' && PANDOC_ERROR_CODES.has(code as PandocErrorCode)
}

const PANDOC_ERROR_CODES = new Set<PandocErrorCode>([
  'not_found',
  'invalid_executable',
  'unsupported_format',
  'conversion_failed',
  'timed_out',
  'output_commit_failed',
])

export function getPandocExportFileName(
  fileName: string,
  format: PandocOutputFormat,
): string {
  const baseName = fileName.replace(/\.(?:md|markdown)$/i, '') || 'document'
  return `${baseName}.${format}`
}

export function supportsPandocFormat(
  info: PandocInfo,
  format: PandocOutputFormat,
): boolean {
  return info.available && info.compatible && info.supportedFormats.includes(format)
}
