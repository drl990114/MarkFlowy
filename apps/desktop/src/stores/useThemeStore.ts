import { loadThemeCss, removeInsertedTheme } from '@/helper/extensions'
import { darkTheme, lightTheme, type MfTheme } from '@markflowy/theme'
import { create } from 'zustand'
import type { Theme } from '@mui/material'
import { createTheme } from '@mui/material'
import useAppSettingStore from './useAppSettingStore'

const muiDarkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
  typography: {
    htmlFontSize: 18,
  },
})

const muiLightTheme = createTheme({
  palette: {
    mode: 'light',
  },
  typography: {
    htmlFontSize: 18,
  },
})

export const isBuiltInTheme = (themeName: string) => {
  return themeName === lightTheme.name || themeName === darkTheme.name
}

const useThemeStore = create<ThemeStore>((set, get) => {
  return {
    curTheme: lightTheme,

    themes: [lightTheme, darkTheme],

    muiTheme: muiLightTheme,

    setCurThemeByName: (themeName) => {
      const { themes } = get()
      const targetTheme = themes.find((theme) => theme.name === themeName)

      if (targetTheme) {
        if (targetTheme.globalStyleText) {
          loadThemeCss(targetTheme.globalStyleText)
        } else {
          removeInsertedTheme()
        }

        if (targetTheme.mode === 'dark') {
          document.body.style.colorScheme = 'dark'
        } else {
          document.body.style.colorScheme = 'light'
        }

        set((prev) => ({
          ...prev,
          curTheme: targetTheme,
          muiTheme: targetTheme.mode === 'light' ? muiLightTheme : muiDarkTheme,
        }))
      }
    },

    getCurTheme: () => {
      const { themes, curTheme } = get()

      return themes.find((theme) => theme.name === curTheme.name)
    },

    insertTheme: (targetTheme) => {
      const { themes, setCurThemeByName } = get()

      if (!themes.find((theme) => theme.name === targetTheme.name)) {
        set((prev) => ({ ...prev, themes: [...themes, targetTheme] }))

        const { settingData } = useAppSettingStore.getState()
        if (settingData.theme === targetTheme.name) {
          setCurThemeByName(targetTheme.name)
        }
      }
    },

    deleteTheme: (delThemeName) => {
      const { themes } = get()

      const filterThemes = themes.filter((theme) => theme.name !== delThemeName)

      set((prev) => ({ ...prev, themes: filterThemes }))
    },
  }
})

type ThemeStore = {
  curTheme: MfTheme
  muiTheme: Theme
  themes: MfTheme[]
  setCurThemeByName: (themeName: string) => void
  getCurTheme: () => MfTheme | undefined
  insertTheme: (theme: MfTheme) => void
  deleteTheme: (themeName: string) => void
}

export default useThemeStore
