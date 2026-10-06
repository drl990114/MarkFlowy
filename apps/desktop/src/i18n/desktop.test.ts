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

it.each([
  [
    'en',
    {
      'image.resetSize': 'Restore automatic size',
      'table.moveRowUp': 'Move row up',
      'table.moveRowDown': 'Move row down',
      'table.moveColumnLeft': 'Move column left',
      'table.moveColumnRight': 'Move column right',
    },
  ],
  [
    'cn',
    {
      'image.resetSize': '恢复自动尺寸',
      'table.moveRowUp': '上移一行',
      'table.moveRowDown': '下移一行',
      'table.moveColumnLeft': '左移一列',
      'table.moveColumnRight': '右移一列',
    },
  ],
  [
    'frFR',
    {
      'image.resetSize': 'Rétablir la taille automatique',
      'table.moveRowUp': 'Déplacer la ligne vers le haut',
      'table.moveRowDown': 'Déplacer la ligne vers le bas',
      'table.moveColumnLeft': 'Déplacer la colonne vers la gauche',
      'table.moveColumnRight': 'Déplacer la colonne vers la droite',
    },
  ],
  [
    'es',
    {
      'image.resetSize': 'Restaurar tamaño automático',
      'table.moveRowUp': 'Subir fila',
      'table.moveRowDown': 'Bajar fila',
      'table.moveColumnLeft': 'Mover columna a la izquierda',
      'table.moveColumnRight': 'Mover columna a la derecha',
    },
  ],
  [
    'ja',
    {
      'image.resetSize': '自動サイズに戻す',
      'table.moveRowUp': '行を上に移動',
      'table.moveRowDown': '行を下に移動',
      'table.moveColumnLeft': '列を左に移動',
      'table.moveColumnRight': '列を右に移動',
    },
  ],
] as const)(
  'loads image-size reset and table movement labels for %s without a fallback',
  async (language, labels) => {
    await i18nInit({ lng: language })
    for (const [key, label] of Object.entries(labels)) {
      const translationKey = `capricorn.${key}`
      expect(i18n.getResource(language, 'translation', translationKey)).toBe(label)
      expect(i18n.t(translationKey, { defaultValue: 'Missing translation' })).toBe(label)
    }
  },
)
