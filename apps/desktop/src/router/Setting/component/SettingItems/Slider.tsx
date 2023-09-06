import { useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { useGlobalSettingData } from '@/hooks'
import { Slider } from '@mui/material'
import styled from 'styled-components'

const SliderSettingItem: React.FC<SettingItemProps<Setting.SliderSettingItem>> = (props) => {
  const { item, itemKey } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const curValue = settingData[item.key] as unknown as number
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value) setValue(curValue)
  }, [curValue, value])

  const handleChange = useCallback(
    (e: Event, v: number | number[]) => {
      writeSettingData(item, v as number)
    },
    [item, writeSettingData],
  )

  return (
    <Container>
      <label className='setting-item__label'>{itemKey}</label>
      <Slider
        className='setting-item__slider'
        value={value}
        onChange={handleChange}
        valueLabelDisplay='auto'
        min={item.scope[0]}
        max={item.scope[1]}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  .setting-item__slider {
    width: 120px;
  }
`

export default SliderSettingItem
