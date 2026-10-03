import { runHistoryCli } from './history-cli'
import { commandRegistry } from '@/commands'
import { editorAutomationRegistry } from '@/components/EditorArea/editorAutomationRegistry'
import { handleExternalWatchEvent } from '@/components/EditorArea/externalFileChanges'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import type { TextEncoding } from '@/components/EditorArea/textFileFormat'
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

type ResolveExpectedSha256 = (encoding: TextEncoding | undefined) => Promise<string>

function createExpectedSha256Resolver(request: CliRequest): ResolveExpectedSha256 {
  const hashes = new Map<TextEncoding | undefined, Promise<string>>()
  return async (encoding) => {
    if (request.expectedSha256 !== null) return request.expectedSha256
    try {
      let pending = hashes.get(encoding)
      if (!pending) {
        // Decode the invocation's frozen bytes, never a newer disk version or the live draft.
        pending = invoke<string>('cli_hash_snapshot', { requestId: request.requestId, encoding })
        hashes.set(encoding, pending)
      }
      const hash = await pending
      checkCliDeadline(request)
      return hash
    } catch (error) {
      checkCliDeadline(request)
      throw new CliError('file_unavailable', String(error))
    }
  }
}

async function inspectFile(
  request: CliRequest,
  fileId: string | undefined,
  resolveExpectedSha256: ResolveExpectedSha256,
): Promise<CliFileState> {
  const open = !!fileId && useEditorStore.getState().opened.includes(fileId)
  const filePath = fileId ? getFileObject(fileId)?.path : undefined
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
  if (filePath && open) {
    // A renamed/replaced tab must not satisfy a request for its previous path.
    const same = await invoke<boolean>('paths_refer_to_same_file', {
      path1: request.path,
      path2: filePath,
    })
    if (!same) return { ...state, open: false, ready: false, visible: false }
  }
  if (handle && state.ready) {
    const encoding = fileSaveCoordinator.getReadEncoding(fileId!)
    state.expectedSha256 = await resolveExpectedSha256(encoding)
    const inspected = await inspectLiveContent(request, fileId!, handle, state, encoding)
    if (getFileObject(fileId!)?.path !== filePath) {
      return { ...inspected, open: false, ready: false, visible: false, applied: false }
    }
    return inspected
  }
  if (request.operation === 'status') {
    state.expectedSha256 = await resolveExpectedSha256(
      open ? fileSaveCoordinator.getReadEncoding(fileId!) : undefined,
    )
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

async function dispatchCliCommand(request: CliRequest) {
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

async function openCliWorkspace(request: CliRequest) {
  await switchWorkspaceInCurrentWindow(request.path!)
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

async function exportCliFile(
  request: CliRequest,
  fileId: string | undefined,
  state: CliFileState,
  inspect: () => Promise<CliFileState>,
) {
  const handle = fileId ? editorAutomationRegistry.get(fileId) : undefined
  if (!handle || !request.format)
    throw new CliError('editor_unavailable', 'Export renderer is unavailable.')
  const bytes = await handle.render(request.format)
  checkCliDeadline(request)
  const current = await inspect()
  if (
    !current.ready ||
    current.contentSha256 !== state.contentSha256 ||
    current.expectedSha256 !== state.expectedSha256 ||
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

async function inspectLiveContent(
  request: CliRequest,
  fileId: string,
  handle: NonNullable<ReturnType<typeof editorAutomationRegistry.get>>,
  state: CliFileState,
  encoding: TextEncoding | undefined,
): Promise<CliFileState> {
  try {
    const content = handle.readContent()
    state.contentSha256 = await contentSha256(content)
    // Hashing is asynchronous: recheck identity and live content before confirming it.
    if (
      editorAutomationRegistry.get(fileId!) !== handle ||
      handle.readContent() !== content ||
      (request.expectedSha256 === null && fileSaveCoordinator.getReadEncoding(fileId) !== encoding)
    ) {
      return { ...state, ready: false }
    }
    Object.assign(state, handle.inspect())
    state.open = useEditorStore.getState().opened.includes(fileId!)
    state.dirty = !!useEditorStateStore.getState().idStateMap.get(fileId!)?.hasUnsavedChanges
    state.conflict = useExternalFileChangeStore.getState().notices[fileId!]?.kind === 'conflict'
    state.applied = state.open && state.ready && state.contentSha256 === state.expectedSha256
  } catch {
    state.ready = false
  }

  return state
}

async function openCliFile(request: CliRequest, fileId: string | undefined) {
  if (fileId) {
    useEditorStore.getState().setActiveId(fileId)
  } else {
    await invoke('save_security_bookmark', { path: request.path })
    checkCliDeadline(request)
    const fileName = getFileNameFromPath(request.path!) || 'document.md'
    const dotIndex = fileName.lastIndexOf('.')
    await addExistingMarkdownFileEdit({
      path: request.path!,
      fileName,
      ext: dotIndex < 0 ? '' : fileName.slice(dotIndex + 1),
    })
    fileId = await findOpenFile(request.path!)
  }

  return fileId
}

async function waitForCliFocus(request: CliRequest) {
  while (!(await currentWindow.isFocused())) {
    checkCliDeadline(request)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return { code: 'focused', result: { windowId: currentWindow.label } }
}

export async function runCliRequest(request: CliRequest) {
  checkCliDeadline(request)
  if (request.windowId && request.windowId !== currentWindow.label)
    throw new CliError('wrong_window', 'Request belongs to another window.')
  if (request.operation === 'focus') return waitForCliFocus(request)
  if (request.operation === 'command') return dispatchCliCommand(request)
  if (request.operation.startsWith('history') || request.operation === 'save') {
    const fileId = request.path ? await findOpenFile(request.path) : undefined
    return runHistoryCli(request, fileId)
  }
  if (!request.path) throw new CliError('invalid_arguments', 'Missing file path.')
  if (request.operation === 'workspace') return openCliWorkspace(request)
  let fileId = await findOpenFile(request.path)
  checkCliDeadline(request)
  if (request.operation === 'open' || request.operation === 'export') {
    fileId = await openCliFile(request, fileId)
  }
  const resolveExpectedSha256 = createExpectedSha256Resolver(request)
  const inspect = () => inspectFile(request, fileId, resolveExpectedSha256)
  if (request.operation === 'status') return { code: 'file_status', result: await inspect() }
  const state = await waitForCliFile(request, {
    inspect,
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
  return exportCliFile(request, fileId, state, inspect)
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
