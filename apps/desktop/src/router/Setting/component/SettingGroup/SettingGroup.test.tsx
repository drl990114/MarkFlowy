import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingGroup from '.'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../SettingItems', () => ({
  default: ({ item }: { item: { key: string } }) => <span data-setting-key={item.key} />,
}))
vi.mock('./styles', () => ({
  SettingGroupContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('SettingGroup semantic tab selection', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('opens the provider requested by id rather than by array position', () => {
    const group = {
      i18nKey: 'settings.ai.model.label',
      children: [
        {
          providerId: 'openai',
          i18nKey: 'settings.ai.ChatGPT.label',
          field: { key: 'openai-field', type: 'input', title: { i18nKey: 'openai' } },
        },
        {
          providerId: 'google',
          i18nKey: 'settings.ai.Google.label',
          field: { key: 'google-field', type: 'input', title: { i18nKey: 'google' } },
        },
      ],
    } as unknown as Setting.SettingGroup

    act(() => {
      root.render(
        <SettingGroup group={group} groupKey='model' categoryKey='ai' activeChildId='google' />,
      )
    })

    expect(container.querySelector('[data-setting-key="google-field"]')).not.toBeNull()
    expect(container.querySelector('[data-setting-key="openai-field"]')).toBeNull()
  })
})
