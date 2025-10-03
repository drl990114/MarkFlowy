import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { TextField } from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'
import { changeLng } from '@/i18n'

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
          if (item.key === 'language') {
            changeLng(v.value)
          }
        }}
        getOptionKey={(option) => option.value}
        sx={{ width: '220px' }}
        disableClearable
        renderInput={(params) => <TextField {...params} size='small' />}
      />
    </SettingItemContainer>
  )
}

export default SelectSettingItem
