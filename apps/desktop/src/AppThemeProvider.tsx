import { ThemeProvider as EditorProvider } from 'rme'
import useAppSettingStore from './stores/useAppSettingStore'
import { editorResources } from './i18n'
import { useMemo } from 'react'
import useThemeStore from './stores/useThemeStore'
import NiceModal from '@ebay/nice-modal-react'
import { InjectFonts } from './injectFonts'
import { GlobalStyles } from './globalStyles'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as ZensThemeProvider } from 'zens'
import { StyleSheetManager, ThemeProvider } from 'styled-components'
import isPropValid from '@emotion/is-prop-valid'

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const { muiTheme, curTheme } = useThemeStore()
  const { settingData } = useAppSettingStore()
  const theme = curTheme?.styledConstants || {}

  const themeProp = useMemo(
    () => ({
      mode: curTheme.mode,
      token: curTheme.styledConstants,
    }),
    [curTheme.mode, curTheme.styledConstants],
  )

  const i18nProp = useMemo(
    () => ({
      locales: editorResources,
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
            <NiceModal.Provider>
              <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
            </NiceModal.Provider>
          </EditorProvider>
        </ZensThemeProvider>
      </ThemeProvider>
    </StyleSheetManager>
  )
}

// This implements the default behavior from styled-components v5
function shouldForwardProp(propName: string, target: any) {
  if (typeof target === 'string') {
    // For HTML elements, forward the prop if it is a valid HTML attribute
    return isPropValid(propName)
  }
  // For other elements, forward all props
  return true
}

export default AppThemeProvider
