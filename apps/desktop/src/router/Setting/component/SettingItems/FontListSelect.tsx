import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { invoke } from '@tauri-apps/api/core'
import { Select } from 'antd'
import { useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const FontListSelectSettingItem: React.FC<SettingItemProps<Setting.FontListSelectSettingItem>> = (
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()

  const [fontList, setFontList] = useState<string[]>([])
  const curValue = settingData[item.key]

  useEffect(() => {
    invoke<string[]>('font_list').then((fontList) => {
      setFontList(fontList)
    })
  }, [])

  const handleChange = (value: string) => {
    appSettingService.writeSettingData(item, value)
  }

  const handleSearch = (value: string) => {
    console.log('search:', value)
  }

  const options = fontList.map(font => ({
    value: font,
    label: font
  }))

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Select
        value={curValue}
        onChange={handleChange}
        options={options}
        showSearch={{ optionFilterProp: 'label', onSearch: handleSearch }}
        style={{ width: '220px' }}
        placeholder="Select a font"
      />
    </SettingItemContainer>
  )
}

export default FontListSelectSettingItem
