import useThemeStore from '@/stores/useThemeStore'
import { darken, lighten } from '@markflowy/theme'

export const THEME_ACCENT_COLOR_SETTING_KEY = 'theme_accent_color'
export const FOLLOW_THEME_ACCENT_COLOR = 'system'
export const DEFAULT_THEME_ACCENT_COLOR = '#0369a1'

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export const normalizeThemeAccentColor = (value: unknown) => {
  if (typeof value !== 'string') {
    return FOLLOW_THEME_ACCENT_COLOR
  }

  const color = value.trim()

  if (!HEX_COLOR_RE.test(color)) {
    return FOLLOW_THEME_ACCENT_COLOR
  }

  if (color.length === 4) {
    const [, r, g, b] = color
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  return color.toLowerCase()
}

export const isThemeAccentColorOverride = (value: unknown) => {
  return normalizeThemeAccentColor(value) !== FOLLOW_THEME_ACCENT_COLOR
}

export const resolveThemeAccentColor = (themeAccentColor: string | undefined, settingValue: unknown) => {
  const normalizedColor = normalizeThemeAccentColor(settingValue)

  if (normalizedColor === FOLLOW_THEME_ACCENT_COLOR) {
    return themeAccentColor || DEFAULT_THEME_ACCENT_COLOR
  }

  return normalizedColor
}

export const colorAdaptiveChange = (
  color: string,
  lightenAmount: number,
  darkenAmount: number,
  options?: {
    opposite?: boolean
  },
) => {
  const themeStore = useThemeStore.getState()

  if (options?.opposite) {
    if (themeStore.curTheme.mode === 'dark') {
      return lighten(color, lightenAmount)
    } else {
      return darken(color, darkenAmount)
    }
  } else {
    if (themeStore.curTheme.mode === 'dark') {
      return darken(color, darkenAmount)
    } else {
      return lighten(color, lightenAmount)
    }
  }
}
