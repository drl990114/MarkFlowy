import useAppInfoStore from '@/stores/useAppInfoStore'
import { getName, getTauriVersion, getVersion } from '@tauri-apps/api/app'

export const appInfoStoreSetup = async () => {
  const { setAppInfo } = useAppInfoStore.getState()

  const [name, version, tauriVersion] = await Promise.all([
    getName(),
    getVersion(),
    getTauriVersion(),
  ])

  setAppInfo({
    name,
    version,
    tauriVersion,
  })
}
