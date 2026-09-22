export type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'gbk' | 'gb18030'
export interface TextFileFormat {
  readonly encoding: TextEncoding
  readonly bom: 'none' | 'utf8' | 'utf16le' | 'utf16be'
}
export interface TextFileMetadata {
  readonly saveError?: string
  readonly format: TextFileFormat
  readonly lineEndings: { lf: number; crlf: number; cr: number }
  readonly decoding: {
    source: 'bom' | 'utf8' | 'heuristic' | 'user' | 'unknown'
    needsConfirmation: boolean
    byteRoundTrip: boolean
  }
}
export interface TextWriteOptions {
  readonly format: TextFileFormat
  readonly originalFormat?: TextFileFormat
  readonly encodingConfirmed: boolean
}
export const DEFAULT_TEXT_FORMAT: TextFileFormat = Object.freeze({ encoding: 'utf-8', bom: 'none' })
export const DEFAULT_TEXT_METADATA: TextFileMetadata = Object.freeze({
  format: DEFAULT_TEXT_FORMAT,
  lineEndings: { lf: 0, crlf: 0, cr: 0 },
  decoding: { source: 'utf8' as const, needsConfirmation: false, byteRoundTrip: true },
})
export const sameTextFormat = (a?: TextFileFormat, b?: TextFileFormat) =>
  a?.encoding === b?.encoding && a?.bom === b?.bom

export function textLineEndings(content: string): TextFileMetadata['lineEndings'] {
  const result = { lf: 0, crlf: 0, cr: 0 }
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\r') {
      if (content[i + 1] === '\n') {
        result.crlf++
        i++
      } else result.cr++
    } else if (content[i] === '\n') result.lf++
  }
  return result
}

/** Never let JSON/IPC replace isolated UTF-16 surrogates before Rust sees them. */
export function assertValidUnicode(content: string): void {
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = content.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new Error('文本包含无效的 Unicode 代理项，原文件未写入。')
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error('文本包含无效的 Unicode 代理项，原文件未写入。')
    }
  }
}
