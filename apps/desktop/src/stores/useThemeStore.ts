import { loadThemeCss, removeInsertedTheme } from '@/helper/extensions'
import {
  applyResolvedAppearance,
  cacheStartupAppearance,
  normalizeStartupAppearance,
  normalizeStartupPalette,
  persistStartupAppearance,
  readWindowBootstrap,
  type StartupAppearancePersistence,
} from '@/startup/appearance'
import { mergeRegisteredTheme, resolveStartupTheme } from '@/startup/appearanceTheme'
import {
  discardStaleStartupTheme,
  runWithoutThemeTransitions,
} from '@/startup/staleThemeFallback'
import { builtInThemes, darkTheme, lightTheme, type MfTheme } from '@markflowy/theme'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { create } from 'zustand'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'

export const FALLBACK_LIGHT_THEME = 'MarkFlowy Light'
export const FALLBACK_DARK_THEME = 'MarkFlowy Dark'

export type ThemeMode = 'light' | 'dark' | 'system'
type SystemTheme = Exclude<ThemeMode, 'system'>
export type ThemePreviewSelection = {
  themeMode?: ThemeMode
  lightThemeName?: string
  darkThemeName?: string
}
type ThemeSyncWindow = Window & {
  __markflowyThemeSyncSetup?: boolean
}

export const isBuiltInTheme = (themeName: string) => {
  return builtInThemes.some((theme) => theme.name === themeName)
}

const normalizeSystemTheme = (theme: unknown): SystemTheme | undefined => {
  return theme === 'dark' || theme === 'light' ? theme : undefined
}

const getBrowserSystemTheme = (): SystemTheme => {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

const getWindowSystemTheme = async (): Promise<SystemTheme | undefined> => {
  try {
    return normalizeSystemTheme(await getCurrentWindow().theme())
  } catch {
    return undefined
  }
}

const getNativeSystemTheme = async (): Promise<SystemTheme | undefined> => {
  try {
    return normalizeSystemTheme(await invoke<SystemTheme>('get_system_theme'))
  } catch {
    return undefined
  }
}

const resolveTheme = (
  themes: MfTheme[],
  themeName: string,
  fallbackName: string,
  mode: SystemTheme,
): MfTheme | undefined =>
  themes.find((theme) => theme.name === themeName && theme.mode === mode) ||
  themes.find((theme) => theme.name === fallbackName && theme.mode === mode)

const applyThemeToDOM = (targetTheme: MfTheme, themeMode: ThemeMode) => {
  applyResolvedAppearance(targetTheme.mode)

  if (targetTheme.globalStyleText) {
    loadThemeCss(targetTheme.globalStyleText)
  } else {
    removeInsertedTheme()
  }

  try {
    const appWindow = getCurrentWindow()

    // Keep the native window on the OS preference while the app UI uses
    // the resolved systemTheme tracked in this store.
    if (themeMode === 'system') {
      void appWindow.setTheme(null)
    } else {
      void appWindow.setTheme(targetTheme.mode)
    }
  } catch {
    // The desktop build always has Tauri internals; this keeps browser previews from crashing.
  }
}

const resolveStartupAccentColor = (
  themeAccent: string | undefined,
  setting = useAppSettingStore.getState().settingData.theme_accent_color,
) => {
  if (typeof setting !== 'string' || setting === 'system') return themeAccent

  const color = setting.trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, red, green, blue] = color
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase()
  }

  return themeAccent
}

const createAppliedThemeAppearance = (
  targetTheme: MfTheme,
  themeMode: ThemeMode,
  accentColorSetting?: unknown,
) => {
  const tokens = targetTheme.styledConstants
  const palette = normalizeStartupPalette(
    {
      surfaceApp: tokens.bgColor,
      surfacePanel: tokens.sideBarBgColor,
      surfaceToolbar: tokens.titleBarBgColor,
      foreground: tokens.primaryFontColor,
      mutedForeground: tokens.unselectedFontColor,
      border: tokens.borderColor,
      accent: resolveStartupAccentColor(tokens.accentColor, accentColorSetting),
    },
    targetTheme.mode,
  )

  return normalizeStartupAppearance(
    {
      schemaVersion: 1,
      preference: themeMode,
      resolvedMode: targetTheme.mode,
      themeId: targetTheme.name,
      palette,
    },
    targetTheme.mode,
  )
}

