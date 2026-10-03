import { SemanticThemeContext, useThemeAccentPreview } from '@/themes/context'
import { desktopVariables, getThemeTokens, isSemanticTheme, legacyTokens } from '@/themes/runtime'
import { typographyOverrides } from '@/themes/preferences'
import NiceModal from '@ebay/nice-modal-react'
import isPropValid from '@emotion/is-prop-valid'
import { type desktopLightTheme } from '@markflowy/theme'
import { releaseStartupPalette } from '@/startup/appearance'
import { createContext, useContext, useLayoutEffect, useMemo } from 'react'
import { type IStyleSheetContext, StyleSheetManager, ThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { resolveUIFontFamily } from './appThemeTokens'
import { EditorThemeContext } from './editorThemeContext'
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
import useThemeStore from './stores/useThemeStore'

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

  const previewAccent = useThemeAccentPreview((state) => state.color)
  const accentSetting = previewAccent ?? settingData[THEME_ACCENT_COLOR_SETTING_KEY]
  const semanticTokens = useMemo(() => {
    return getThemeTokens(curTheme, {
      ...(!isSemanticTheme(curTheme) ? { 'font.ui.family': resolveUIFontFamily(osType) } : {}),
      ...(isThemeAccentColorOverride(accentSetting)
        ? { 'accent.background': resolveThemeAccentColor(undefined, accentSetting) }
        : {}),
      ...typographyOverrides({
        theme_use_personal_typography: settingData.theme_use_personal_typography,
        editor_root_font_family: settingData.editor_root_font_family,
        editor_code_font_family: settingData.editor_code_font_family,
        editor_root_font_size: settingData.editor_root_font_size,
        editor_root_line_height: settingData.editor_root_line_height,
        editor_source_font_size: settingData.editor_source_font_size,
        editor_source_line_height: settingData.editor_source_line_height,
      }),
    })
  }, [
    curTheme,
    osType,
    accentSetting,
    settingData.theme_use_personal_typography,
    settingData.editor_root_font_family,
    settingData.editor_code_font_family,
    settingData.editor_root_font_size,
    settingData.editor_root_line_height,
    settingData.editor_source_font_size,
    settingData.editor_source_line_height,
  ])
  const uiTheme = useMemo(
    () => legacyTokens(semanticTokens, curTheme.mode),
    [semanticTokens, curTheme.mode],
  )
  const editorTheme = useMemo(
    () => ({
      ...uiTheme,
      fontFamily: semanticTokens['font.editor.family'],
      bgColor: semanticTokens['editor.background'],
      primaryFontColor: semanticTokens['editor.foreground'],
    }),
    [uiTheme, semanticTokens],
  )

  useLayoutEffect(() => {
    const variables = desktopVariables(semanticTokens)
    const sheet = document.createElement('style')
    sheet.dataset.mfSemanticTheme = ''
    sheet.textContent = `:root {${Object.entries(variables)
      .map(([name, value]) => `${name}:${value};`)
      .join('')}}`
    document.head.insertBefore(
      sheet,
      document.getElementById('mf-markdown-theme') ?? document.getElementById('mf-local-themes'),
    )
    return () => sheet.remove()
  }, [semanticTokens])

  const themeProp = useMemo(
    () => ({ mode: curTheme.mode, token: uiTheme }),
    [curTheme.mode, uiTheme],
  )
  const editorThemeConfig = useMemo(
    () => ({
      ...themeProp,
      name: curTheme.name,
      codemirrorTheme: curTheme.codemirrorTheme,
      language: settingData.language,
    }),
    [themeProp, curTheme.name, curTheme.codemirrorTheme, settingData.language],
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
          <EditorThemeContext.Provider value={editorThemeConfig}>
            <AppEditorThemeContext.Provider value={editorTheme}>
              <InjectFonts />
              <GlobalStyles />
              <DesktopSpecificStyles
                $destructiveForeground={destructiveForeground}
                $primaryForeground={primaryForeground}
              />
              <SemanticThemeContext.Provider value={semanticTokens}>
                <NiceModal.Provider>{children}</NiceModal.Provider>
              </SemanticThemeContext.Provider>
            </AppEditorThemeContext.Provider>
          </EditorThemeContext.Provider>
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
