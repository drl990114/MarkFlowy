import { create } from 'zustand'
import { getName, getTauriVersion, getVersion } from '@tauri-apps/api/app'

const useAppInfoStore = create<AppInfoStore>((set, get) => {
  return {
    appInfo: {
      name: '',
      version: '',
      tauriVersion: '',
    },

    setup: async () => {
      const { setAppInfo } = get()

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
    },

    setAppInfo: (appInfo) => {
      set(() => {
        return {
          appInfo,
        }
      })
    },
  }
})

type AppInfo = {
  name: string
  version: string
  tauriVersion: string
}

interface AppInfoStore {
  appInfo: AppInfo
  setup: () => void
  setAppInfo: (appInfo: AppInfo) => void
}

export default useAppInfoStore
