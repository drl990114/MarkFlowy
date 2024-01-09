import { create } from 'zustand'

const useAppSettingStore = create<AppSettingStore>((set) => {
  return {
    settingData: {},

    setSettingData: (settingData) => {
      set(() => {
        return {
          settingData
        }
      })
    },
  }
})

interface AppSettingStore {
  settingData: Record<string, any>
  setSettingData: (settingData: Record<string, any>) => void
}

export default useAppSettingStore
