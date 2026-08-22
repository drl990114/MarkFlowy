import type { SettingData } from './settingMap'

export type SettingCategoryKey = keyof SettingData

export interface SettingSearchEntry {
  id: string
  kind: 'category' | 'field'
  categoryKey: SettingCategoryKey
  categoryI18nKey: string
  groupKey?: string
  groupI18nKey?: string
  childId?: string
  childI18nKey?: string
  settingKey?: string
  titleI18nKey: string
  descI18nKey?: string
}

type Translate = (key: string) => string
type UnknownRecord = Record<string, unknown>

const GROUP_META_KEYS = new Set(['i18nKey', 'iconName', 'desc', 'children', 'providerId'])

type SupplementalField = Pick<
  SettingSearchEntry,
  'categoryKey' | 'groupKey' | 'groupI18nKey' | 'settingKey' | 'titleI18nKey' | 'descI18nKey'
>

const supplementalFields: SupplementalField[] = [
  {
    categoryKey: 'display',
    groupKey: 'Theme',
    groupI18nKey: 'settings.display.theme.label',
    settingKey: 'theme_mode',
    titleI18nKey: 'settings.display.theme.mode.label',
    descI18nKey: 'settings.display.theme.mode.desc',
  },
  {
    categoryKey: 'display',
    groupKey: 'Theme',
    groupI18nKey: 'settings.display.theme.label',
    settingKey: 'light_theme',
    titleI18nKey: 'settings.display.theme.light_theme.label',
    descI18nKey: 'settings.display.theme.light_theme.desc',
  },
  {
    categoryKey: 'display',
    groupKey: 'Theme',
    groupI18nKey: 'settings.display.theme.label',
    settingKey: 'dark_theme',
    titleI18nKey: 'settings.display.theme.dark_theme.label',
    descI18nKey: 'settings.display.theme.dark_theme.desc',
  },
  {
    categoryKey: 'display',
    groupKey: 'Theme',
    groupI18nKey: 'settings.display.theme.label',
    settingKey: 'theme_accent_color',
    titleI18nKey: 'settings.display.theme.accent_color.label',
    descI18nKey: 'settings.display.theme.accent_color.desc',
  },
  {
    categoryKey: 'image',
    groupKey: 'paste_event',
    groupI18nKey: 'settings.image.paste_event.label',
    settingKey: 'when_paste_image',
    titleI18nKey: 'settings.image.paste_event.when_paste_image.label',
    descI18nKey: 'settings.image.paste_event.when_paste_image.desc',
  },
  {
    categoryKey: 'image',
    groupKey: 'upload_img',
    groupI18nKey: 'settings.image.upload_img.label',
    settingKey: 'when_upload_image',
    titleI18nKey: 'settings.image.upload_img.when_upload_image.label',
    descI18nKey: 'settings.image.upload_img.when_upload_image.desc',
  },
]

const asRecord = (value: unknown): UnknownRecord | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as UnknownRecord
}

const getI18nKey = (value: unknown): string | undefined => {
  const record = asRecord(value)
  return typeof record?.i18nKey === 'string' ? record.i18nKey : undefined
}

const isSettingItem = (value: unknown): value is UnknownRecord => {
  const record = asRecord(value)
  return Boolean(
    record &&
      typeof record.key === 'string' &&
      typeof record.type === 'string' &&
      getI18nKey(record.title),
  )
}

const createFieldEntry = ({
  categoryI18nKey,
  categoryKey,
  childId,
  childI18nKey,
  groupI18nKey,
  groupKey,
  item,
}: {
  categoryI18nKey: string
  categoryKey: SettingCategoryKey
  childId?: string
  childI18nKey?: string
  groupI18nKey?: string
  groupKey?: string
  item: UnknownRecord
}): SettingSearchEntry => {
  const settingKey = String(item.key)
  return {
    id: ['field', categoryKey, groupKey, childId, settingKey].filter(Boolean).join(':'),
    kind: 'field',
    categoryKey,
    categoryI18nKey,
    groupKey,
    groupI18nKey,
    childId,
    childI18nKey,
    settingKey,
    titleI18nKey: getI18nKey(item.title) ?? settingKey,
    descI18nKey: getI18nKey(item.desc),
  }
}

