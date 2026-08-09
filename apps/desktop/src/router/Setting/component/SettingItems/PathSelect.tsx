import { Button } from '@/components/ui/button'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { open } from '@tauri-apps/plugin-dialog'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const PathSelectSettingItem: React.FC<SettingItemProps<Setting.PathSelectSettingItem>> = (
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key]

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <div className='flex w-1/2 min-w-0 flex-col items-end gap-1 max-[720px]:w-full'>
        <Button
          size='sm'
          variant='outline'
          onClick={async () => {
            const dir = await open({
              directory: true,
              recursive: true,
              fileAccessMode: 'scoped',
            })
            if (typeof dir !== 'string') return
            appSettingService.writeSettingData(item, dir)
          }}
        >
          Select Folder
        </Button>
        <span className='max-w-full break-all text-right text-xs text-muted-foreground'>
          {curValue}
        </span>
      </div>
    </SettingItemContainer>
  )
}

export default PathSelectSettingItem