const cacheAppliedTheme = (
  targetTheme: MfTheme,
  themeMode: ThemeMode,
  accentColorSetting?: unknown,
) =>
  cacheStartupAppearance(createAppliedThemeAppearance(targetTheme, themeMode, accentColorSetting))

const persistAppliedTheme = (
  targetTheme: MfTheme,
  themeMode: ThemeMode,
  accentColorSetting?: unknown,
): Promise<StartupAppearancePersistence> =>
  persistStartupAppearance(createAppliedThemeAppearance(targetTheme, themeMode, accentColorSetting))

const resolveSelectedTheme = (
  state: Pick<
    ThemeStore,
    'darkThemeName' | 'lightThemeName' | 'systemTheme' | 'themeMode' | 'themes'
  >,
  selection: ThemePreviewSelection = {},
) => {
  const themeMode = selection.themeMode ?? state.themeMode
  const lightThemeName = selection.lightThemeName ?? state.lightThemeName
  const darkThemeName = selection.darkThemeName ?? state.darkThemeName
  const isDark = themeMode === 'dark' || (themeMode === 'system' && state.systemTheme === 'dark')
  const targetName = isDark ? darkThemeName : lightThemeName
  const fallbackName = isDark ? FALLBACK_DARK_THEME : FALLBACK_LIGHT_THEME

  return {
    targetTheme:
      resolveTheme(state.themes, targetName, fallbackName, isDark ? 'dark' : 'light') ??
      (isDark ? darkTheme : lightTheme),
    themeMode,
  }
}

type ThemeStore = {
  curTheme: MfTheme
  themes: MfTheme[]
  themeMode: ThemeMode
  systemTheme: SystemTheme
  lightThemeName: string
  darkThemeName: string
  setCurThemeByName: (themeName: string) => void
  getCurTheme: () => MfTheme | undefined
  insertTheme: (theme: MfTheme) => void
  deleteTheme: (themeName: string) => void
  setThemeMode: (mode: ThemeMode) => void
  setLightTheme: (themeName: string) => void
  setDarkTheme: (themeName: string) => void
  previewTheme: (selection: ThemePreviewSelection) => void
  restoreThemePreview: () => void
  setSystemTheme: (theme: SystemTheme) => void
  syncSystemTheme: () => Promise<SystemTheme>
  applyTheme: (persistAppearance?: boolean) => void
  persistCurrentAppearance: (
    accentColorSetting?: unknown,
  ) => Promise<StartupAppearancePersistence>
  commitAccentColor: (value: string) => Promise<StartupAppearancePersistence>
  fallbackStaleStartupTheme: () => MfTheme | undefined
  initFromSettings: (settingData: Record<string, any>) => Promise<void>
}

const startupAppearance = readWindowBootstrap()
const { synthetic: hasSyntheticStartupTheme, theme: startupTheme } =
  resolveStartupTheme(startupAppearance)
const initialThemes = hasSyntheticStartupTheme
  ? [...builtInThemes, startupTheme]
  : [...builtInThemes]

