import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { resolveCodeEditorPreferences } from './codeEditorSettings'
import { useCodeEditorPreferences } from './useCodeEditorPreferences'

afterEach(() => {
  cleanup()
  useAppSettingStore.setState({ settingData: {} })
})

describe('code editing preferences', () => {
  it('keeps default profiles unresolved and retains the legacy wrapping scope', () => {
    const defaults = resolveCodeEditorPreferences({})
    expect(Object.values(defaults.source).every((value) => value === undefined)).toBe(true)
    expect(Object.values(defaults.embedded).every((value) => value === undefined)).toBe(true)
    const legacy = resolveCodeEditorPreferences({ wysiwyg_editor_codemirror_line_wrap: false })
    expect(legacy.source.lineWrapping).toBeUndefined()
    expect(legacy.embedded.lineWrapping).toBeUndefined()
    expect(legacy.rmeEmbedded.lineWrapping).toBe(false)
    expect(legacy.legacyLineWrapping).toBe(false)
  })

  it('shares editing behavior but isolates source and embedded display overrides', () => {
    const prefs = resolveCodeEditorPreferences({
      editor_code_indent_style: 'tabs',
      editor_code_indent_size: '4',
      editor_code_auto_close_brackets: false,
      editor_code_whitespace: 'trailing',
      source_code_editor_line_wrap: 'off',
      source_code_editor_line_numbers: 'sparse',
      source_code_editor_highlight_active_line: 'on',
      embedded_code_editor_line_wrap: 'on',
      embedded_code_editor_line_numbers: 'off',
      embedded_code_editor_highlight_active_line: 'off',
      wysiwyg_editor_codemirror_line_wrap: false,
    })
    const common = {
      indentStyle: 'tabs',
      indentSize: 4,
      autoCloseBrackets: false,
      whitespace: 'trailing',
    }
    expect(prefs.source).toEqual({
      ...common,
      lineWrapping: false,
      lineNumbers: 'sparse',
      highlightActiveLine: true,
    })
    expect(prefs.embedded).toEqual({
      ...common,
      lineWrapping: true,
      lineNumbers: 'off',
      highlightActiveLine: false,
    })
    expect(prefs.rmeEmbedded.lineWrapping).toBe(true)
  })

  it('restores profile defaults and ignores malformed persisted overrides', () => {
    const prefs = resolveCodeEditorPreferences({
      editor_code_indent_style: 'invalid',
      editor_code_indent_size: '3',
      editor_code_auto_close_brackets: 'false',
      editor_code_whitespace: 'bad',
      embedded_code_editor_line_wrap: 'default',
      embedded_code_editor_line_numbers: 'bad',
      embedded_code_editor_highlight_active_line: null,
      editor_code_font_size: 200,
      editor_code_line_height: 'NaN',
    })
    expect(Object.values(prefs.embedded).every((value) => value === undefined)).toBe(true)
    expect(prefs.fontSize).toBeUndefined()
    expect(prefs.lineHeight).toBeUndefined()
  })

  it('applies optional embedded typography only while personal typography is enabled', () => {
    const custom = { editor_code_font_size: 20, editor_code_line_height: '1.8' }
    expect(resolveCodeEditorPreferences(custom)).toMatchObject({
      fontSize: '20px',
      lineHeight: '1.8',
    })
    for (const settings of [
      { ...custom, theme_use_personal_typography: false },
      { editor_code_font_size: null, editor_code_line_height: null },
    ]) {
      expect(resolveCodeEditorPreferences(settings)).toMatchObject({
        fontSize: undefined,
        lineHeight: undefined,
      })
    }
  })

  it('updates mounted subscribers and leaves their settings identity stable on unrelated changes', () => {
    const { result } = renderHook(useCodeEditorPreferences)
    const first = result.current
    act(() => useAppSettingStore.getState().setSettingData({ autosave: false }))
    expect(result.current).toBe(first)
    act(() => useAppSettingStore.getState().setSettingData({ editor_code_indent_size: '8' }))
    expect(result.current.source.indentSize).toBe(8)
    expect(result.current.embedded.indentSize).toBe(8)
    act(() => useAppSettingStore.getState().setSettingData({ editor_code_indent_size: 'default' }))
    expect(result.current.source.indentSize).toBeUndefined()
  })
})
