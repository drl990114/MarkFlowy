import Color from 'color'
import type { CreateThemeOptions } from 'rme'

const LEGACY_DEFAULT_ROOT_FONT_FAMILY = 'Open Sans'
const LEGACY_DEFAULT_CODE_FONT_FAMILY = 'Fira Code'
const SYSTEM_DEFAULT_FONT_FAMILY = 'System Default'
const DEFAULT_MONOSPACE_FONT_FAMILY = 'Default Monospace'

interface AppThemeFontSettings {
  editorCodeFontFamily?: string
  editorRootFontFamily?: string
}

interface AppThemeTokenShape {
  accentColor: string
  accentColorFocused: string
  codemirrorFontFamily: string
  fontFamily: string
}

interface ResolveAppThemeTokensOptions<T extends AppThemeTokenShape> {
  accentColor: string
  fontSettings: AppThemeFontSettings
  hasAccentColorOverride: boolean
  mode: 'dark' | 'light'
  theme: T
}

interface CodeMirrorPalette {
  accentColorFocused: string
  bgColor: string
  labelFontColor: string
  primaryFontColor: string
  statusBarBgColor: string
}

export function alignCodeMirrorTheme({
  baseTheme,
  mode,
  theme,
}: {
  baseTheme: CreateThemeOptions
  mode: 'dark' | 'light'
  theme: CodeMirrorPalette
}): CreateThemeOptions {
  const foreground = mode === 'dark' ? '#DDDDDD' : theme.primaryFontColor

  return {
    ...baseTheme,
    settings: {
      ...baseTheme.settings,
      background: theme.bgColor,
      caret: foreground,
      foreground,
      gutterBackground: theme.bgColor,
      gutterForeground: theme.labelFontColor,
      lineHighlight: mode === 'dark' ? theme.statusBarBgColor : '#F0F0F0',
      selection: theme.accentColorFocused,
    },
  }
}

export function resolveAccentSoftColor({
  accentColor,
  mode,
  themeAccentColor,
  themeAccentColorFocused,
}: {
  accentColor: string
  mode: 'dark' | 'light'
  themeAccentColor?: string
  themeAccentColorFocused?: string
}): string {
  if (
    themeAccentColorFocused &&
    accentColor.trim().toLowerCase() === themeAccentColor?.trim().toLowerCase()
  ) {
    return themeAccentColorFocused
  }

  try {
    return Color(accentColor)
      .alpha(mode === 'dark' ? 0.18 : 0.24)
      .rgb()
      .string()
  } catch {
    return accentColor
  }
}

export function normalizeFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim()
  if (!trimmed || /^['"].*['"]$/.test(trimmed)) return trimmed

  // CSS font-family names that are not valid identifiers (e.g. contain spaces)
  // must be quoted, otherwise the declaration is invalid and the font won't apply.
  const isValidCssIdentifier =
    /^[a-zA-Z0-9\-_\u0080-\uFFFF]+$/.test(trimmed) &&
    !/^\d/.test(trimmed) &&
    !/^-\d/.test(trimmed)
  if (isValidCssIdentifier) return trimmed

  return `"${trimmed.replace(/"/g, '\\"')}"`
}

function resolveFontFamily(
  configuredValue: string | undefined,
  fallback: string,
  defaultValues: readonly string[],
): string {
  if (!configuredValue || defaultValues.includes(configuredValue)) return fallback
  return normalizeFontFamily(configuredValue)
}

export function resolveAppThemeTokens<T extends AppThemeTokenShape>({
  accentColor,
  fontSettings,
  hasAccentColorOverride,
  mode,
  theme,
}: ResolveAppThemeTokensOptions<T>) {
  const uiTheme = {
    ...theme,
    accentColor,
    accentColorFocused: hasAccentColorOverride
      ? resolveAccentSoftColor({
          accentColor,
          mode,
          themeAccentColor: theme.accentColor,
          themeAccentColorFocused: theme.accentColorFocused,
        })
      : theme.accentColorFocused,
  }
  const editorTheme = {
    ...uiTheme,
    fontFamily: resolveFontFamily(
      fontSettings.editorRootFontFamily,
      uiTheme.fontFamily,
      [LEGACY_DEFAULT_ROOT_FONT_FAMILY, SYSTEM_DEFAULT_FONT_FAMILY],
    ),
    codemirrorFontFamily: resolveFontFamily(
      fontSettings.editorCodeFontFamily,
      uiTheme.codemirrorFontFamily,
      [LEGACY_DEFAULT_CODE_FONT_FAMILY, DEFAULT_MONOSPACE_FONT_FAMILY],
    ),
  }

  return { editorTheme, uiTheme }
}
