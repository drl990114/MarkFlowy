import NiceModal from '@ebay/nice-modal-react'
import isPropValid from '@emotion/is-prop-valid'
import { useMemo } from 'react'
import { ThemeProvider as EditorProvider } from 'rme'
import { IStyleSheetContext, StyleSheetManager, ThemeProvider } from 'styled-components'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { GlobalStyles, DesktopSpecificStyles } from './globalStyles'
import { InjectFonts } from './injectFonts'
import useAppSettingStore from './stores/useAppSettingStore'
import useThemeStore from './stores/useThemeStore'

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const { curTheme } = useThemeStore()
  const { settingData } = useAppSettingStore()
  const theme = curTheme?.styledConstants || {}

  const themeProp = useMemo(
    () => ({
      mode: curTheme.mode,
      token: {
        ...curTheme.styledConstants,
        fontFamily: settingData.editor_root_font_family,
        codemirrorFontFamily: settingData.editor_code_font_family,
      },
    }),
    [
      curTheme.mode,
      curTheme.styledConstants,
      settingData.editor_root_font_family,
      settingData.editor_code_font_family,
    ],
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
        <ZensThemeProvider theme={themeProp}>
          <EditorProvider theme={themeProp} i18n={i18nProp}>
            <InjectFonts />
            <GlobalStyles />
            <DesktopSpecificStyles />
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
