import type { OsType } from '@tauri-apps/plugin-os'
import { type } from '@tauri-apps/plugin-os'
import { createGlobalStore } from 'hox'
import { useState } from 'react'

interface OSInfo {
  osType?: OsType
}

function useOSInfo() {
  const [osInfo] = useState<OSInfo>(() => {
    try {
      return { osType: type() }
    } catch {
      return {}
    }
  })

  return osInfo
}

const [useGlobalOSInfo] = createGlobalStore(useOSInfo)
export default useGlobalOSInfo
