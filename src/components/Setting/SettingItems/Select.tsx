import Autocomplete from '@mui/material/Autocomplete'
import { CacheManager } from '@utils'
import { useTranslation } from 'react-i18next'
import { SettingItemProps } from '.'

const SelectSettingItem: React.FC<SettingItemProps> = (props) => {
  const { item, itemKey, itemParentKey, categoryKey } = props
  const { t } = useTranslation()
  const options = item.options

  return (
    <label>
      {itemKey}
      <Autocomplete
        sx={{
          display: 'inline-block',
          '& input': {
            width: 200,
            bgcolor: 'background.paper',
            color: (theme) => theme.palette.getContrastText(theme.palette.background.paper),
          },
        }}
        value={options.find((option) => option.value === CacheManager.settingData[categoryKey][itemParentKey][itemKey].value)}
        options={options}
        getOptionLabel={(option) => {
          // Value selected with enter, right from the input
          if (typeof option === 'string') return option

          // Regular option
          return option.title
        }}
        renderOption={(props, option) => <li {...props}>{option.title}</li>}
        onChange={(_, value) => {
          if (!value) return 
          CacheManager.writeSetting(categoryKey, itemParentKey, itemKey, value)
        }}
        renderInput={(params) => (
          <div ref={params.InputProps.ref}>
            <input type="text" {...params.inputProps} />
          </div>
        )}
      />
    </label>
  )
}

export default SelectSettingItem
