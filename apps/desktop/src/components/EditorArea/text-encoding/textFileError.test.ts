import { beforeEach, describe, expect, it } from 'vitest'
import i18n, { i18nInit } from '../../../../../../packages/i18n/src/desktop'
import { formatTextFileError, getTextFileErrorCode } from './textFileError'

beforeEach(async () => { await i18nInit({ lng: 'cn' }) })

describe('text file error presentation', () => {
  it.each([
    ['text_invalid_encoding: Invalid or incomplete UTF-8 data; choose the encoding to reopen.', '请选择其他编码预览'],
    ['text_unsupported_encoding: Detected windows-1252; choose an encoding to reopen.', '无法识别或暂不支持'],
    ['text_binary: Binary files cannot be opened as text.', '二进制数据'],
    ['text_invalid_bom: The BOM does not match the selected encoding.', '编码标记（BOM）'],
    ["text_unmappable: Character '🙂' (U+1F642) at UTF-16 offset 52 cannot be saved in GBK.", 'GBK 无法保存字符“🙂”'],
    ['text_confirm_encoding: Confirm the detected encoding before overwriting this file.', '检测到的编码尚未确认'],
    ['text_noncanonical: The original byte mapping cannot be preserved. Explicitly convert to another encoding or save a copy.', '请选择 UTF-8'],
    ['text_not_reversible: The selected encoding cannot round-trip this Unicode text without changing characters.', '所选编码会改变部分字符'],
    ['text_ambiguous_bom: A leading U+FEFF requires a separate BOM to remain body text in this Unicode file.', '带 BOM 的格式'],
  ])('translates the native Rust error %s', (message, expected) => {
    const result = formatTextFileError(message, i18n.t)
    expect(result).toContain(expected)
    expect(result).not.toContain('text_')
    expect(result).not.toContain('UTF-16 offset')
  })

  it('preserves the code across string and Error IPC representations', () => {
    expect(getTextFileErrorCode('text_confirm_encoding: Confirm it.')).toBe('text_confirm_encoding')
    expect(getTextFileErrorCode(new Error('text_confirm_encoding: Confirm it.'))).toBe('text_confirm_encoding')
    expect(getTextFileErrorCode('Error: text_confirm_encoding: Confirm it.')).toBe('text_confirm_encoding')
    expect(getTextFileErrorCode('Failed to write /text_notes/file.md')).toBeUndefined()
  })

  it('uses the current language and identifies the character without exposing an internal offset', async () => {
    await i18nInit({ lng: 'en' })
    const result = formatTextFileError(
      new Error("text_unmappable: Character '🙂' (U+1F642) at UTF-16 offset 52 cannot be saved in GBK."),
      i18n.t,
    )
    expect(result).toContain('GBK cannot save the character “🙂”')
    expect(result).toContain('Save as UTF-8')
    expect(result).not.toContain('offset')
  })

  it.each(['frFR', 'es', 'ja'])('provides readable fallback copy for %s', async (lng) => {
    await i18nInit({ lng })
    expect(formatTextFileError('text_confirm_encoding: Confirm it.', i18n.t)).toContain(
      'The detected encoding has not been confirmed.',
    )
  })

  it.each(['U+FFFFFF', 'U+D800'])('ignores an invalid character detail %s', (point) => {
    const result = formatTextFileError(
      `text_unmappable: Character 'x' (${point}) at UTF-16 offset 52 cannot be saved in GBK.`, i18n.t,
    )
    expect(result).toContain('当前编码无法保存部分字符')
  })

  it.each(['read', 'save', 'preview'] as const)('uses a safe %s fallback for unknown errors', (operation) => {
    const result = formatTextFileError(new Error('internal error at /private/user/file.md:123'), i18n.t, operation)
    expect(result).not.toContain('/private')
    expect(result).not.toContain('internal')
    expect(result).not.toContain('text_encoding.errors')
  })

  it.each(['constructor', '__proto__', 'text_unknown: internal details'])('does not treat %s as a translation key', (error) => {
    expect(formatTextFileError(error, i18n.t)).toContain('尚未保存')
  })

  it.each([
    ['请等待当前输入完成。', '请完成当前文字输入'],
    ['文档已变化，请重新预览。', '请重新预览后再应用编码'],
    ['当前内容尚未完成草稿保护，请重试。', '恢复草稿保护'],
  ])('retains actionable preview protection for %s', (error, expected) => {
    expect(formatTextFileError(new Error(error), i18n.t, 'preview')).toContain(expected)
  })
})
