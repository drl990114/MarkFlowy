import { Root, Setting } from '@/router'
import { SettingRouteController } from '@/router/Setting/component/SettingRouteController'
import type { SettingRouteState } from '@/router/Setting/component/SettingRouteController'
import { appInfoStoreSetup } from '@/services/app-info'
import { Activity, useEffect } from 'react'
import { Route, Routes, useLocation, useMatch } from 'react-router'
import { Notifications } from 'zens'
import { FileTreeProvider, TauriFileSystemProvider } from './adapters'
import AppThemeProvider from './AppThemeProvider'
import { Modal } from './components'
import {
  MODAL_CONFIRM_ID,
  MODAL_IMAGE_INSERT_ID,
  MODAL_INFO_ID,
  MODAL_INPUT_ID,
} from './components/Modal'
import { ContextMenu } from './components/ui-v2/ContextMenu/ContextMenu'
import { useAppSetup } from './hooks'
import { useCommandInit } from './hooks/useCommandInit'

function AppRoutes() {
  const settingsMatch = useMatch('/settings')
  const location = useLocation()
  const routeState = location.state as SettingRouteState | null
  const navigationRequest = settingsMatch ? routeState?.navigationRequest : undefined

  return (
    <>
      <SettingRouteController />
      <Activity mode={settingsMatch ? 'hidden' : 'visible'}>
        <Root />
      </Activity>
      <Routes>
        <Route path='/' element={null} />
        <Route
          path='/settings'
          element={
            <Setting
              key={navigationRequest?.id ?? 'settings'}
              navigationRequest={navigationRequest}
            />
          }
        />
      </Routes>
    </>
  )
}

function App() {
  useAppSetup()
  useCommandInit()

  useEffect(() => {
    appInfoStoreSetup()
  }, [])

  return (
    <AppThemeProvider>
      <TauriFileSystemProvider>
        <FileTreeProvider>
          <ContextMenu />
          <Notifications />
          <Modal.InputConfirm id={MODAL_INPUT_ID} />
          <Modal.Info id={MODAL_INFO_ID} />
          <Modal.Confirm id={MODAL_CONFIRM_ID} />
          <Modal.ImageInsert id={MODAL_IMAGE_INSERT_ID} />
          <AppRoutes />
        </FileTreeProvider>
      </TauriFileSystemProvider>
    </AppThemeProvider>
  )
}

export default App