export const createSettingSearchIndex = (settingMap: SettingData): SettingSearchEntry[] => {
  const entries: SettingSearchEntry[] = []
  const categories = Object.entries(settingMap) as [SettingCategoryKey, unknown][]

  categories.forEach(([categoryKey, categoryValue]) => {
    const category = asRecord(categoryValue)
    const categoryI18nKey = getI18nKey(category)
    if (!category || !categoryI18nKey) return

    entries.push({
      id: `category:${categoryKey}`,
      kind: 'category',
      categoryKey,
      categoryI18nKey,
      titleI18nKey: categoryI18nKey,
      descI18nKey: getI18nKey(category.desc),
    })

    Object.entries(category).forEach(([groupKey, groupValue]) => {
      if (GROUP_META_KEYS.has(groupKey)) return

      if (isSettingItem(groupValue)) {
        entries.push(createFieldEntry({ categoryI18nKey, categoryKey, item: groupValue }))
        return
      }

      const group = asRecord(groupValue)
      if (!group) return
      const groupI18nKey = getI18nKey(group)
      const children = Array.isArray(group.children) ? group.children : []

      if (children.length > 0) {
        children.forEach((childValue, childIndex) => {
          const child = asRecord(childValue)
          if (!child) return
          const childId = String(child.providerId ?? childIndex)
          const childI18nKey = getI18nKey(child)

          Object.entries(child).forEach(([itemKey, itemValue]) => {
            if (GROUP_META_KEYS.has(itemKey) || !isSettingItem(itemValue)) return
            entries.push(
              createFieldEntry({
                categoryI18nKey,
                categoryKey,
                childId,
                childI18nKey,
                groupI18nKey,
                groupKey,
                item: itemValue,
              }),
            )
          })
        })
        return
      }

      Object.entries(group).forEach(([itemKey, itemValue]) => {
        if (GROUP_META_KEYS.has(itemKey) || !isSettingItem(itemValue)) return
        entries.push(
          createFieldEntry({
            categoryI18nKey,
            categoryKey,
            groupI18nKey,
            groupKey,
            item: itemValue,
          }),
        )
      })
    })
  })

  const existingFieldIds = new Set(entries.map((entry) => entry.id))
  supplementalFields.forEach((field) => {
    const category = asRecord(settingMap[field.categoryKey])
    const categoryI18nKey = getI18nKey(category)
    if (!categoryI18nKey || !field.settingKey) return

    const entry: SettingSearchEntry = {
      ...field,
      id: ['field', field.categoryKey, field.groupKey, field.settingKey].filter(Boolean).join(':'),
      kind: 'field',
      categoryI18nKey,
    }
    if (!existingFieldIds.has(entry.id)) entries.push(entry)
  })

  return entries
}

export const getSettingSearchPath = (entry: SettingSearchEntry, translate: Translate): string[] => {
  return [entry.categoryI18nKey, entry.groupI18nKey, entry.childI18nKey]
    .filter((key): key is string => Boolean(key))
    .map(translate)
}

export const filterSettingSearchEntries = (
  entries: SettingSearchEntry[],
  query: string,
  translate: Translate,
): SettingSearchEntry[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return []

  return entries.filter((entry) => {
    const searchableText = [
      translate(entry.titleI18nKey),
      entry.descI18nKey ? translate(entry.descI18nKey) : '',
      ...getSettingSearchPath(entry, translate),
    ]
      .join('\n')
      .toLocaleLowerCase()

    return searchableText.includes(normalizedQuery)
  })
}

const normalizeAnchorPart = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const getSettingGroupAnchorId = (
  categoryKey: string,
  groupKey: string,
  childId?: string,
) => {
  return ['setting-group', categoryKey, groupKey, childId]
    .filter(Boolean)
    .map((part) => normalizeAnchorPart(String(part)))
    .join('-')
}