const useThemeStore = create<ThemeStore>((set, get) => {
  const persistSettingThenAppearance = (
    key: 'dark_theme' | 'light_theme' | 'theme_mode',
    value: string,
    afterConfigCommit?: () => Promise<unknown>,
  ) => {
    const { targetTheme, themeMode } = resolveSelectedTheme(get())
    cacheAppliedTheme(targetTheme, themeMode)

    void appSettingService
      .writeSettingData({ key }, value)
      .then(async () => {
        await afterConfigCommit?.()
        return get().persistCurrentAppearance()
      })
      // writeSettingData already logs and rolls back its optimistic settings update.
      .catch(() => undefined)
  }

  return {
    curTheme: startupTheme,
    themes: initialThemes,
    themeMode: startupAppearance.preference,
    systemTheme: startupAppearance.resolvedMode,
    lightThemeName:
      startupAppearance.resolvedMode === 'light'
        ? startupAppearance.themeId
        : FALLBACK_LIGHT_THEME,
    darkThemeName:
      startupAppearance.resolvedMode === 'dark'
        ? startupAppearance.themeId
        : FALLBACK_DARK_THEME,

    applyTheme: (persistAppearance = true) => {
      const { targetTheme, themeMode } = resolveSelectedTheme(get())

      applyThemeToDOM(targetTheme, themeMode)
      if (persistAppearance) void persistAppliedTheme(targetTheme, themeMode)

      set((prev) => ({
        ...prev,
        curTheme: targetTheme!,
      }))
    },

    persistCurrentAppearance: (accentColorSetting) => {
      const { targetTheme, themeMode } = resolveSelectedTheme(get())
      return persistAppliedTheme(targetTheme, themeMode, accentColorSetting)
    },

    commitAccentColor: async (value) => {
      const { targetTheme, themeMode } = resolveSelectedTheme(get())
      cacheAppliedTheme(targetTheme, themeMode, value)
      await appSettingService.writeSettingData({ key: 'theme_accent_color' }, value)
      return get().persistCurrentAppearance(value)
    },

    fallbackStaleStartupTheme: () => {
      if (!hasSyntheticStartupTheme) return undefined

      const nextThemes = discardStaleStartupTheme(get().themes, startupTheme)
      if (!nextThemes) return undefined

      runWithoutThemeTransitions(() => {
        set((prev) => ({ ...prev, themes: nextThemes }))
        get().applyTheme()
      })

      return startupTheme
    },

    previewTheme: (selection) => {
      const { targetTheme, themeMode } = resolveSelectedTheme(get(), selection)
      applyThemeToDOM(targetTheme, themeMode)
      set((prev) => ({ ...prev, curTheme: targetTheme }))
    },

    restoreThemePreview: () => {
      get().applyTheme()
    },

    setCurThemeByName: (themeName) => {
      const { systemTheme, themes, themeMode } = get()
      const resolvedMode = themeMode === 'system' ? systemTheme : themeMode
      const targetTheme = themes.find(
        (theme) => theme.name === themeName && theme.mode === resolvedMode,
      )

      if (targetTheme) {
        applyThemeToDOM(targetTheme, themeMode)

        // 同步更新 lightThemeName 或 darkThemeName
        const updates: Partial<ThemeStore> = {
          curTheme: targetTheme,
        }
        if (targetTheme.mode === 'light') {
          updates.lightThemeName = targetTheme.name
        } else if (targetTheme.mode === 'dark') {
          updates.darkThemeName = targetTheme.name
        }

        set((prev) => ({ ...prev, ...updates }))
        persistSettingThenAppearance(
          targetTheme.mode === 'light' ? 'light_theme' : 'dark_theme',
          targetTheme.name,
        )
      }
    },

    getCurTheme: () => {
      const { themes, curTheme } = get()
      return themes.find(
        (theme) => theme.name === curTheme.name && theme.mode === curTheme.mode,
      )
    },

    insertTheme: (targetTheme) => {
      const { themes } = get()
      const nextThemes = mergeRegisteredTheme(
        themes,
        targetTheme,
        hasSyntheticStartupTheme ? startupTheme : undefined,
      )

      if (nextThemes) {
        const { targetTheme: selectedTheme } = resolveSelectedTheme({
          ...get(),
          themes: nextThemes,
        })
        const commitThemeRegistration = () => {
          set((prev) => ({ ...prev, themes: nextThemes }))
          get().applyTheme()
        }

        if (
          selectedTheme.name === targetTheme.name &&
          selectedTheme.mode === targetTheme.mode
        ) {
          runWithoutThemeTransitions(commitThemeRegistration)
        } else {
          set((prev) => ({ ...prev, themes: nextThemes }))
        }
      }
    },

    deleteTheme: (delThemeName) => {
      const { themes, lightThemeName, darkThemeName, curTheme } = get()

      const filterThemes = themes.filter((theme) => theme.name !== delThemeName)

      let newLight = lightThemeName
      let newDark = darkThemeName
      const configWrites: Promise<void>[] = []

      // 兜底：被删除的是当前配置的亮色主题
      if (delThemeName === lightThemeName) {
        newLight = FALLBACK_LIGHT_THEME
        configWrites.push(
          appSettingService.writeSettingData(
            { key: 'light_theme' },
            FALLBACK_LIGHT_THEME,
          ),
        )
      }

      // 兜底：被删除的是当前配置的暗色主题
      if (delThemeName === darkThemeName) {
        newDark = FALLBACK_DARK_THEME
        configWrites.push(
          appSettingService.writeSettingData(
            { key: 'dark_theme' },
            FALLBACK_DARK_THEME,
          ),
        )
      }

      set((prev) => ({
        ...prev,
        themes: filterThemes,
        lightThemeName: newLight,
        darkThemeName: newDark,
      }))

      // 如果当前正在使用被删除的主题，立即切换
      if (delThemeName === curTheme.name) {
        get().applyTheme(false)
      }
      if (configWrites.length > 0) {
        void Promise.all(configWrites)
          .then(() => get().persistCurrentAppearance())
          .catch(() => undefined)
      }
    },

    setThemeMode: (mode) => {
      set((prev) => ({ ...prev, themeMode: mode }))
      get().applyTheme(false)
      persistSettingThenAppearance(
        'theme_mode',
        mode,
        mode === 'system' ? () => get().syncSystemTheme() : undefined,
      )
    },

    setLightTheme: (themeName) => {
      set((prev) => ({ ...prev, lightThemeName: themeName }))
      get().applyTheme(false)
      persistSettingThenAppearance('light_theme', themeName)
    },

    setDarkTheme: (themeName) => {
      set((prev) => ({ ...prev, darkThemeName: themeName }))
      get().applyTheme(false)
      persistSettingThenAppearance('dark_theme', themeName)
    },

    setSystemTheme: (theme) => {
      const { curTheme, systemTheme, themeMode } = get()
      if (systemTheme === theme && (themeMode !== 'system' || curTheme.mode === theme)) {
        return
      }

      set((prev) => ({ ...prev, systemTheme: theme }))
      if (get().themeMode === 'system') {
        get().applyTheme()
      }
    },

    syncSystemTheme: async () => {
      const windowTheme = get().themeMode === 'system' ? await getWindowSystemTheme() : undefined
      const nativeTheme = windowTheme || await getNativeSystemTheme()
      const nextTheme = nativeTheme || getBrowserSystemTheme()

      get().setSystemTheme(nextTheme)

      return nextTheme
    },

    initFromSettings: async (settingData) => {
      const themeMode = (settingData.theme_mode as ThemeMode) || 'system'
      const lightThemeName = (settingData.light_theme as string) || FALLBACK_LIGHT_THEME
      const darkThemeName = (settingData.dark_theme as string) || FALLBACK_DARK_THEME

      set((prev) => ({
        ...prev,
        themeMode,
        lightThemeName,
        darkThemeName,
      }))

      if (themeMode === 'system') {
        await get().syncSystemTheme()
      }
      get().applyTheme()
    },
  }
})

