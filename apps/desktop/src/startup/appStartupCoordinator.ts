import { preloadCapricornRuntimeFactory } from '@/components/EditorArea/capricornRuntimeAdapter'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { createStartupCoordinator } from './startupCoordinator'
import type { StartupCoordinator } from './startupCoordinator'

export const CAPRICORN_STARTUP_TIMEOUT_MS = 10_000

const prepareEditorRuntime = async (): Promise<void> => {
  if (!isCapricornRuntimeAvailable) return

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      preloadCapricornRuntimeFactory(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, CAPRICORN_STARTUP_TIMEOUT_MS)
      }),
    ])
  } catch {
    // The optional runtime must not prevent startup. Editor mounts retain
    // their existing retry and error handling if preparation fails.
  } finally {
    clearTimeout(timeout)
  }
}

export function createAppStartupCoordinator<Shell, Workspace>({
  loadShell,
  loadWorkspace,
}: {
  loadShell: (signal: AbortSignal) => Promise<Shell>
  loadWorkspace: (shell: Shell, signal: AbortSignal) => Promise<Workspace>
}): StartupCoordinator<Shell, Workspace> {
  let editorRuntimeReady: Promise<void> | undefined

  return createStartupCoordinator({
    loadShell: async (signal) => {
      // Start the module import and Worker handshake alongside settings I/O.
      // The shell can render while preparation continues, but editors cannot.
      editorRuntimeReady ??= prepareEditorRuntime()
      return loadShell(signal)
    },
    loadWorkspace: async (shell, signal) => {
      const [workspace] = await Promise.allSettled([
        loadWorkspace(shell, signal),
        editorRuntimeReady,
      ])
      // Await preparation on failures too, so choosing another workspace from
      // the recovery surface cannot bypass the startup readiness boundary.
      if (workspace.status === 'rejected') throw workspace.reason
      return workspace.value
    },
  })
}
