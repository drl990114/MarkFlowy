import { expect, it } from 'vitest'
import i18n, { changeLng, i18nInit } from '../../../../packages/i18n/src/desktop'

it('loads only the current language and English, adds switched languages and retains legacy consumers', async () => {
  await i18nInit({ lng: 'cn' })
  expect(Object.keys(i18n.services.resourceStore.data).sort()).toEqual(['cn', 'en'])
  expect(i18n.t('common.retry')).toBe('重试')
  await changeLng('ja')
  expect(Object.keys(i18n.services.resourceStore.data).sort()).toEqual(['cn', 'en', 'ja'])
  expect(i18n.language).toBe('ja')
  const legacy = await import('../../../../packages/i18n/src/index')
  expect(Object.keys(legacy.resources)).toHaveLength(5)
  expect(Object.keys(legacy.editorResources)).toHaveLength(5)
  expect(legacy.default).toBe(i18n)
  await legacy.i18nInit({ lng: 'frFR' })
  expect(i18n.language).toBe('frFR')
  expect(Object.keys(i18n.services.resourceStore.data)).toHaveLength(5)
})
