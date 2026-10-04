type Translate = (key: string, values?: Record<string, string>) => string
export type TextFileErrorOperation = 'read' | 'save' | 'preview'

const encodingErrorKeys: Record<string, string> = {
  text_invalid_encoding: 'invalid_encoding',
  text_unsupported_encoding: 'unsupported_encoding',
  text_binary: 'binary',
  text_invalid_bom: 'invalid_bom',
  text_unmappable: 'unmappable',
  text_confirm_encoding: 'confirm_encoding',
  text_noncanonical: 'noncanonical',
  text_not_reversible: 'not_reversible',
  text_ambiguous_bom: 'ambiguous_bom',
}

// These service errors protect edits during preview/reopen. Keep their actions
// available in every locale without changing the underlying service contract.
const operationErrorKeys: Record<string, string> = {
  '请等待当前输入完成。': 'finish_input',
  '请先保存文件。': 'save_first',
  '文件正在变化，请重试。': 'retry_read',
  '文档已变化，请重新预览。': 'preview_again',
  '文档或磁盘文件已变化，请重新预览。': 'preview_again',
  '当前内容尚未完成草稿保护，请重试。': 'draft_pending',
  '文本包含无效的 Unicode 代理项，原文件未写入。': 'invalid_unicode',
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return typeof error === 'string' ? error.replace(/^Error:\s*/, '') : ''
}

export function getTextFileErrorCode(error: unknown): string | undefined {
  return /^(text_[a-z_]+)(?::|$)/.exec(errorMessage(error))?.[1]
}

/** Translate at the UI boundary; raw errors remain available to the CLI and logger. */
export function formatTextFileError(
  error: unknown,
  t: Translate,
  operation: TextFileErrorOperation = 'save',
): string {
  const message = errorMessage(error)
  const code = getTextFileErrorCode(error)
  if (code === 'text_unmappable') {
    const details = /\(U\+([0-9A-F]{4,6})\) at UTF-16 offset \d+ cannot be saved in (GBK|GB18030)\.$/i.exec(message)
    const codepoint = details ? Number.parseInt(details[1], 16) : -1
    if (details && codepoint >= 0 && codepoint <= 0x10ffff && !(codepoint >= 0xd800 && codepoint <= 0xdfff)) {
      return t('text_encoding.errors.unmappable_character', {
        character: String.fromCodePoint(codepoint),
        encoding: details[2].toUpperCase(),
      })
    }
  }
  const key = code && Object.hasOwn(encodingErrorKeys, code)
    ? encodingErrorKeys[code]
    : Object.hasOwn(operationErrorKeys, message)
      ? operationErrorKeys[message]
      : `${operation}_failed`
  return t(`text_encoding.errors.${key}`)
}