const syncSystemThemeIfNeeded = () => {
  if (useThemeStore.getState().themeMode === 'system') {
    void useThemeStore.getState().syncSystemTheme()
  }
}

const updateSystemTheme = (theme: unknown) => {
  const nextTheme = normalizeSystemTheme(theme)
  if (!nextTheme) {
    return
  }

  useThemeStore.getState().setSystemTheme(nextTheme)
}

const setupSystemThemeSync = () => {
  if (typeof window === 'undefined') {
    return
  }

  const themeWindow = window as ThemeSyncWindow
  if (themeWindow.__markflowyThemeSyncSetup) {
    return
  }
  themeWindow.__markflowyThemeSyncSetup = true

  syncSystemThemeIfNeeded()

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (event) => {
    updateSystemTheme(event.matches ? 'dark' : 'light')
    void useThemeStore.getState().syncSystemTheme()
  })

  try {
    void getCurrentWindow()
      .onThemeChanged(({ payload }) => {
        updateSystemTheme(payload)
        void useThemeStore.getState().syncSystemTheme()
      })
      .catch(() => undefined)
  } catch {
    // Browser preview: there is no Tauri window to subscribe to.
  }

  window.addEventListener('focus', syncSystemThemeIfNeeded)

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncSystemThemeIfNeeded()
      }
    })
  }
}

setupSystemThemeSync()

export default useThemeStore
