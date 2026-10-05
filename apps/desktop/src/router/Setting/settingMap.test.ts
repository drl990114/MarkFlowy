import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/windows', () => ({
  currentWebview: { setZoom: vi.fn() },
}))
vi.mock('@/i18n', () => ({
  changeLng: vi.fn(),
  i18n: { t: (key: string) => key },
  locales: { en: 'English', 'zh-CN': '简体中文' },
}))

import { getSettingMap } from './settingMap'

describe('AI setting map', () => {
  it('gives every provider tab a stable semantic id', () => {
    const providers = getSettingMap().ai.model.children.map((child) => child.providerId)

    expect(providers).toEqual(['openai', 'deepseek', 'ollama', 'google'])
  })

  it('keeps Ollama model configuration visible alongside discovery', () => {
    const ollama = getSettingMap().ai.model.children.find((child) => child.providerId === 'ollama')

    expect(ollama).toBeDefined()
    expect(ollama).toHaveProperty('models')
    expect(ollama).toHaveProperty('ApiBase')
    expect(ollama).toHaveProperty('requestHeaders')
  })
})

describe('Editor setting map', () => {
  it('offers Preview as a Markdown default mode', () => {
    const options = getSettingMap().editor.Behavior.mdDefaultMode.options

    expect(options.map((option) => option.value)).toEqual([
      'wysiwyg',
      'sourceCode',
      'preview',
    ])
  })

  it('offers automatic and always-split live preview block behaviors', () => {
    const setting = getSettingMap().editor.Wysiwyg.livePreviewBlockBehavior

    expect(setting.key).toBe('wysiwyg_editor_live_preview_block_behavior')
    expect(setting.options.map((option) => option.value)).toEqual(['auto', 'always-split'])
  })

  it('separates source and embedded presentation while sharing editing behavior', () => {
    const { CodeEditing, SourceCode, EmbeddedCode, Style, Wysiwyg } = getSettingMap().editor
    expect(CodeEditing.indentSize.options.map((option) => option.value)).toEqual([
      'default', '2', '4', '8',
    ])
    expect(CodeEditing.whitespace.options.map((option) => option.value)).toEqual([
      'off', 'trailing', 'all',
    ])
    for (const [scope, group] of [['source', SourceCode], ['embedded', EmbeddedCode]] as const) {
      expect(group.lineWrap.key).toBe(`${scope}_code_editor_line_wrap`)
      expect(group.lineWrap.defaultValue).toBe('default')
      expect(group.lineNumbers.options.map((option) => option.value)).toEqual([
        'default', 'off', 'all', 'sparse',
      ])
      expect(group.highlightActiveLine.options.map((option) => option.value)).toEqual([
        'default', 'on', 'off',
      ])
    }
    expect(SourceCode.sourceFontSize.key).toBe('editor_source_font_size')
    expect(Style).not.toHaveProperty('sourceFontSize')
    expect(Wysiwyg).not.toHaveProperty('mdDefaultMode')
    expect(EmbeddedCode.fontSize).toMatchObject({
      key: 'editor_code_font_size', optionalValue: { initial: 14 }, scope: [12, 40],
    })
    expect(EmbeddedCode.lineHeight).toMatchObject({
      key: 'editor_code_line_height', optionalValue: { initial: 1.6 },
      saveToString: true, step: 0.1, scope: [1, 2],
    })
  })
})

describe('General setting map', () => {
  it('uses a translation key for the file-exclusion placeholder', () => {
    expect(getSettingMap().general.Misc.fileExcludePatterns.placeholderI18nKey).toBe(
      'settings.general.misc.file_exclude_patterns.placeholder',
    )
  })
})

describe('Export setting map', () => {
  it('registers the compact Pandoc export page', () => {
    expect(getSettingMap().export).toMatchObject({
      i18nKey: 'settings.export.label',
      iconName: 'ri-file-transfer-line',
      desc: { i18nKey: 'settings.export.desc' },
    })
  })
})
