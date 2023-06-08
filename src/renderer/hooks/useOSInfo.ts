import { OsType, type } from '@tauri-apps/api/os';
import { createGlobalStore } from 'hox';
import { useEffect, useState } from 'react';

interface OSInfo {
  osType?: OsType
}

const useOSInfo = () => {
  const [osInfo, setOsInfo] = useState<OSInfo>({})

  useEffect(() => {
    Promise.all([type()]).then(res => {
      const [osType] = res
      setOsInfo({
        osType
      })
    })
  }, [])

  return osInfo
}

const [useGlobalOSInfo] = createGlobalStore(useOSInfo)
export default useGlobalOSInfo
