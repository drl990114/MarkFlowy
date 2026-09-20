import type {
  CliExportFormat,
  EditorAutomationHandle,
} from '@/components/EditorArea/editorAutomationRegistry'
import { invoke } from '@tauri-apps/api/core'

export interface CliRequest {
  protocolVersion: number
  requestId: string
  operation: 'open' | 'workspace' | 'status' | 'wait' | 'export' | 'command' | 'focus'
  path: string | null
  windowId: string | null
  commandId: string | null
  preview: boolean
  waitFor: 'applied' | 'visible'
  expectedSha256: string | null
  output: string | null
  format: CliExportFormat | null
  overwrite: boolean
  deadline: number
}

export interface CliFileState {
  path: string
  windowId: string
  fileId?: string
  open: boolean
  active: boolean
  visible: boolean
  ready: boolean
  mode?: string
  dirty: boolean
  conflict: boolean
  contentSha256?: string
  expectedSha256: string | null
  applied: boolean
  error?: string
}

export interface CliReceipt {
  protocolVersion: 1
  requestId: string
  ok: boolean
  code: string
  message: string
  result: unknown
}

export class CliError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly result?: unknown,
  ) {
    super(message)
  }
}

export function checkCliDeadline(request: CliRequest): void {
  if (Date.now() >= request.deadline) {
    throw new CliError('timeout', 'Completion was not confirmed; inspect state before retrying.')
  }
}

export async function contentSha256(content: string): Promise<string> {
  // Some embedded/custom-protocol WebViews do not expose Web Crypto.
  if (!globalThis.crypto?.subtle) return invoke<string>('cli_hash_content', { content })
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export interface CliFileOperations {
  inspect: () => Promise<CliFileState>
  handle: () => EditorAutomationHandle | undefined
  refresh: () => Promise<void>
  /** Resolves after a rendering opportunity, bounded by the request deadline. */
  frame: () => Promise<void>
}

/** Confirm the live document again after paint; a cached hash alone is insufficient. */
export async function waitForCliFile(
  request: CliRequest,
  ops: CliFileOperations,
): Promise<CliFileState> {
  let refreshed = false
  for (;;) {
    checkCliDeadline(request)
    const state = await ops.inspect()
    if (!state.open)
      throw new CliError('file_not_open', 'The target file is not open in this window.', state)
    if (state.error) throw new CliError('editor_failed', state.error, state)
    if (state.conflict && !state.applied)
      throw new CliError(
        'content_conflict',
        'Local edits conflict with the requested disk content.',
        state,
      )
    if (request.preview && state.ready && state.mode !== 'preview') {
      ops.handle()?.preview()
    } else if (state.ready && state.visible && (request.waitFor === 'visible' || state.applied)) {
      await ops.frame()
      checkCliDeadline(request)
      const confirmed = await ops.inspect()
      if (
        confirmed.ready &&
        confirmed.visible &&
        (!request.preview || confirmed.mode === 'preview') &&
        (request.waitFor === 'visible' || confirmed.applied) &&
        confirmed.contentSha256 === state.contentSha256
      ) {
        return confirmed
      }
    } else if (state.ready && !state.applied && request.waitFor === 'applied' && !refreshed) {
      // Reuse conflict-aware external-file synchronization, including loose files outside the workspace.
      refreshed = true
      await ops.refresh()
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(40, Math.max(1, request.deadline - Date.now()))),
    )
  }
}

export async function cliReceipt(
  request: CliRequest,
  run: () => Promise<{ code: string; result: unknown }>,
): Promise<CliReceipt> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    if (request.protocolVersion !== 1)
      throw new CliError('unsupported_protocol', 'Unsupported CLI protocol.')
    checkCliDeadline(request)
    const { code, result } = await Promise.race([
      run(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new CliError(
                'timeout',
                'Completion was not confirmed; inspect state before retrying.',
              ),
            ),
          Math.max(1, request.deadline - Date.now()),
        )
      }),
    ])
    checkCliDeadline(request)
    return { protocolVersion: 1, requestId: request.requestId, ok: true, code, message: '', result }
  } catch (error) {
    return {
      protocolVersion: 1,
      requestId: request.requestId,
      ok: false,
      code: error instanceof CliError ? error.code : 'operation_failed',
      message: error instanceof Error ? error.message : String(error),
      result: error instanceof CliError ? (error.result ?? null) : null,
    }
  } finally {
    clearTimeout(timeout)
  }
}
