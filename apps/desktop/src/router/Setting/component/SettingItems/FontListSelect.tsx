import { SearchableSelect } from '@/components/ui/searchable-select'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SYSTEM_DEFAULT_FONT_FAMILY = 'System Default'
const DEFAULT_MONOSPACE_FONT_FAMILY = 'Default Monospace'

const FontListSelectSettingItem: React.FC<SettingItemProps<Setting.FontListSelectSettingItem>> = (
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const { t } = useTranslation()

  const [fontList, setFontList] = useState<string[]>([])
  const curValue = String(settingData[item.key] ?? '')

  useEffect(() => {
    invoke<string[]>('font_list').then((availableFonts) => {
      setFontList(availableFonts)
    })
  }, [])

  const handleChange = (value: string) => {
    appSettingService.writeSettingData(item, value)
  }

  const handleSearch = (value: string) => {
    logger.info('search:', value)
  }

  const defaultOptions =
    item.key === 'editor_root_font_family'
      ? [{ value: SYSTEM_DEFAULT_FONT_FAMILY, label: SYSTEM_DEFAULT_FONT_FAMILY }]
      : item.key === 'editor_code_font_family'
        ? [{ value: DEFAULT_MONOSPACE_FONT_FAMILY, label: DEFAULT_MONOSPACE_FONT_FAMILY }]
        : []

  const options = [
    ...defaultOptions,
    ...fontList.map((font) => ({
      value: font,
      label: font,
    })),
  ]

  return (
    <SettingItemContainer $settingKey={item.key}>
      <SettingLabel item={item} />
      <SearchableSelect
        aria-label={t(item.title.i18nKey)}
        value={curValue}
        onValueChange={handleChange}
        options={options}
        onSearch={handleSearch}
        style={{ width: 220 }}
        placeholder='Select a font'
      />
    </SettingItemContainer>
  )
}

export default FontListSelectSettingItem
