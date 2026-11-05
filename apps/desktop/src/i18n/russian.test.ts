import { expect, it } from 'vitest'
import i18n, { changeLng, i18nInit, locales, reloadDesktopResources } from '../../../../packages/i18n/src/desktop'
import english from '../../../../locales/en.json'
import russian from '../../../../locales/ru.json'
import editorEnglish from '../../../../locales/editor/en.json'
import editorRussian from '../../../../locales/editor/ru.json'

it('initializes Russian, switches both dictionaries and retains Russian after resource reload', async () => {
  expect(locales.ru).toBe('Русский')
  await i18nInit({ lng: 'ru' })
  expect(Object.keys(i18n.services.resourceStore.data).sort()).toEqual(['en', 'ru'])
  expect(i18n.t('find_replace.match_case')).toBe('Учитывать регистр')
  expect(i18n.t('toolbar.undo')).toBe('Отмена')
  expect(i18n.t('blockType.heading', { level: 2 })).toBe('Заголовок 2')
  expect(i18n.t('find_replace.result_count', { current: 2, total: 5 })).toBe('2 из 5')
  await changeLng('en')
  expect(i18n.t('toolbar.undo')).toBe('Undo')
  await changeLng('ru')
  await reloadDesktopResources()
  expect(i18n.language).toBe('ru')
  expect(i18n.t('toolbar.undo')).toBe('Отмена')
  const legacy = await import('../../../../packages/i18n/src/index')
  expect(legacy.desktopResources.ru.translation).toEqual(russian)
  expect(legacy.editorResources.ru.translation).toEqual(editorRussian.editor)
  expect(legacy.default).toBe(i18n)
})

function strings(object: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value]] : Object.entries(strings(value, path))
  }))
}

it.each([
  ['desktop', english, russian],
  ['editor', editorEnglish, editorRussian],
] as const)('preserves every %s translation and its substitution variables', (_name, base, translated) => {
  const source = strings(base)
  const target = strings(translated)
  expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort())
  const variables = (value: string) => (value.match(/\{\{[^}]+\}\}|\$\{[^}]+\}/g) ?? []).sort()
  for (const [key, value] of Object.entries(source)) {
    expect(target[key].trim(), key).not.toBe('')
    expect(variables(target[key]), key).toEqual(variables(value))
  }
})
