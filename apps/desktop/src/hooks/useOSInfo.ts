import type { OsType } from '@tauri-apps/plugin-os'
import { type } from '@tauri-apps/plugin-os'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'

interface OSInfo {
  osType?: OsType
}

function useOSInfo() {
  const [osInfo, setOsInfo] = useState<OSInfo>({})

  useEffect(() => {
    Promise.all([type()]).then((res) => {
      const [osType] = res
      setOsInfo({
        osType,
      })
    })
  }, [])

  return osInfo
}

const [useGlobalOSInfo] = createGlobalStore(useOSInfo)
export default useGlobalOSInfo
