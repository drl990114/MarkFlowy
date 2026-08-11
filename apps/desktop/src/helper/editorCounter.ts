/**
 * Count characters using the same UTF-16 semantics as the editor's existing
 * character counter, while excluding spaces, line breaks, and other whitespace.
 */
export function countNonWhitespaceCharacters(text: string): number {
  return text.replace(/\s/gu, '').length
}
