import Autocomplete from '@mui/material/Autocomplete'
import { useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { useGlobalSettingData } from '@/hooks'
import styled from 'styled-components'

const SelectSettingItem: React.FC<
  SettingItemProps<Setting.SelectSettingItem>
> = (props) => {
  const { item, itemKey } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const options = item.options
  const curValue = options.find(
    option => option.value === settingData[item.key],
  )
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value)
      setValue(curValue)
  }, [curValue])

  return (
    <Container>
      <label className="setting-item__label">{itemKey}</label>
      <Autocomplete
        className="setting-item__form"
        sx={{
          'display': 'inline-block',
          '& input': {
            bgcolor: 'background.paper',
            color: theme =>
              theme.palette.getContrastText(theme.palette.background.paper),
          },
        }}
        value={value}
        options={options}
        getOptionLabel={(option) => {
          // Value selected with enter, right from the input
          if (typeof option === 'string')
            return option

          // Regular option
          return option.title
        }}
        renderOption={(p, option) => <li {...p}>{option.title}</li>}
        onChange={(_, v) => {
          if (!v)
            return
          writeSettingData(item, v.value)
          setValue(v)
        }}
        renderInput={params => (
          <div ref={params.InputProps.ref}>
            <input type="text" {...params.inputProps} />
          </div>
        )}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

export default SelectSettingItem
