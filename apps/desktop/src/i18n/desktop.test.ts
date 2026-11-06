import { expect, it } from 'vitest'
import i18n, { changeLng, i18nInit, locales } from '../../../../packages/i18n/src/desktop'

it('loads only the current language and English, adds switched languages and retains legacy consumers', async () => {
  await i18nInit({ lng: 'cn' })
  expect(Object.keys(i18n.services.resourceStore.data).sort()).toEqual(['cn', 'en'])
  expect(i18n.t('common.retry')).toBe('重试')
  await changeLng('ja')
  expect(Object.keys(i18n.services.resourceStore.data).sort()).toEqual(['cn', 'en', 'ja'])
  expect(i18n.language).toBe('ja')
  const legacy = await import('../../../../packages/i18n/src/index')
  expect(Object.keys(legacy.resources)).toHaveLength(Object.keys(locales).length)
  expect(Object.keys(legacy.editorResources)).toHaveLength(Object.keys(locales).length)
  expect(legacy.default).toBe(i18n)
  await legacy.i18nInit({ lng: 'frFR' })
  expect(i18n.language).toBe('frFR')
  expect(Object.keys(i18n.services.resourceStore.data)).toHaveLength(Object.keys(locales).length)
})

it.each([
  ['en', 'Duplicate row', 'Duplicate column'],
  ['cn', '复制当前行', '复制当前列'],
  ['frFR', 'Dupliquer la ligne', 'Dupliquer la colonne'],
  ['es', 'Duplicar fila', 'Duplicar columna'],
  ['ja', '行を複製', '列を複製'],
] as const)(
  'loads table duplication labels for %s without a fallback',
  async (language, rowLabel, columnLabel) => {
    await i18nInit({ lng: language })
    for (const [key, label] of [
      ['duplicateRow', rowLabel],
      ['duplicateColumn', columnLabel],
    ]) {
      const translationKey = `capricorn.table.${key}`
      expect(i18n.getResource(language, 'translation', translationKey)).toBe(label)
      expect(i18n.t(translationKey, { defaultValue: 'Missing translation' })).toBe(label)
    }
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

it.each([
  ['en', 'Collapse section', 'Expand section'],
  ['cn', '折叠章节', '展开章节'],
  ['frFR', 'Replier la section', 'Déplier la section'],
  ['es', 'Contraer sección', 'Expandir sección'],
  ['ja', 'セクションを折りたたむ', 'セクションを展開'],
] as const)(
  'loads heading-folding labels for %s without a fallback',
  async (language, collapse, expand) => {
    await i18nInit({ lng: language })
    for (const [key, label] of [
      ['collapseSection', collapse],
      ['expandSection', expand],
    ]) {
      const translationKey = `capricorn.heading.${key}`
      expect(i18n.getResource(language, 'translation', translationKey)).toBe(label)
      expect(i18n.t(translationKey, { defaultValue: 'Missing translation' })).toBe(label)
    }
  },
)

it.each([
  ['en', ['Select row', 'Select column', 'Drag row to reorder', 'Drag column to reorder']],
  ['cn', ['选择整行', '选择整列', '拖动以调整行顺序', '拖动以调整列顺序']],
  [
    'frFR',
    [
      'Sélectionner la ligne',
      'Sélectionner la colonne',
      'Faire glisser pour réordonner la ligne',
      'Faire glisser pour réordonner la colonne',
    ],
  ],
  [
    'es',
    [
      'Seleccionar fila',
      'Seleccionar columna',
      'Arrastrar para reordenar la fila',
      'Arrastrar para reordenar la columna',
    ],
  ],
  ['ja', ['行を選択', '列を選択', 'ドラッグして行を並べ替え', 'ドラッグして列を並べ替え']],
] as const)(
  'loads table reorder labels and interpolated announcements for %s',
  async (language, labels) => {
    await i18nInit({ lng: language })
    const keys = ['selectRow', 'selectColumn', 'dragRow', 'dragColumn']
    keys.forEach((key, index) => {
      const translationKey = `capricorn.table.${key}`
      expect(i18n.getResource(language, 'translation', translationKey)).toBe(labels[index])
      expect(i18n.t(translationKey, { defaultValue: 'Missing translation' })).toBe(labels[index])
    })

    for (const key of ['dragRowPosition', 'dragColumnPosition']) {
      const translationKey = `capricorn.table.${key}`
      expect(i18n.getResource(language, 'translation', translationKey)).toContain('{{from}}')
      expect(i18n.getResource(language, 'translation', translationKey)).toContain('{{to}}')
      const message = i18n.t(translationKey, {
        defaultValue: 'Missing translation',
        from: 4,
        to: 2,
      })
      expect(message).toContain('4')
      expect(message).toContain('2')
      expect(message).not.toMatch(/[{}]/)
    }
    for (const key of ['movedRow', 'movedColumn']) {
      const translationKey = `capricorn.table.${key}`
      expect(i18n.getResource(language, 'translation', translationKey)).toContain('{{position}}')
      const message = i18n.t(translationKey, { defaultValue: 'Missing translation', position: 2 })
      expect(message).toContain('2')
      expect(message).not.toMatch(/[{}]/)
    }
  },
)
