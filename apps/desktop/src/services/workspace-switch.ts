import useLayoutStore from '@/stores/useLayoutStore'

export const OPEN_WORKSPACE_EXPLORER_EVENT = 'workspace:open-explorer'

type WorkspaceSwitchHandler = (path: string) => Promise<boolean>

let workspaceSwitchHandler: WorkspaceSwitchHandler | undefined
let workspaceSwitchQueue: Promise<void> = Promise.resolve()

export const setWorkspaceSwitchHandler = (handler?: WorkspaceSwitchHandler) => {
  workspaceSwitchHandler = handler
}

export const switchWorkspaceInCurrentWindow = async (path: string) => {
  const switchOperation = workspaceSwitchQueue.then(async () => {
    if (!workspaceSwitchHandler) {
      throw new Error('Workspace persistence is not ready')
    }

    const didSwitch = await workspaceSwitchHandler(path)
    if (didSwitch) useLayoutStore.getState().openExplorer()
    return didSwitch
  })

  workspaceSwitchQueue = switchOperation.then(
    () => undefined,
    () => undefined,
  )

  return switchOperation
}

export const waitForWorkspaceSwitches = () => workspaceSwitchQueue
