import NiceModal from '@ebay/nice-modal-react'
import isPropValid from '@emotion/is-prop-valid'
import { desktopDarkTheme, desktopLightTheme } from '@markflowy/theme'
import { createContext, useContext, useEffect, useMemo } from 'react'
import { ThemeProvider as EditorProvider } from 'rme'
import { type IStyleSheetContext, StyleSheetManager, ThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { resolveAppThemeTokens } from './appThemeTokens'
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

type EditorThemeToken = typeof desktopLightTheme

const AppEditorThemeContext = createContext<EditorThemeToken | null>(null)

export function AppEditorThemeProvider({ children }: BaseComponentProps) {
  const editorTheme = useContext(AppEditorThemeContext)
  if (!editorTheme) return children

  return <ThemeProvider theme={editorTheme}>{children}</ThemeProvider>
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
        theme: themeWithDefaults,
      }),
    [
      accentColor,
      hasAccentColorOverride,
      settingData.editor_code_font_family,
      settingData.editor_root_font_family,
      themeWithDefaults,
    ],
  )

  const themeProp = useMemo(
    () => ({
      mode: curTheme.mode,
      token: uiTheme,
    }),
    [curTheme.mode, uiTheme],
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
