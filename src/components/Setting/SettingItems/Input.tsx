import { useGlobalSettingData } from '@/hooks'
import { CacheManager } from '@/utils'
import { useCallback, useEffect, useState } from 'react'
import { SettingItemProps } from '.'

const InputSettingItem: React.FC<SettingItemProps<Setting.InputSettingItem>> = (props) => {
  const { item, itemKey } = props
  const [settingData] = useGlobalSettingData()
  const curValue = settingData[item.key] as unknown as string
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value) {
      setValue(curValue)
    }
  }, [curValue])

  const handleChange = useCallback((e: { target: { value: any } }) => {
    const value = e.target.value
    CacheManager.writeSetting(item, value)
  }, [item])

  return (
    <label>
      {itemKey}
      <input value={value} onChange={handleChange}></input>
    </label>
  )
}

export default InputSettingItem
