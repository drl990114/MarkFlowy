import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { open } from '@tauri-apps/plugin-dialog'
import { Button } from 'zens'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const PathSelectSettingItem: React.FC<SettingItemProps<Setting.PathSelectSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key]

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          flex: '0 0 50%',
          gap: 8,
        }}
      >
        <Button
          onClick={async () => {
            const dir = await open({ directory: true, recursive: true })
            if (typeof dir !== 'string') return
            appSettingService.writeSettingData(item, dir)
          }}
        >
          Select Folder
        </Button>
        <span
          style={{ color: '#888', fontSize: '12px', wordBreak: 'break-all', textAlign: 'right' }}
        >
          {curValue}
        </span>
      </div>
    </SettingItemContainer>
  )
}

export default PathSelectSettingItem
