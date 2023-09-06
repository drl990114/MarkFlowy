import { useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { useGlobalSettingData } from '@/hooks'
import { Switch } from '@mui/material'
import styled from 'styled-components'

const SwitchSettingItem: React.FC<SettingItemProps<Setting.SwitchSettingItem>> = (
  props,
) => {
  const { item, itemKey } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const curValue = settingData[item.key] as unknown as boolean
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value)
      setValue(curValue)
  }, [curValue, value])

  const handleChange = useCallback(
    (e: { target: { value: any } }) => {
      const settingValue = e.target.value
      writeSettingData(item, settingValue)
    },
    [item, writeSettingData],
  )

  return (
    <Container>
      <label className="setting-item__label">{itemKey}</label>
      <Switch
        value={value}
        onChange={handleChange}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

export default SwitchSettingItem
