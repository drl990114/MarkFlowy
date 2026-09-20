import { runHistoryCli } from './history-cli'
import { commandRegistry } from '@/commands'
import { editorAutomationRegistry } from '@/components/EditorArea/editorAutomationRegistry'
import { handleExternalWatchEvent } from '@/components/EditorArea/externalFileChanges'
import { getFileIdsByPathIdentity, getFileObject } from '@/helper/files'
import { getFileNameFromPath } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { useEditorStore, useEditorStateStore } from '@/stores'
import useExternalFileChangeStore from '@/stores/useExternalFileChangeStore'
import { invoke } from '@tauri-apps/api/core'
import { addExistingMarkdownFileEdit } from './editor-file'
import { currentWindow } from './windows'
import { switchWorkspaceInCurrentWindow } from './workspace-switch'
import {
  checkCliDeadline,
  CliError,
  cliReceipt,
  contentSha256,
  waitForCliFile,
  type CliFileState,
  type CliRequest,
} from './cliProtocol'

async function findOpenFile(path: string): Promise<string | undefined> {
  const opened = useEditorStore.getState().opened
  const direct = getFileIdsByPathIdentity(path).find((id) => opened.includes(id))
  if (direct) return direct
  for (const id of opened) {
    const file = getFileObject(id)
    if (
      file?.path &&
      (await invoke<boolean>('paths_refer_to_same_file', { path1: path, path2: file.path }))
    )
      return id
  }
}

async function inspectFile(request: CliRequest, fileId: string | undefined): Promise<CliFileState> {
  const open = !!fileId && useEditorStore.getState().opened.includes(fileId)
  const handle = open ? editorAutomationRegistry.get(fileId!) : undefined
  const live = handle?.inspect()
  const state: CliFileState = {
    path: request.path!,
    windowId: currentWindow.label,
    fileId,
    open,
    active: live?.active ?? false,
    visible: live?.visible ?? false,
    ready: live?.ready ?? false,
    mode: live?.mode,
    error: live?.error,
    dirty: !!fileId && !!useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges,
    conflict:
      !!fileId && useExternalFileChangeStore.getState().notices[fileId]?.kind === 'conflict',
    expectedSha256: request.expectedSha256,
    applied: false,
  }
  if (fileId && getFileObject(fileId)?.path && open) {
    // A renamed/replaced tab must not satisfy a request for its previous path.
    const same = await invoke<boolean>('paths_refer_to_same_file', {
      path1: request.path,
      path2: getFileObject(fileId).path,
    })
    if (!same) return { ...state, open: false, ready: false, visible: false }
  }
  if (handle && state.ready) {
    try {
      const content = handle.readContent()
      state.contentSha256 = await contentSha256(content)
      // Hashing is asynchronous: recheck identity and live content before confirming it.
      if (editorAutomationRegistry.get(fileId!) !== handle || handle.readContent() !== content) {
        return { ...state, ready: false }
      }
      Object.assign(state, handle.inspect())
      state.open = useEditorStore.getState().opened.includes(fileId!)
      state.dirty = !!useEditorStateStore.getState().idStateMap.get(fileId!)?.hasUnsavedChanges
      state.conflict = useExternalFileChangeStore.getState().notices[fileId!]?.kind === 'conflict'
      state.applied = state.open && state.ready && state.contentSha256 === request.expectedSha256
    } catch {
      state.ready = false
    }
  }
  return state
}

function paint(request: CliRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    let frame = 0
    const timer = setTimeout(
      () => {
        cancelAnimationFrame(frame)
        reject(new CliError('timeout', 'No rendering opportunity before the deadline.'))
      },
      Math.max(1, request.deadline - Date.now()),
    )
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  })
}

