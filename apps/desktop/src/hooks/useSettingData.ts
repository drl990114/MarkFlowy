import { invoke } from '@tauri-apps/api'
import { listen, emit } from '@tauri-apps/api/event'
import { createGlobalStore } from 'hox'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface Handler {
  writeSettingData: (item: Pick<Setting.SettingItem, 'key'>, value: any) => void
  setSetting: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

function useSettingData(): [Record<string, any>, Handler] {
  const [setting, setSetting] = useState<Record<string, any>>({})

  useEffect(() => {
    const unlisten = listen('app_conf_change', () => {
      invoke<Record<string, any>>('get_app_conf').then((res) => {
        setSetting(res)
      })
    })

    return () => {
      unlisten.then((f) => f())
    }
  }, [])

  const writeSettingData = useCallback((item: Pick<Setting.SettingItem, 'key'>, value: any) => {
    setSetting((prev) => {
      const newState = {
        ...prev,
        [item.key]: value,
      }
      invoke('save_app_conf', { data: newState, label: 'main' }).then(() => {
        emit('app_conf_change')
      })
      return newState
    })
  }, [])

  const handler = useMemo(
    () => ({
      writeSettingData,
      setSetting,
    }),
    [writeSettingData, setSetting],
  )

  return [setting, handler]
}

const [useGlobalSettingData] = createGlobalStore(useSettingData)
export default useGlobalSettingData
