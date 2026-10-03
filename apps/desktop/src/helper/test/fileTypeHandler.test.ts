import { EditorViewType } from '@/constants/editorViewType'
import { describe, expect, it } from 'vitest'
import {
  getFileTypeConfig,
  getMarkdownDefaultMode,
  getMarkdownSupportedModes,
  isTextfileType,
} from '../fileTypeHandler'

describe('document preview file types', () => {
  it.each(['page.html', 'page.HTM'])('opens %s in preview with editable source', async (name) => {
    const config = await getFileTypeConfig({ id: name, name, kind: 'file' })
    expect(config).toEqual({
      type: 'html',
      defaultMode: EditorViewType.PREVIEW,
      supportedModes: [EditorViewType.PREVIEW, EditorViewType.SOURCECODE],
    })
    expect(isTextfileType(config)).toBe(true)
  })
  it('keeps PDF bytes out of text editing and saving', async () => {
    const config = await getFileTypeConfig({ id: 'pdf', name: 'report.PDF', kind: 'file' })
    expect(config).toEqual({
      type: 'pdf',
      defaultMode: EditorViewType.PREVIEW,
      supportedModes: [EditorViewType.PREVIEW],
    })
    expect(isTextfileType(config)).toBe(false)
  })
})

describe('getMarkdownSupportedModes', () => {
  it('exposes WYSIWYG only when the verified Capricorn runtime is available', () => {
    expect(getMarkdownSupportedModes(false)).toEqual([
      EditorViewType.PREVIEW,
      EditorViewType.SOURCECODE,
    ])
    expect(getMarkdownSupportedModes(true)).toEqual([
      EditorViewType.PREVIEW,
      EditorViewType.WYSIWYG,
      EditorViewType.SOURCECODE,
    ])
  })

  it('falls back to Source Code when a saved WYSIWYG preference is unavailable', () => {
    expect(getMarkdownDefaultMode(EditorViewType.WYSIWYG, false)).toBe(EditorViewType.SOURCECODE)
    expect(getMarkdownSupportedModes(false)).toContain(EditorViewType.PREVIEW)
  })

  it('keeps valid preferences and defaults to WYSIWYG when Capricorn is available', () => {
    expect(getMarkdownDefaultMode(EditorViewType.PREVIEW, true)).toBe(EditorViewType.PREVIEW)
    expect(getMarkdownDefaultMode('unknown-mode', true)).toBe(EditorViewType.WYSIWYG)
  })

  it('keeps Source Code and Preview preferences without Capricorn', () => {
    expect(getMarkdownDefaultMode(EditorViewType.SOURCECODE, false)).toBe(EditorViewType.SOURCECODE)
    expect(getMarkdownDefaultMode(EditorViewType.PREVIEW, false)).toBe(EditorViewType.PREVIEW)
  })
})
