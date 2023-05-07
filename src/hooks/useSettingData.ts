import { EVENT } from '@constants'
import { listen } from '@tauri-apps/api/event'
import { CacheManager } from '@utils'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'

const useSettingData = () => {
  const [setting, setSetting] = useState(CacheManager.settingData)

  useEffect(() => {
    const handleSettingData = ({ payload }: any) => {
      setSetting({...payload})
    }

    listen(EVENT.setting_data_loaded, handleSettingData)
    listen(EVENT.setting_data_change, handleSettingData)
  }, [])

  return [setting]
}

const [useGlobalSettingData] = createGlobalStore(useSettingData)
export default useGlobalSettingData
