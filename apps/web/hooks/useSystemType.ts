import { useEffect, useState } from 'react'

export type SystemType = 'windows' | 'macos' | 'linux' | 'unknown'

export const useSystemType = () => {
  const [system, setSystem] = useState<SystemType>('unknown')

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase()
    const platform = window.navigator.platform.toLowerCase()

    if (platform.includes('win') || userAgent.includes('win')) {
      setSystem('windows')
    } else if (platform.includes('mac') || userAgent.includes('mac')) {
      setSystem('macos')
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      setSystem('linux')
    }
  }, [])

  return system
}
