import { createContext, useContext } from 'react'

export interface AppContextValue {
  /** Current platform os type */
  osType?: 'macos' | 'windows' | 'linux' | 'unknown'
  /** Copy text to clipboard */
  copyText?: (text: string) => Promise<void> | void
  /** Open a folder dialog and return selected path */
  openFolderDialog?: () => Promise<string | null>
  /** Create a new window */
  createNewWindow?: (options: { path?: string }) => Promise<void>
  /** Listen to app events */
  listenAppEvent?: <T>(event: string, handler: (payload: T) => void) => Promise<() => void>
}

export const AppContext = createContext<AppContextValue | undefined>(undefined)

export const useAppContext = () => {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return ctx
}
