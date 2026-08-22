import NiceModal from '@ebay/nice-modal-react'
import isPropValid from '@emotion/is-prop-valid'
import { desktopDarkTheme, desktopLightTheme } from '@markflowy/theme'
import { releaseStartupPalette } from '@/startup/appearance'
import { createContext, useContext, useLayoutEffect, useMemo } from 'react'
import {
  darkTheme as defaultEditorDarkTheme,
  lightTheme as defaultEditorLightTheme,
  ThemeProvider as EditorProvider,
} from 'rme'
import { type IStyleSheetContext, StyleSheetManager, ThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { alignCodeMirrorTheme, resolveAppThemeTokens, resolveUIFontFamily } from './appThemeTokens'
import { GlobalStyles, DesktopSpecificStyles } from './globalStyles'
import {
  getReadableForeground,
  isThemeAccentColorOverride,
  resolveThemeAccentColor,
  THEME_ACCENT_COLOR_SETTING_KEY,
} from './helper/theme'
import useGlobalOSInfo from './hooks/useOSInfo'
import { InjectFonts } from './injectFonts'
import useAppSettingStore from './stores/useAppSettingStore'
import useThemeStore, {
  FALLBACK_DARK_THEME,
  FALLBACK_LIGHT_THEME,
} from './stores/useThemeStore'

type EditorThemeToken = typeof desktopLightTheme

const AppEditorThemeContext = createContext<EditorThemeToken | null>(null)

export function AppEditorThemeProvider({ children }: BaseComponentProps) {
  const editorTheme = useContext(AppEditorThemeContext)
  if (!editorTheme) return children

  return <ThemeProvider theme={editorTheme}>{children}</ThemeProvider>
}

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const curTheme = useThemeStore((state) => state.curTheme)
  const settingData = useAppSettingStore((state) => state.settingData)
  const { osType } = useGlobalOSInfo()

  const themeWithDefaults = useMemo(
    () => ({
      ...(curTheme.mode === 'dark' ? desktopDarkTheme : desktopLightTheme),
      ...curTheme.styledConstants,
      fontFamily: resolveUIFontFamily(osType),
    }),
    [curTheme.mode, curTheme.styledConstants, osType],
  )

  const accentColorSetting = settingData[THEME_ACCENT_COLOR_SETTING_KEY]
  const hasAccentColorOverride = isThemeAccentColorOverride(accentColorSetting)
  const accentColor = resolveThemeAccentColor(themeWithDefaults.accentColor, accentColorSetting)
  const { editorTheme, uiTheme } = useMemo(
    () =>
      resolveAppThemeTokens({
        accentColor,
        fontSettings: {
          editorCodeFontFamily: settingData.editor_code_font_family,
          editorRootFontFamily: settingData.editor_root_font_family,
        },
        hasAccentColorOverride,
        mode: curTheme.mode,
        theme: themeWithDefaults,
      }),
    [
      accentColor,
      hasAccentColorOverride,
      curTheme.mode,
      settingData.editor_code_font_family,
      settingData.editor_root_font_family,
      themeWithDefaults,
    ],
  )

  const themeProp = useMemo(
    () => {
      const isDefaultMarkflowyTheme =
        curTheme.name === FALLBACK_LIGHT_THEME || curTheme.name === FALLBACK_DARK_THEME
      const baseCodeMirrorTheme =
        curTheme.mode === 'dark'
          ? defaultEditorDarkTheme.codemirrorTheme
          : defaultEditorLightTheme.codemirrorTheme
      const codemirrorTheme =
        curTheme.codemirrorTheme ??
        (isDefaultMarkflowyTheme
          ? alignCodeMirrorTheme({
              baseTheme: baseCodeMirrorTheme,
              mode: curTheme.mode,
              theme: uiTheme,
            })
          : undefined)

      return {
        codemirrorTheme,
        mode: curTheme.mode,
        token: uiTheme,
      }
    },
    [curTheme.codemirrorTheme, curTheme.mode, curTheme.name, uiTheme],
  )

  const i18nProp = useMemo(
    () => ({
      language: settingData.language,
    }),
    [settingData.language],
  )

  const primaryForeground = useMemo(
    () => getReadableForeground(uiTheme.accentColor, '#ffffff', '#111111'),
    [uiTheme.accentColor],
  )
  const destructiveForeground = useMemo(
    () => getReadableForeground(uiTheme.dangerColor, '#ffffff', '#111111'),
    [uiTheme.dangerColor],
  )

  useLayoutEffect(() => {
    releaseStartupPalette()
  }, [])

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <ThemeProvider theme={uiTheme}>
        <ZensThemeProvider theme={themeProp}>
          <EditorProvider theme={themeProp} i18n={i18nProp}>
            <AppEditorThemeContext.Provider value={editorTheme}>
              <InjectFonts />
              <GlobalStyles />
              <DesktopSpecificStyles
                $destructiveForeground={destructiveForeground}
                $primaryForeground={primaryForeground}
              />
              <NiceModal.Provider>{children}</NiceModal.Provider>
            </AppEditorThemeContext.Provider>
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
