import { loadThemeCss, removeInsertedTheme } from '@/helper/extensions'
import { builtInThemes, darkTheme, lightTheme, type MfTheme } from '@markflowy/theme'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { create } from 'zustand'
import appSettingService from '@/services/app-setting'

export const FALLBACK_LIGHT_THEME = 'MarkFlowy Light'
export const FALLBACK_DARK_THEME = 'MarkFlowy Dark'

export type ThemeMode = 'light' | 'dark' | 'system'

export const isBuiltInTheme = (themeName: string) => {
  return builtInThemes.some((theme) => theme.name === themeName)
}

const resolveTheme = (themes: MfTheme[], themeName: string, fallbackName: string): MfTheme | undefined => {
  return themes.find((t) => t.name === themeName) || themes.find((t) => t.name === fallbackName)
}

const applyThemeToDOM = (targetTheme: MfTheme, themeMode: ThemeMode) => {
  if (targetTheme.globalStyleText) {
    loadThemeCss(targetTheme.globalStyleText)
  } else {
    removeInsertedTheme()
  }

  const appWindow = getCurrentWindow()

  if (targetTheme.mode === 'dark') {
    document.body.style.colorScheme = 'dark'
  } else {
    document.body.style.colorScheme = 'light'
  }

  // When themeMode is 'system', don't set a fixed window theme
  // so the webview can follow the OS preference via matchMedia
  if (themeMode === 'system') {
    appWindow.setTheme(null)
  } else {
    appWindow.setTheme(targetTheme.mode)
  }
}

type ThemeStore = {
  curTheme: MfTheme
  themes: MfTheme[]
  themeMode: ThemeMode
  lightThemeName: string
  darkThemeName: string
  setCurThemeByName: (themeName: string) => void
  getCurTheme: () => MfTheme | undefined
  insertTheme: (theme: MfTheme) => void
  deleteTheme: (themeName: string) => void
  setThemeMode: (mode: ThemeMode) => void
  setLightTheme: (themeName: string) => void
  setDarkTheme: (themeName: string) => void
  applyTheme: () => void
  initFromSettings: (settingData: Record<string, any>) => void
}

const useThemeStore = create<ThemeStore>((set, get) => {
  return {
    curTheme: lightTheme,
    themes: [...builtInThemes],
    themeMode: 'system',
    lightThemeName: FALLBACK_LIGHT_THEME,
    darkThemeName: FALLBACK_DARK_THEME,

    applyTheme: () => {
      const { themeMode, lightThemeName, darkThemeName, themes } = get()

      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = themeMode === 'dark' || (themeMode === 'system' && isSystemDark)

      const targetName = isDark ? darkThemeName : lightThemeName
      const fallbackName = isDark ? FALLBACK_DARK_THEME : FALLBACK_LIGHT_THEME

      let targetTheme = resolveTheme(themes, targetName, fallbackName)

      // 终极兜底
      if (!targetTheme) {
        targetTheme = isDark ? darkTheme : lightTheme
      }

      applyThemeToDOM(targetTheme, themeMode)

      set((prev) => ({
        ...prev,
        curTheme: targetTheme!,
      }))
    },

    setCurThemeByName: (themeName) => {
      const { themes, themeMode } = get()
      const targetTheme = themes.find((theme) => theme.name === themeName)

      if (targetTheme) {
        applyThemeToDOM(targetTheme, themeMode)

        // 同步更新 lightThemeName 或 darkThemeName
        const updates: Partial<ThemeStore> = {
          curTheme: targetTheme,
        }
        if (targetTheme.mode === 'light') {
          updates.lightThemeName = targetTheme.name
          appSettingService.writeSettingData({ key: 'light_theme' }, targetTheme.name)
        } else if (targetTheme.mode === 'dark') {
          updates.darkThemeName = targetTheme.name
          appSettingService.writeSettingData({ key: 'dark_theme' }, targetTheme.name)
        }

        set((prev) => ({ ...prev, ...updates }))
      }
    },

    getCurTheme: () => {
      const { themes, curTheme } = get()
      return themes.find((theme) => theme.name === curTheme.name)
    },

    insertTheme: (targetTheme) => {
      const { themes } = get()

      if (!themes.find((theme) => theme.name === targetTheme.name)) {
        set((prev) => ({ ...prev, themes: [...themes, targetTheme] }))
      }
    },

    deleteTheme: (delThemeName) => {
      const { themes, lightThemeName, darkThemeName, curTheme } = get()

      const filterThemes = themes.filter((theme) => theme.name !== delThemeName)

      let newLight = lightThemeName
      let newDark = darkThemeName

      // 兜底：被删除的是当前配置的亮色主题
      if (delThemeName === lightThemeName) {
        newLight = FALLBACK_LIGHT_THEME
        appSettingService.writeSettingData({ key: 'light_theme' }, FALLBACK_LIGHT_THEME)
      }

      // 兜底：被删除的是当前配置的暗色主题
      if (delThemeName === darkThemeName) {
        newDark = FALLBACK_DARK_THEME
        appSettingService.writeSettingData({ key: 'dark_theme' }, FALLBACK_DARK_THEME)
      }

      set((prev) => ({
        ...prev,
        themes: filterThemes,
        lightThemeName: newLight,
        darkThemeName: newDark,
      }))

      // 如果当前正在使用被删除的主题，立即切换
      if (delThemeName === curTheme.name) {
        get().applyTheme()
      }
    },

    setThemeMode: (mode) => {
      appSettingService.writeSettingData({ key: 'theme_mode' }, mode)
      set((prev) => ({ ...prev, themeMode: mode }))
      get().applyTheme()
    },

    setLightTheme: (themeName) => {
      appSettingService.writeSettingData({ key: 'light_theme' }, themeName)
      set((prev) => ({ ...prev, lightThemeName: themeName }))
      get().applyTheme()
    },

    setDarkTheme: (themeName) => {
      appSettingService.writeSettingData({ key: 'dark_theme' }, themeName)
      set((prev) => ({ ...prev, darkThemeName: themeName }))
      get().applyTheme()
    },

    initFromSettings: (settingData) => {
      const state = get()

      const themeMode = (settingData.theme_mode as ThemeMode) || 'system'
      const lightThemeName = (settingData.light_theme as string) || FALLBACK_LIGHT_THEME
      const darkThemeName = (settingData.dark_theme as string) || FALLBACK_DARK_THEME

      set((prev) => ({
        ...prev,
        themeMode,
        lightThemeName,
        darkThemeName,
      }))

      // 应用主题
      get().applyTheme()
    },
  }
})

// 监听系统主题变化
if (typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (useThemeStore.getState().themeMode === 'system') {
      useThemeStore.getState().applyTheme()
    }
  })
}

export default useThemeStore
