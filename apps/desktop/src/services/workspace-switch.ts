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

    return workspaceSwitchHandler(path)
  })

  workspaceSwitchQueue = switchOperation.then(
    () => undefined,
    () => undefined,
  )

  return switchOperation
}

export const waitForWorkspaceSwitches = () => workspaceSwitchQueue
