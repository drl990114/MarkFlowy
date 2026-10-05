import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import i18n, {
  changeLng,
  i18nInit,
  reloadDesktopResources,
  useTranslation,
} from '../../../../packages/i18n/src/desktop'

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(async () => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  await i18nInit({ lng: 'cn' })
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

function TranslatedDraft() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(0)
  return (
    <>
      <span>{t('common.retry')}</span>
      <button type='button' onClick={() => setDraft((value) => value + 1)}>
        {draft}
      </button>
    </>
  )
}

it('refreshes mounted translations without remounting their local state or loading every language', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const languageChanged = vi.fn()
  i18n.addResourceBundle('cn', 'translation', { common: { retry: '旧文案' } }, true, true)
  i18n.on('languageChanged', languageChanged)

  try {
    act(() => root.render(<TranslatedDraft />))
    act(() => container.querySelector('button')!.click())
    expect(container.querySelector('span')?.textContent).toBe('旧文案')

    await act(async () => reloadDesktopResources())

    expect(container.querySelector('span')?.textContent).toBe('重试')
    expect(container.querySelector('button')?.textContent).toBe('1')
    expect(languageChanged).toHaveBeenCalledWith('cn')
    expect(Object.keys(i18n.services.resourceStore.data).sort()).toEqual(['cn', 'en'])
  } finally {
    act(() => root.unmount())
    i18n.off('languageChanged', languageChanged)
  }
})

it('adds newly available keys, removes stale keys and leaves other namespaces intact', async () => {
  i18n.removeResourceBundle('cn', 'translation')
  i18n.addResourceBundle('cn', 'translation', { obsolete: '已删除' })
  i18n.addResourceBundle('cn', 'custom', { retained: '保留' })
  expect(i18n.getResource('cn', 'translation', 'common.retry')).toBeUndefined()

  await reloadDesktopResources()

  expect(i18n.t('common.retry')).toBe('重试')
  expect(i18n.exists('obsolete')).toBe(false)
  expect(i18n.t('retained', { ns: 'custom' })).toBe('保留')
})

it('preserves a language selected while a refresh is in flight', async () => {
  const refresh = reloadDesktopResources()
  await changeLng('ja')
  await refresh

  expect(i18n.language).toBe('ja')
  expect(i18n.t('common.retry')).not.toBe('common.retry')
})
