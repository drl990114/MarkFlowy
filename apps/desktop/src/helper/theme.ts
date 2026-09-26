import { useThemeAccentPreview } from '@/themes/context'
import useThemeStore from '@/stores/useThemeStore'
import { darken, lighten } from '@markflowy/theme'
import Color from 'color'

export const THEME_ACCENT_COLOR_SETTING_KEY = 'theme_accent_color'
export const FOLLOW_THEME_ACCENT_COLOR = 'system'
export const DEFAULT_THEME_ACCENT_COLOR = '#1F6AE2'

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

let accentPreviewColor: string | undefined
let accentPreviewFrame: number | undefined
let accentPreviewOwner: symbol | undefined

export const getReadableForeground = (background: string, light: string, dark: string) => {
  try {
    const surface = Color(background)
    return surface.contrast(Color(light)) >= surface.contrast(Color(dark)) ? light : dark
  } catch {
    return light
  }
}

const applyAccentColorPreview = () => {
  accentPreviewFrame = undefined
  if (accentPreviewColor) useThemeAccentPreview.setState({ color: accentPreviewColor })
}

export const scheduleThemeAccentColorPreview = (value: string, owner: symbol) => {
  const color = normalizeThemeAccentColor(value)
  if (color === FOLLOW_THEME_ACCENT_COLOR || typeof window === 'undefined') return

  accentPreviewOwner = owner
  accentPreviewColor = color
  if (accentPreviewFrame !== undefined) return

  if (typeof window.requestAnimationFrame !== 'function') {
    applyAccentColorPreview()
    return
  }

  accentPreviewFrame = window.requestAnimationFrame(applyAccentColorPreview)
}

export const clearThemeAccentColorPreview = (owner: symbol) => {
  if (accentPreviewOwner !== owner) return

  accentPreviewOwner = undefined
  accentPreviewColor = undefined
  if (
    accentPreviewFrame !== undefined &&
    typeof window !== 'undefined' &&
    typeof window.cancelAnimationFrame === 'function'
  ) {
    window.cancelAnimationFrame(accentPreviewFrame)
  }
  accentPreviewFrame = undefined
  useThemeAccentPreview.setState({ color: undefined })
}

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

export const resolveThemeAccentColor = (
  themeAccentColor: string | undefined,
  settingValue: unknown,
) => {
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
