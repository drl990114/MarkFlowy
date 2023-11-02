import { darkTheme, lightTheme, type MfTheme } from '@markflowy/theme'
import { create } from 'zustand'

const useThemeStore = create<ThemeStore>((set) => {
  return {
    curThemeId: 'light',
    themes: [
      lightTheme,
      darkTheme
    ],
  }
})

type ThemeStore = {
  themes: MfTheme[]
}

export default useThemeStore

