import { invoke } from '@tauri-apps/api'
import { createGlobalStore } from 'hox'
import { useCallback, useMemo, useState } from 'react'

interface Handler {
  writeSettingData: (item: Pick<Setting.SettingItem, 'value' | 'key'>, value: any) => void
  setSetting: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

const useSettingData = (): [Record<string, any>, Handler] => {
  const [setting, setSetting] = useState<Record<string, any>>({})

  const writeSettingData = useCallback((item: Pick<Setting.SettingItem, 'value' | 'key'>, value: any) => {
    setSetting((prev) => {
      const newState = {
        ...prev,
        [item.key]: value,
      }
      invoke('save_app_conf', { data: newState, label: 'main'})
      return newState
    })
  }, [])

  const handler = useMemo(
    () => ({
      writeSettingData,
      setSetting
    }),
    [writeSettingData, setSetting]
  )

  return [setting, handler]
}

const [useGlobalSettingData] = createGlobalStore(useSettingData)
export default useGlobalSettingData
