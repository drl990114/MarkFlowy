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

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const { muiTheme, curTheme } = useThemeStore()

  const theme = curTheme?.styledConstants || {}

  return (
      <ThemeProvider theme={theme}>
        <ZensThemeProvider
          theme={{
            mode: curTheme.mode,
          }}
        >
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
    </AppThemeProvider>
  )
}

export default App
