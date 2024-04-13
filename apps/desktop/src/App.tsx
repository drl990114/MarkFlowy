import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as ZensThemeProvider, Notifications } from 'zens'
import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { GlobalStyles } from './globalStyles'
import { useAppSetup } from './hooks'
import { Root } from '@/router'
import useThemeStore from './stores/useThemeStore'
import { ContextMenu } from './components/UI/ContextMenu/ContextMenu'
import NiceModal from '@ebay/nice-modal-react'
import { InjectFonts } from './injectFonts'
import { Modal } from './components'
import { MODAL_CONFIRM_ID } from './components/Modal'
import { ThemeProvider as EditorProvider } from 'rme'
import useAppSettingStore from './stores/useAppSettingStore'
import { editorResources } from './i18n'
import { useMemo } from 'react'
import { MODAL_INPUT_ID } from './components/Modal/InputConfirm'

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
  )
}

function App() {
  useAppSetup()

  return (
    <AppThemeProvider>
      <Routes>
        <Route index path='/' element={<Root />} />
      </Routes>
      <ContextMenu />
      <Notifications />
      <Modal.Confirm id={MODAL_CONFIRM_ID} />
      <Modal.InputConfirm id={MODAL_INPUT_ID} />
    </AppThemeProvider>
  )
}

export default App
