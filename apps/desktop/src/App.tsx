import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as MfThemeProvider, Notifications } from '@markflowy/components'
import { Route, Routes } from 'react-router-dom'
import { ThemeProvider, StyleSheetManager } from 'styled-components'
import { GlobalStyles } from './globalStyles'
import { useAppSetup } from './hooks'
import { Root } from '@/router'
import isPropValid from '@emotion/is-prop-valid'
import useThemeStore from './stores/useThemeStore'
import { ContextMenu } from './components/UI/ContextMenu/ContextMenu'
import NiceModal from '@ebay/nice-modal-react'
import { InjectFonts } from './injectFonts'
import { Modal } from './components'
import { MODAL_CONFIRM_ID } from './components/Modal'
import { ThemeProvider as EditorProvider } from 'rme'

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const { muiTheme, curTheme } = useThemeStore()

  const theme = curTheme?.styledConstants || {}
  return (
    <StyleSheetManager shouldForwardProp={isPropValid}>
      <MfThemeProvider theme={theme}>
        <ThemeProvider theme={theme}>
          <EditorProvider
            theme={{
              mode: curTheme.mode,
            }}
          >
            <InjectFonts />
            <GlobalStyles />
            <NiceModal.Provider>
              <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
            </NiceModal.Provider>
          </EditorProvider>
        </ThemeProvider>
      </MfThemeProvider>
    </StyleSheetManager>
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
    </AppThemeProvider>
  )
}

export default App
