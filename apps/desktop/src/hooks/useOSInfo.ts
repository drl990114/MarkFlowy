import type { Platform } from '@tauri-apps/plugin-os'
import { platform } from '@tauri-apps/plugin-os'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'

interface OSInfo {
  platform?: Platform
}

function useOSInfo() {
  const [osInfo, setOsInfo] = useState<OSInfo>({})

  useEffect(() => {
    Promise.all([platform()]).then((res) => {
      const [osType] = res
      setOsInfo({
        platform: osType,
      })
    })
  }, [])

  return osInfo
}

const [useGlobalOSInfo] = createGlobalStore(useOSInfo)
export default useGlobalOSInfo
