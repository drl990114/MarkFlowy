import NiceModal from '@ebay/nice-modal-react'
import isPropValid from '@emotion/is-prop-valid'
import { useMemo } from 'react'
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import { ThemeProvider as EditorProvider } from 'rme'
import { IStyleSheetContext, StyleSheetManager, ThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { GlobalStyles, DesktopSpecificStyles } from './globalStyles'
import { InjectFonts } from './injectFonts'
import useAppSettingStore from './stores/useAppSettingStore'
import useThemeStore from './stores/useThemeStore'

const LEGACY_DEFAULT_ROOT_FONT_FAMILY = 'Open Sans'
const LEGACY_DEFAULT_CODE_FONT_FAMILY = 'Fira Code'
const SYSTEM_DEFAULT_FONT_FAMILY = 'System Default'
const DEFAULT_MONOSPACE_FONT_FAMILY = 'Default Monospace'

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const { curTheme } = useThemeStore()
  const { settingData } = useAppSettingStore()
  const theme = curTheme?.styledConstants || {}

  const rootFontFamily =
    !settingData.editor_root_font_family ||
    settingData.editor_root_font_family === LEGACY_DEFAULT_ROOT_FONT_FAMILY ||
    settingData.editor_root_font_family === SYSTEM_DEFAULT_FONT_FAMILY
      ? curTheme.styledConstants.fontFamily
      : settingData.editor_root_font_family
  const codeFontFamily =
    !settingData.editor_code_font_family ||
    settingData.editor_code_font_family === LEGACY_DEFAULT_CODE_FONT_FAMILY ||
    settingData.editor_code_font_family === DEFAULT_MONOSPACE_FONT_FAMILY
      ? curTheme.styledConstants.codemirrorFontFamily
      : settingData.editor_code_font_family

  const themeProp = useMemo(
    () => ({
      mode: curTheme.mode,
      token: {
        ...curTheme.styledConstants,
        fontFamily: rootFontFamily,
        codemirrorFontFamily: codeFontFamily,
      },
    }),
    [curTheme.mode, curTheme.styledConstants, rootFontFamily, codeFontFamily],
  )

  const antdThemeProp = useMemo<ThemeConfig>(
    () => ({
      algorithm: curTheme.mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: curTheme.styledConstants.accentColor,
        colorInfo: curTheme.styledConstants.accentColor,
        colorSuccess: curTheme.styledConstants.successColor,
        colorError: curTheme.styledConstants.dangerColor,
        colorWarning: curTheme.styledConstants.warnColor,
        colorText: curTheme.styledConstants.primaryFontColor,
        colorTextSecondary: curTheme.styledConstants.labelFontColor,
        colorTextTertiary: curTheme.styledConstants.disabledFontColor,
        colorBgBase: curTheme.styledConstants.bgColor,
        colorBgContainer: curTheme.styledConstants.bgColor,
        colorBgElevated: curTheme.styledConstants.contextMenuBgColor,
        colorBgLayout: curTheme.styledConstants.bgColor,
        colorBorder: curTheme.styledConstants.borderColor,
        colorBorderSecondary: curTheme.styledConstants.borderColor,
        colorFillSecondary: curTheme.styledConstants.hoverColor,
        colorFillTertiary: curTheme.styledConstants.contextMenuBgColorHover,
        borderRadius: 6,
        borderRadiusLG: 8,
        fontFamily: rootFontFamily,
        fontSize: 12,
        controlHeight: 28,
        controlHeightSM: 24,
        controlHeightLG: 32,
        boxShadowSecondary: `0 10px 24px ${curTheme.styledConstants.boxShadowColor}`,
      },
      components: {
        Popover: {
          colorBgElevated: curTheme.styledConstants.contextMenuBgColor,
        },
        Tooltip: {
          colorBgSpotlight: curTheme.styledConstants.tooltipBgColor,
          colorTextLightSolid: curTheme.styledConstants.primaryFontColor,
        },
      },
    }),
    [curTheme.mode, curTheme.styledConstants, rootFontFamily],
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
