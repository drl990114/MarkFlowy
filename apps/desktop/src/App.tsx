import { commandRegistry } from '@/commands'
import { EVENT } from '@/constants'
import { Root, Setting } from '@/router'
import { SettingRouteController } from '@/router/Setting/component/SettingRouteController'
import type { SettingRouteState } from '@/router/Setting/component/SettingRouteController'
import { appInfoStoreSetup } from '@/services/app-info'
import { markBootShellReady } from '@/startup/boot'
import { StartupProgress } from '@/startup/StartupProgress'
import type { StartupPhaseState } from '@/startup/startupCoordinator'
import {
  getStartupErrorDescription,
  WorkspaceStartupSurface,
} from '@/startup/WorkspaceStartupSurface'
import { Activity, useEffect, useLayoutEffect } from 'react'
import { Route, Routes, useLocation, useMatch } from 'react-router'
import { Notifications } from 'zens'
import { FileTreeProvider, TauriFileSystemProvider } from './adapters'
import { AppInfoDialog, Modal } from './components'
import { AsyncSurface } from './components/AsyncSurface'
import { RenderErrorBoundary } from './components/RenderErrorBoundary'
import {
  MODAL_CONFIRM_ID,
  MODAL_IMAGE_INSERT_ID,
  MODAL_INFO_ID,
  MODAL_INPUT_ID,
} from './components/Modal'
import TitleBar from './components/TitleBar'
import { TooltipProvider } from './components/ui/tooltip'
import { ContextMenu } from './components/ui-v2/ContextMenu/ContextMenu'
import { useAppRuntimeSetup, useAppSetup } from './hooks'
import { useCommandInit } from './hooks/useCommandInit'

interface AppRoutesProps {
  chooseWorkspace: () => void
  retryWorkspace: () => void
  workspace: StartupPhaseState<void>
}

function AppRoutes({ chooseWorkspace, retryWorkspace, workspace }: AppRoutesProps) {
  const settingsMatch = useMatch('/settings')
  const location = useLocation()
  const routeState = location.state as SettingRouteState | null
  const navigationRequest = settingsMatch ? routeState?.navigationRequest : undefined

  return (
    <div className='flex h-screen w-screen flex-col overflow-hidden'>
      <TitleBar />
      <div className='relative min-h-0 min-w-0 flex-1 overflow-hidden'>
        <SettingRouteController />
        <Activity mode={settingsMatch ? 'hidden' : 'visible'}>
          <RenderErrorBoundary
            fallback={({ error, reset }) => (
              <WorkspaceStartupSurface
                chooseWorkspace={chooseWorkspace}
                retry={() => {
                  reset()
                  retryWorkspace()
                }}
                state={{ status: 'error', error }}
              >
                {null}
              </WorkspaceStartupSurface>
            )}
          >
            <WorkspaceStartupSurface
              chooseWorkspace={chooseWorkspace}
              retry={retryWorkspace}
              state={workspace}
            >
              <Root />
            </WorkspaceStartupSurface>
          </RenderErrorBoundary>
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
      </div>
    </div>
  )
}

type ReadyAppProps = Omit<AppRoutesProps, 'chooseWorkspace'>

function ReadyApp({ retryWorkspace, workspace }: ReadyAppProps) {
  useAppRuntimeSetup()
  useCommandInit()

  useLayoutEffect(() => {
    markBootShellReady()
  }, [])

  useEffect(() => {
    appInfoStoreSetup()
  }, [])

  const chooseWorkspace = () => {
    void commandRegistry.execute(EVENT.app_openFolder)
  }

  return (
    <TooltipProvider>
      <TauriFileSystemProvider>
        <FileTreeProvider>
          <ContextMenu />
          <Notifications />
          <AppInfoDialog />
          <Modal.InputConfirm id={MODAL_INPUT_ID} />
          <Modal.Info id={MODAL_INFO_ID} />
          <Modal.Confirm id={MODAL_CONFIRM_ID} />
          <Modal.ImageInsert id={MODAL_IMAGE_INSERT_ID} />
          <AppRoutes
            chooseWorkspace={chooseWorkspace}
            retryWorkspace={retryWorkspace}
            workspace={workspace}
          />
        </FileTreeProvider>
      </TauriFileSystemProvider>
    </TooltipProvider>
  )
}

function StartupFailureSurface({ error, retry }: { error: unknown; retry: () => void }) {
  useLayoutEffect(() => {
    markBootShellReady()
  }, [])

  return (
    <div className='flex h-screen w-screen'>
      <AsyncSurface
        state={{
          status: 'error',
          title: 'Unable to start MarkFlowy',
          description: getStartupErrorDescription(error),
          retry,
        }}
      >
        {() => null}
      </AsyncSurface>
    </div>
  )
}

function StartupLoadingSurface() {
  return (
    <div className='flex h-screen w-screen'>
      <StartupProgress label='MarkFlowy is starting' />
    </div>
  )
}

function App() {
  const startup = useAppSetup()
  const retry = () => {
    void startup.retry()
  }

  if (startup.shell.status === 'error') {
    return <StartupFailureSurface error={startup.shell.error} retry={retry} />
  }

  if (startup.shell.status !== 'ready') {
    return <StartupLoadingSurface />
  }

  return <ReadyApp retryWorkspace={retry} workspace={startup.workspace} />
}

export default App