export async function runCliRequest(request: CliRequest) {
  checkCliDeadline(request)
  if (request.windowId && request.windowId !== currentWindow.label)
    throw new CliError('wrong_window', 'Request belongs to another window.')
  if (request.operation === 'focus') {
    while (!(await currentWindow.isFocused())) {
      checkCliDeadline(request)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    return { code: 'focused', result: { windowId: currentWindow.label } }
  }
  if (request.operation === 'command') {
    if (!request.commandId || !commandRegistry.hasCommand(request.commandId))
      throw new CliError('command_not_found', 'Unknown GUI command.')
    const result = await commandRegistry.execute(request.commandId)
    if (result === false) throw new CliError('command_failed', 'GUI command declined the action.')
    // Many GUI handlers dispatch asynchronous bus events. Their return cannot attest a save/export.
    return {
      code: 'dispatched',
      result: { windowId: currentWindow.label, commandId: request.commandId, completed: false },
    }
  }
  if (request.operation.startsWith('history') || request.operation === 'save') {
    const fileId = request.path ? await findOpenFile(request.path) : undefined
    return runHistoryCli(request, fileId)
  }
  if (!request.path) throw new CliError('invalid_arguments', 'Missing file path.')
  if (request.operation === 'workspace') {
    await switchWorkspaceInCurrentWindow(request.path)
    checkCliDeadline(request)
    const rootPath = useEditorStore.getState().getRootPath()
    if (
      !rootPath ||
      !(await invoke<boolean>('paths_refer_to_same_file', { path1: rootPath, path2: request.path }))
    ) {
      throw new CliError(
        'workspace_not_opened',
        'The workspace switch was cancelled or did not complete.',
        { path: rootPath },
      )
    }
    return {
      code: 'workspace_opened',
      result: { windowId: currentWindow.label, path: rootPath },
    }
  }
  let fileId = await findOpenFile(request.path)
  checkCliDeadline(request)
  if (request.operation === 'open' || request.operation === 'export') {
    if (fileId) {
      useEditorStore.getState().setActiveId(fileId)
    } else {
      await invoke('save_security_bookmark', { path: request.path })
      checkCliDeadline(request)
      const fileName = getFileNameFromPath(request.path) || 'document.md'
      const dotIndex = fileName.lastIndexOf('.')
      await addExistingMarkdownFileEdit({
        path: request.path,
        fileName,
        ext: dotIndex < 0 ? '' : fileName.slice(dotIndex + 1),
      })
      fileId = await findOpenFile(request.path)
    }
  }
  if (request.operation === 'status')
    return { code: 'file_status', result: await inspectFile(request, fileId) }
  const state = await waitForCliFile(request, {
    inspect: () => inspectFile(request, fileId),
    handle: () => (fileId ? editorAutomationRegistry.get(fileId) : undefined),
    refresh: () =>
      handleExternalWatchEvent({
        type: { modify: { kind: 'data', mode: 'any' } },
        paths: [getFileObject(fileId!)?.path ?? request.path!],
        attrs: {},
      }),
    frame: () => paint(request),
  })
  if (request.operation !== 'export')
    return { code: state.applied ? 'content_applied' : 'file_visible', result: state }
  const handle = fileId ? editorAutomationRegistry.get(fileId) : undefined
  if (!handle || !request.format)
    throw new CliError('editor_unavailable', 'Export renderer is unavailable.')
  const bytes = await handle.render(request.format)
  checkCliDeadline(request)
  const current = await inspectFile(request, fileId)
  if (
    !current.ready ||
    current.contentSha256 !== state.contentSha256 ||
    editorAutomationRegistry.get(fileId!) !== handle
  ) {
    throw new CliError(
      'content_changed',
      'Target content changed while rendering; no export was written.',
      current,
    )
  }
  try {
    const output = await invoke('cli_write_export', {
      requestId: request.requestId,
      content: Array.from(bytes),
    })
    return { code: 'export_completed', result: { file: current, output } }
  } catch (error) {
    throw new CliError('export_failed', String(error), current)
  }
}

/** Register before announcing readiness so cold-start requests cannot be lost. */
let listenerSequence = 0

export async function listenForCliRequests(): Promise<() => void> {
  const listenerId = `${Date.now().toString(36)}-${++listenerSequence}`
  let tail = Promise.resolve()
  let disposed = false
  const unlisten = await currentWindow.listen<CliRequest>('cli:request', ({ payload }) => {
    // Window mutations are ordered. A queued request retains its original deadline.
    tail = tail
      .then(async () => {
        if (disposed) return
        const receipt = await cliReceipt(payload, () => runCliRequest(payload))
        await invoke('cli_complete', { receipt }).catch((error) =>
          logger.error('Failed to deliver CLI receipt', error),
        )
      })
      .catch((error) => logger.error('CLI request failed', error))
  })
  try {
    await invoke('cli_ready', { ready: true, listenerId })
  } catch (error) {
    unlisten()
    throw error
  }
  return () => {
    disposed = true
    unlisten()
    void invoke('cli_ready', { ready: false, listenerId }).catch((error) =>
      logger.error('Failed to stop CLI listener', error),
    )
  }
}
