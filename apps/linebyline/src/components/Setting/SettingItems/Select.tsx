import { useGlobalSettingData } from '@/hooks'
import Autocomplete from '@mui/material/Autocomplete'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingItemProps } from '.'

const SelectSettingItem: React.FC<SettingItemProps<Setting.SelectSettingItem>> = (props) => {
  const { item, itemKey } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const options = item.options
  const curValue = options.find((option) => option.value === settingData[item.key])
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value) {
      setValue(curValue)
    }
  }, [curValue])

  const { t } = useTranslation()

  return (
    <label>
      <label className='setting-item__label'>{itemKey}:</label>
      <Autocomplete
        className='setting-item__form'
        sx={{
          display: 'inline-block',
          '& input': {
            width: 200,
            bgcolor: 'background.paper',
            color: (theme) => theme.palette.getContrastText(theme.palette.background.paper),
          },
        }}
        value={value}
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
          writeSettingData(item, value.value)
          setValue(value)
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
