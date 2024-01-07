import { loadThemeCss } from '@/helper/extensions'
import { darkTheme, lightTheme, type MfTheme } from '@markflowy/theme'
import { create } from 'zustand'
import type { Theme } from '@mui/material'
import { createTheme } from '@mui/material'
import { confRef } from '@/App'

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

const useThemeStore = create<ThemeStore>((set, get) => {
  return {
    curTheme: lightTheme,

    themes: [lightTheme, darkTheme],

    muiTheme: muiLightTheme,

    setCurThemeByName: (themeName) => {
      const { themes } = get()
      const targetTheme = themes.find((theme) => theme.name === themeName)

      if (targetTheme) {

        if (targetTheme.globalStyleText)  {
          loadThemeCss(targetTheme.globalStyleText)
        }

        set((prev) => ({ ...prev, curTheme: targetTheme, muiTheme: themeName === 'light' ? muiLightTheme : muiDarkTheme }))
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

        if (confRef.current.theme === targetTheme.name) {
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
