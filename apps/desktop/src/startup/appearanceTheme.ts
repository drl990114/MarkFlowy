import { builtInThemes, darkTheme, lightTheme, type MfTheme } from '@markflowy/theme'
import type { StartupAppearance } from './appearance'

export type StartupThemeResolution = {
  synthetic: boolean
  theme: MfTheme
}

export const mergeRegisteredTheme = (
  themes: MfTheme[],
  targetTheme: MfTheme,
  syntheticStartupTheme?: MfTheme,
): MfTheme[] | undefined => {
  const existingThemeIndex = themes.findIndex(
    (theme) => theme.name === targetTheme.name && theme.mode === targetTheme.mode,
  )

  if (existingThemeIndex === -1) return [...themes, targetTheme]
  if (themes[existingThemeIndex] !== syntheticStartupTheme) return undefined

  return themes.map((theme, index) => (index === existingThemeIndex ? targetTheme : theme))
}

export const resolveStartupTheme = (
  appearance: StartupAppearance,
): StartupThemeResolution => {
  const builtInTheme = builtInThemes.find(
    (theme) => theme.name === appearance.themeId && theme.mode === appearance.resolvedMode,
  )
  if (builtInTheme) return { synthetic: false, theme: builtInTheme }

  const fallbackTheme = appearance.resolvedMode === 'dark' ? darkTheme : lightTheme
  const { palette } = appearance

  return {
    synthetic: true,
    theme: {
      ...fallbackTheme,
      name: appearance.themeId,
      mode: appearance.resolvedMode,
      styledConstants: {
        ...fallbackTheme.styledConstants,
        accentColor: palette.accent,
        bgColor: palette.surfaceApp,
        bgColorSecondary: palette.surfacePanel,
        borderColor: palette.border,
        borderColorFocused: palette.accent,
        editorToolbarBgColor: palette.surfaceToolbar,
        fileTreeIndentLineColor: palette.border,
        labelFontColor: palette.mutedForeground,
        primaryFontColor: palette.foreground,
        rightBarBgColor: palette.surfacePanel,
        rightBarHeaderBgColor: palette.surfacePanel,
        scrollbarTrackColor: palette.surfaceApp,
        sideBarBgColor: palette.surfacePanel,
        sideBarHeaderBgColor: palette.surfacePanel,
        titleBarBgColor: palette.surfaceToolbar,
        unselectedFontColor: palette.mutedForeground,
      },
    },
  }
}
