import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { Select } from 'antd'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SelectSettingItem: React.FC<SettingItemProps<Setting.SelectSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const options = item.options
  const currentValue = settingData[item.key]

  const selectOptions = options.map(option => ({
    value: option.value,
    label: option.title
  }))

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Select
        value={currentValue}
        options={selectOptions}
        onChange={(value) => {
          appSettingService.writeSettingData(item, value)
        }}
        style={{ width: 220 }}
        placeholder="请选择"
      />
    </SettingItemContainer>
  )
}

export default SelectSettingItem
