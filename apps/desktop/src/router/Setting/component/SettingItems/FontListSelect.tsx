import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { TextField } from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import { invoke } from '@tauri-apps/api/core'
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


  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Autocomplete
        value={curValue}
        options={fontList}
        renderOption={(p, option) => <li {...p}>{option}</li>}
        onChange={(e, v) => {
          e.stopPropagation()
          if (!v) return 
          appSettingService.writeSettingData(item, v)
        }}
        sx={{ width: '220px' }}
        disableClearable
        renderInput={(params) => <TextField {...params} size='small' />}
      />
    </SettingItemContainer>
  )
}

export default FontListSelectSettingItem
