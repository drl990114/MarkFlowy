import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/windows', () => ({
  currentWebview: { setZoom: vi.fn() },
}))
vi.mock('@/i18n', () => ({
  changeLng: vi.fn(),
  i18n: { t: (key: string) => key },
  locales: { en: 'English', 'zh-CN': '简体中文' },
}))
vi.mock('rme', () => ({
  DEFAULT_CURRENT_DATE_FORMAT: 'yyyy-MM-dd',
  EditorViewType: { WYSIWYG: 'wysiwyg', SOURCECODE: 'sourceCode', PREVIEW: 'preview' },
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
})
