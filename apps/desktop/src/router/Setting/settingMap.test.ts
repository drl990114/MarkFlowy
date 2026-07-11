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
  EditorViewType: { WYSIWYG: 'wysiwyg', SOURCECODE: 'sourcecode' },
}))

import { getSettingMap } from './settingMap'

describe('AI setting map', () => {
  it('gives every provider tab a stable semantic id', () => {
    const providers = getSettingMap().ai.model.children.map((child) => child.providerId)

    expect(providers).toEqual(['openai', 'deepseek', 'ollama', 'google'])
  })

  it('keeps legacy Ollama models out of the visible settings form', () => {
    const ollama = getSettingMap().ai.model.children.find((child) => child.providerId === 'ollama')

    expect(ollama).toBeDefined()
    expect(ollama).not.toHaveProperty('models')
    expect(ollama).toHaveProperty('ApiBase')
    expect(ollama).toHaveProperty('requestHeaders')
  })
})
