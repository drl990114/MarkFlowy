import { resolveAccentSoftColor } from '@/appThemeTokens'
import useThemeStore from '@/stores/useThemeStore'
import { darken, lighten } from '@markflowy/theme'
import Color from 'color'

export const THEME_ACCENT_COLOR_SETTING_KEY = 'theme_accent_color'
export const FOLLOW_THEME_ACCENT_COLOR = 'system'
export const DEFAULT_THEME_ACCENT_COLOR = '#1F6AE2'

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const ACCENT_PREVIEW_STYLE_ID = 'mf-accent-color-preview'

let accentPreviewColor: string | undefined
let accentPreviewFrame: number | undefined
let accentPreviewOwner: symbol | undefined
let accentPreviewRule: CSSStyleRule | undefined

export const getReadableForeground = (background: string, light: string, dark: string) => {
  try {
    const surface = Color(background)
    return surface.contrast(Color(light)) >= surface.contrast(Color(dark)) ? light : dark
  } catch {
    return light
  }
}

const getAccentPreviewRule = () => {
  if (accentPreviewRule?.parentStyleSheet) return accentPreviewRule
  if (typeof document === 'undefined') return undefined

  let styleElement = document.getElementById(ACCENT_PREVIEW_STYLE_ID) as HTMLStyleElement | null
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = ACCENT_PREVIEW_STYLE_ID
    styleElement.textContent = ':root {}'
    document.head.appendChild(styleElement)
  }

  const rule = styleElement.sheet?.cssRules.item(0)
  accentPreviewRule =
    typeof CSSStyleRule !== 'undefined' && rule instanceof CSSStyleRule ? rule : undefined
  return accentPreviewRule
}

const applyAccentColorPreview = () => {
  accentPreviewFrame = undefined
  if (!accentPreviewColor) return

  const rule = getAccentPreviewRule()
  if (!rule) return

  const { curTheme } = useThemeStore.getState()

  rule.style.setProperty('--mf-primary', accentPreviewColor)
  rule.style.setProperty(
    '--mf-primary-foreground',
    getReadableForeground(accentPreviewColor, '#ffffff', '#111111'),
  )
  rule.style.setProperty(
    '--mf-primary-soft',
    resolveAccentSoftColor({
      accentColor: accentPreviewColor,
      mode: curTheme.mode,
      themeAccentColor: curTheme.styledConstants.accentColor,
      themeAccentColorFocused: curTheme.styledConstants.accentColorFocused,
    }),
  )
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
  accentPreviewRule = undefined

  if (typeof document !== 'undefined') {
    document.getElementById(ACCENT_PREVIEW_STYLE_ID)?.remove()
  }
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
