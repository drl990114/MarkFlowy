import { Root } from '@/router'
import { Route, Routes } from 'react-router'
import { Notifications } from 'zens'
import AppThemeProvider from './AppThemeProvider'
import { Modal } from './components'
import { MODAL_CONFIRM_ID, MODAL_INFO_ID, MODAL_INPUT_ID } from './components/Modal'
import { ContextMenu } from './components/UI/ContextMenu/ContextMenu'
import { useAppSetup } from './hooks'

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
      <Modal.Info id={MODAL_INFO_ID} />
    </AppThemeProvider>
  )
}

export default App
