import Autocomplete from '@mui/material/Autocomplete'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'
import { TextField } from '@mui/material'

const SelectSettingItem: React.FC<SettingItemProps<Setting.SelectSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const options = item.options
  const curValue = options.find((option) => option.value === settingData[item.key])

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Autocomplete
        value={curValue}
        options={options}
        getOptionLabel={(option) => {
          // Value selected with enter, right from the input
          if (typeof option === 'string') return option

          // Regular option
          return option.title
        }}
        renderOption={(p, option) => <li {...p}>{option.title}</li>}
        onChange={(e, v) => {
          e.stopPropagation()
          if (!v) return
          appSettingService.writeSettingData(item, v.value)
        }}
        sx={{ width: '220px' }}
        disableClearable
        renderInput={(params) => <TextField {...params} size='small' />}
      />
    </SettingItemContainer>
  )
}

export default SelectSettingItem
