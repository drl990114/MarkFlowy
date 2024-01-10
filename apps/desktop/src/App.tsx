import { BaseStyle } from '@markflowy/theme'
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

const AppThemeProvider: React.FC<BaseComponentProps> = function ({ children }) {
  const { muiTheme, curTheme } = useThemeStore()

  return (
    <StyleSheetManager shouldForwardProp={isPropValid}>
      <MfThemeProvider theme={curTheme?.styledContants || {}}>
        <ThemeProvider theme={curTheme?.styledContants || {}}>
          <BaseStyle theme={curTheme?.styledContants} />
          <GlobalStyles />
          <NiceModal.Provider>
            <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
          </NiceModal.Provider>
        </ThemeProvider>
      </MfThemeProvider>
    </StyleSheetManager>
  )
}

function App () {
  useAppSetup()

  return (
    <AppThemeProvider>
      <Routes>
        <Route index path='/' element={<Root />} />
      </Routes>
      <ContextMenu />
      <Notifications />
    </AppThemeProvider>
  )
}

export default App
