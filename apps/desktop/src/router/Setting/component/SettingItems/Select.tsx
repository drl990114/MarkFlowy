import Autocomplete from '@mui/material/Autocomplete'
import { useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { useGlobalSettingData } from '@/hooks'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'
import { Input } from '@/components/UI/Input'

const SelectSettingItem: React.FC<SettingItemProps<Setting.SelectSettingItem>> = (props) => {
  const { item } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const options = item.options
  const curValue = options.find((option) => option.value === settingData[item.key])
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value) setValue(curValue)
  }, [curValue])

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Autocomplete
        value={value}
        options={options}
        getOptionLabel={(option) => {
          // Value selected with enter, right from the input
          if (typeof option === 'string') return option

          // Regular option
          return option.title
        }}
        renderOption={(p, option) => <li {...p}>{option.title}</li>}
        onChange={(_, v) => {
          if (!v) return
          writeSettingData(item, v.value)
          setValue(v)
        }}
        renderInput={(params) => (
          <div ref={params.InputProps.ref}>
            <Input type='text' {...params.inputProps} />
          </div>
        )}
      />
    </SettingItemContainer>
  )
}

export default SelectSettingItem
