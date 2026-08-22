export type StartupPhaseState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown }

export interface StartupSnapshot<Shell, Workspace> {
  readonly attempt: number
  readonly shell: StartupPhaseState<Shell>
  readonly workspace: StartupPhaseState<Workspace>
}

export interface StartupCoordinator<Shell, Workspace> {
  cancel: () => void
  getSnapshot: () => StartupSnapshot<Shell, Workspace>
  recoverWorkspace: (workspace: Workspace) => boolean
  retry: () => Promise<void>
  start: () => Promise<void>
  subscribe: (listener: () => void) => () => void
}

interface StartupCoordinatorOptions<Shell, Workspace> {
  loadShell: (signal: AbortSignal) => Promise<Shell>
  loadWorkspace: (shell: Shell, signal: AbortSignal) => Promise<Workspace>
}

interface ActiveRun {
  controller: AbortController
  id: number
  promise: Promise<void>
}

export const STARTUP_PERFORMANCE_MARKS = {
  reactStart: 'mf:startup:react-start',
  shellDataReady: 'mf:startup:shell-data-ready',
  workspaceReady: 'mf:startup:workspace-ready',
} as const

const markPerformance = (name: string) => {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return

  try {
    performance.mark(name)
  } catch {
    // Startup diagnostics must never become a startup dependency.
  }
}

export function createStartupCoordinator<Shell, Workspace>({
  loadShell,
  loadWorkspace,
}: StartupCoordinatorOptions<Shell, Workspace>): StartupCoordinator<Shell, Workspace> {
  let nextRunId = 0
  let activeRun: ActiveRun | undefined
  let snapshot: StartupSnapshot<Shell, Workspace> = {
    attempt: 0,
    shell: { status: 'idle' },
    workspace: { status: 'idle' },
  }
  const listeners = new Set<() => void>()

  const publish = (nextSnapshot: StartupSnapshot<Shell, Workspace>) => {
    snapshot = nextSnapshot
    listeners.forEach((listener) => listener())
  }

  const isCurrentRun = (id: number, signal: AbortSignal) => {
    return activeRun?.id === id && !signal.aborted
  }

  const launch = (
    run: (id: number, signal: AbortSignal) => Promise<void>,
  ): Promise<void> => {
    const id = ++nextRunId
    const controller = new AbortController()
    let resolveRun!: () => void
    let rejectRun!: (error: unknown) => void
    const execution = new Promise<void>((resolve, reject) => {
      resolveRun = resolve
      rejectRun = reject
    })
    const promise = execution.finally(() => {
      if (activeRun?.id === id) activeRun = undefined
    })

    activeRun = { controller, id, promise }
    try {
      void run(id, controller.signal).then(resolveRun, rejectRun)
    } catch (error) {
      rejectRun(error)
    }
    return promise
  }

  const runWorkspace = async (id: number, signal: AbortSignal, shell: Shell) => {
    publish({
      ...snapshot,
      workspace: { status: 'loading' },
    })

    try {
      const workspace = await loadWorkspace(shell, signal)
      if (!isCurrentRun(id, signal)) return

      markPerformance(STARTUP_PERFORMANCE_MARKS.workspaceReady)
      publish({
        ...snapshot,
        workspace: { status: 'ready', data: workspace },
      })
    } catch (error) {
      if (!isCurrentRun(id, signal)) return

      publish({
        ...snapshot,
        workspace: { status: 'error', error },
      })
    }
  }

  const startFullRun = () => {
    markPerformance(STARTUP_PERFORMANCE_MARKS.reactStart)
    const attempt = snapshot.attempt + 1
    publish({
      attempt,
      shell: { status: 'loading' },
      workspace: { status: 'idle' },
    })

    return launch(async (id, signal) => {
      try {
        const shell = await loadShell(signal)
        if (!isCurrentRun(id, signal)) return

        markPerformance(STARTUP_PERFORMANCE_MARKS.shellDataReady)
        publish({
          attempt,
          shell: { status: 'ready', data: shell },
          workspace: { status: 'idle' },
        })
        await runWorkspace(id, signal, shell)
      } catch (error) {
        if (!isCurrentRun(id, signal)) return

        publish({
          attempt,
          shell: { status: 'error', error },
          workspace: { status: 'idle' },
        })
      }
    })
  }

  const startWorkspaceRun = (shell: Shell) => {
    return launch((id, signal) => runWorkspace(id, signal, shell))
  }

  const start = () => {
    if (activeRun) return activeRun.promise

    if (snapshot.shell.status === 'error') return Promise.resolve()

    if (snapshot.shell.status === 'ready') {
      if (snapshot.workspace.status === 'ready' || snapshot.workspace.status === 'error') {
        return Promise.resolve()
      }
      return startWorkspaceRun(snapshot.shell.data)
    }

    return startFullRun()
  }

  const retry = () => {
    if (activeRun) return activeRun.promise

    if (snapshot.shell.status === 'ready') {
      return startWorkspaceRun(snapshot.shell.data)
    }

    return startFullRun()
  }

  const cancel = () => {
    const run = activeRun
    if (!run) return

    activeRun = undefined
    run.controller.abort()

    if (snapshot.shell.status === 'ready') {
      publish({
        ...snapshot,
        workspace: { status: 'idle' },
      })
      return
    }

    publish({
      ...snapshot,
      shell: { status: 'idle' },
      workspace: { status: 'idle' },
    })
  }

  const recoverWorkspace = (workspace: Workspace) => {
    if (snapshot.shell.status !== 'ready' || snapshot.workspace.status !== 'error') {
      return false
    }

    markPerformance(STARTUP_PERFORMANCE_MARKS.workspaceReady)
    publish({
      ...snapshot,
      workspace: { status: 'ready', data: workspace },
    })
    return true
  }

  return {
    cancel,
    getSnapshot: () => snapshot,
    recoverWorkspace,
    retry,
    start,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
