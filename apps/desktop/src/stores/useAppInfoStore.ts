import { create } from 'zustand'

const useAppInfoStore = create<AppInfoStore>((set) => {
  return {
    appInfo: {
      name: '',
      version: '',
      tauriVersion: '',
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
  setAppInfo: (appInfo: AppInfo) => void
}

export default useAppInfoStore
