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

it.each([
  ['en', 'Duplicate row'],
  ['cn', '复制当前行'],
  ['frFR', 'Dupliquer la ligne'],
  ['es', 'Duplicar fila'],
  ['ja', '行を複製'],
] as const)(
  'loads the table-row duplication label for %s without a fallback',
  async (language, label) => {
    await i18nInit({ lng: language })
    expect(i18n.getResource(language, 'translation', 'capricorn.table.duplicateRow')).toBe(label)
    expect(i18n.t('capricorn.table.duplicateRow', { defaultValue: 'Missing translation' })).toBe(
      label,
    )
  },
)
