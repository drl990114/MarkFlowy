import NiceModal from '@ebay/nice-modal-react'
import isPropValid from '@emotion/is-prop-valid'
import { desktopDarkTheme, desktopLightTheme } from '@markflowy/theme'
import { useEffect, useMemo } from 'react'
import { ThemeProvider as EditorProvider } from 'rme'
import { type IStyleSheetContext, StyleSheetManager, ThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { GlobalStyles, DesktopSpecificStyles } from './globalStyles'
import {
  getReadableForeground,
  isThemeAccentColorOverride,
  resolveThemeAccentColor,
  THEME_ACCENT_COLOR_SETTING_KEY,
} from './helper/theme'
import { InjectFonts } from './injectFonts'
import useAppSettingStore from './stores/useAppSettingStore'
import useThemeStore from './stores/useThemeStore'

const LEGACY_DEFAULT_ROOT_FONT_FAMILY = 'Open Sans'
const LEGACY_DEFAULT_CODE_FONT_FAMILY = 'Fira Code'
const SYSTEM_DEFAULT_FONT_FAMILY = 'System Default'
const DEFAULT_MONOSPACE_FONT_FAMILY = 'Default Monospace'

function normalizeFontFamily(fontFamily: string): string {
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

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const { curTheme } = useThemeStore()
  const { settingData } = useAppSettingStore()

  const themeWithDefaults = useMemo(
    () => ({
      ...(curTheme.mode === 'dark' ? desktopDarkTheme : desktopLightTheme),
      ...curTheme.styledConstants,
    }),
    [curTheme.mode, curTheme.styledConstants],
  )

  const rootFontFamily =
    !settingData.editor_root_font_family ||
    settingData.editor_root_font_family === LEGACY_DEFAULT_ROOT_FONT_FAMILY ||
    settingData.editor_root_font_family === SYSTEM_DEFAULT_FONT_FAMILY
      ? themeWithDefaults.fontFamily
      : normalizeFontFamily(settingData.editor_root_font_family)
  const codeFontFamily =
    !settingData.editor_code_font_family ||
    settingData.editor_code_font_family === LEGACY_DEFAULT_CODE_FONT_FAMILY ||
    settingData.editor_code_font_family === DEFAULT_MONOSPACE_FONT_FAMILY
      ? themeWithDefaults.codemirrorFontFamily
      : normalizeFontFamily(settingData.editor_code_font_family)

  const accentColorSetting = settingData[THEME_ACCENT_COLOR_SETTING_KEY]
  const hasAccentColorOverride = isThemeAccentColorOverride(accentColorSetting)
  const accentColor = resolveThemeAccentColor(themeWithDefaults.accentColor, accentColorSetting)
  const theme = useMemo(
    () => ({
      ...themeWithDefaults,
      accentColor,
      accentColorFocused: hasAccentColorOverride
        ? `${accentColor}18`
        : themeWithDefaults.accentColorFocused,
      fontFamily: rootFontFamily,
      codemirrorFontFamily: codeFontFamily,
    }),
    [themeWithDefaults, accentColor, hasAccentColorOverride, rootFontFamily, codeFontFamily],
  )

  const themeProp = useMemo(
    () => ({
      mode: curTheme.mode,
      token: theme,
    }),
    [curTheme.mode, theme],
  )

  const i18nProp = useMemo(
    () => ({
      language: settingData.language,
    }),
    [settingData.language],
  )

  const primaryForeground = useMemo(
    () => getReadableForeground(theme.accentColor, '#ffffff', '#111111'),
    [theme.accentColor],
  )
  const destructiveForeground = useMemo(
    () => getReadableForeground(theme.dangerColor, '#ffffff', '#111111'),
    [theme.dangerColor],
  )

  useEffect(() => {
    const root = document.documentElement
    const previousTheme = root.dataset.mfTheme
    root.dataset.mfTheme = curTheme.mode

    return () => {
      if (previousTheme === undefined) delete root.dataset.mfTheme
      else root.dataset.mfTheme = previousTheme
    }
  }, [curTheme.mode])

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <ThemeProvider theme={theme}>
        <ZensThemeProvider theme={themeProp}>
          <EditorProvider theme={themeProp} i18n={i18nProp}>
            <InjectFonts />
            <GlobalStyles />
            <DesktopSpecificStyles
              $destructiveForeground={destructiveForeground}
              $primaryForeground={primaryForeground}
            />
            <NiceModal.Provider>{children}</NiceModal.Provider>
          </EditorProvider>
        </ZensThemeProvider>
      </ThemeProvider>
    </StyleSheetManager>
  )
}

const shouldForwardProp: IStyleSheetContext['shouldForwardProp'] = function (propName, target) {
  if (typeof target === 'string') {
    return isPropValid(propName)
  }
  return true
}

export default AppThemeProvider
