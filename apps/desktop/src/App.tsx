import { Notifications } from 'zens'
import { Route, Routes } from 'react-router-dom'
import { useAppSetup } from './hooks'
import { Root } from '@/router'
import { ContextMenu } from './components/UI/ContextMenu/ContextMenu'
import { Modal } from './components'
import { MODAL_CONFIRM_ID, MODAL_INPUT_ID } from './components/Modal'
import AppThemeProvider from './AppThemeProvider'

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
