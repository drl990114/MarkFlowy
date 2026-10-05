import type { Update } from '@tauri-apps/plugin-updater'
import { create } from 'zustand'

export interface UpdaterState {
  update: Update | null
  isInstalling: boolean
  installedVersion: string | null
}

const useUpdaterStore = create<UpdaterState>(() => ({
  update: null,
  isInstalling: false,
  installedVersion: null,
}))

export default useUpdaterStore
