import { Root } from '@/router'
import React from 'react'
import { Route, Routes } from 'react-router'
import { Notifications } from 'zens'
import AppThemeProvider from './AppThemeProvider'
import { Modal } from './components'
import { MODAL_CONFIRM_ID, MODAL_INFO_ID, MODAL_INPUT_ID } from './components/Modal'
import { ContextMenu } from './components/ui-v2/ContextMenu/ContextMenu'
import { useAppSetup } from './hooks'

console.log('React Version:', React.version)

function App() {
  useAppSetup()

  return (
    <AppThemeProvider>
      <ContextMenu />
      <Notifications />
      <Modal.InputConfirm id={MODAL_INPUT_ID} />
      <Modal.Info id={MODAL_INFO_ID} />
      <Modal.Confirm id={MODAL_CONFIRM_ID} />
      <Routes>
        <Route index path='/' element={<Root />} />
      </Routes>
    </AppThemeProvider>
  )
}

export default App
