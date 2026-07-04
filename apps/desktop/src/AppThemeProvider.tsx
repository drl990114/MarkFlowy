import NiceModal from '@ebay/nice-modal-react'
import isPropValid from '@emotion/is-prop-valid'
import { useMemo } from 'react'
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import { ThemeProvider as EditorProvider } from 'rme'
import { IStyleSheetContext, StyleSheetManager, ThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { GlobalStyles, DesktopSpecificStyles } from './globalStyles'
import {
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

  const rootFontFamily =
    !settingData.editor_root_font_family ||
    settingData.editor_root_font_family === LEGACY_DEFAULT_ROOT_FONT_FAMILY ||
    settingData.editor_root_font_family === SYSTEM_DEFAULT_FONT_FAMILY
      ? curTheme.styledConstants.fontFamily
      : normalizeFontFamily(settingData.editor_root_font_family)
  const codeFontFamily =
    !settingData.editor_code_font_family ||
    settingData.editor_code_font_family === LEGACY_DEFAULT_CODE_FONT_FAMILY ||
    settingData.editor_code_font_family === DEFAULT_MONOSPACE_FONT_FAMILY
      ? curTheme.styledConstants.codemirrorFontFamily
      : normalizeFontFamily(settingData.editor_code_font_family)

  const accentColorSetting = settingData[THEME_ACCENT_COLOR_SETTING_KEY]
  const hasAccentColorOverride = isThemeAccentColorOverride(accentColorSetting)
  const accentColor = resolveThemeAccentColor(curTheme.styledConstants.accentColor, accentColorSetting)
  const theme = useMemo(
    () => ({
      ...curTheme.styledConstants,
      accentColor,
      accentColorFocused: hasAccentColorOverride
        ? `${accentColor}18`
        : curTheme.styledConstants.accentColorFocused,
      fontFamily: rootFontFamily,
      codemirrorFontFamily: codeFontFamily,
    }),
    [curTheme.styledConstants, accentColor, hasAccentColorOverride, rootFontFamily, codeFontFamily],
  )

  const themeProp = useMemo(
    () => ({
      mode: curTheme.mode,
      token: theme,
    }),
    [curTheme.mode, theme],
  )

  const antdThemeProp = useMemo<ThemeConfig>(
    () => ({
      algorithm: curTheme.mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: theme.accentColor,
        colorInfo: theme.accentColor,
        colorSuccess: theme.successColor,
        colorError: theme.dangerColor,
        colorWarning: theme.warnColor,
        colorText: theme.primaryFontColor,
        colorTextSecondary: theme.labelFontColor,
        colorTextTertiary: theme.disabledFontColor,
        colorBgBase: theme.bgColor,
        colorBgContainer: theme.bgColor,
        colorBgElevated: theme.contextMenuBgColor,
        colorBgLayout: theme.bgColor,
        colorBorder: theme.borderColor,
        colorBorderSecondary: theme.borderColor,
        colorFillSecondary: theme.hoverColor,
        colorFillTertiary: theme.contextMenuBgColorHover,
        borderRadius: 6,
        borderRadiusLG: 8,
        fontFamily: rootFontFamily,
        fontSize: 12,
        controlHeight: 28,
        controlHeightSM: 24,
        controlHeightLG: 32,
        boxShadowSecondary: `0 10px 24px ${theme.boxShadowColor}`,
      },
      components: {
        Popover: {
          colorBgElevated: theme.contextMenuBgColor,
        },
        Tooltip: {
          colorBgSpotlight: theme.tooltipBgColor,
          colorTextLightSolid: theme.primaryFontColor,
        },
      },
    }),
    [curTheme.mode, theme, rootFontFamily],
  )

  const i18nProp = useMemo(
    () => ({
      language: settingData.language,
    }),
    [settingData.language],
  )

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <ThemeProvider theme={theme}>
        <ConfigProvider theme={antdThemeProp}>
          <ZensThemeProvider theme={themeProp}>
            <EditorProvider theme={themeProp} i18n={i18nProp}>
              <InjectFonts />
              <GlobalStyles />
              <DesktopSpecificStyles />
              <NiceModal.Provider>{children}</NiceModal.Provider>
            </EditorProvider>
          </ZensThemeProvider>
        </ConfigProvider>
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
