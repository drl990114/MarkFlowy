import {
  historyCall,
  historyDocument,
  historyWorkspaceForPath,
  type HistoryDocument,
  type HistorySession,
  type HistoryEntry,
} from './local-history'
import { getFileObject } from '@/helper/files'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
import { editorAutomationRegistry } from '@/components/EditorArea/editorAutomationRegistry'
import { checkCliDeadline, CliError, contentSha256, type CliRequest } from './cliProtocol'

export async function runHistoryCli(request: CliRequest, fileId?: string) {
  try {
    if (request.operation === 'historyStatus') {
      return {
        code: 'history_status',
        result: await historyCall<HistorySession>('session', { sessionId: request.sessionId }),
      }
    }
    if (request.operation === 'historyCommit') {
      const session = await historyCall<HistorySession>('session', { sessionId: request.sessionId })
      if (session.state === 'committed') {
        if (
          session.result?.sha256 !== request.expectedSha256 ||
          session.result?.message !== (request.message ?? '')
        )
          throw new CliError(
            'request_conflict',
            'The session was committed with different arguments.',
          )
        return { code: session.result.code, result: session.result }
      }
      const document = await historyCall<HistoryDocument>('document', { id: session.documentId })
      if (!document.path) throw new CliError('file_unavailable', 'The session has no file path.')
      const snapshot = await readStableFileSnapshot(document.path)
      if (snapshot.status !== 'success')
        throw new CliError('file_unstable', 'A stable file snapshot is unavailable.')
      checkCliDeadline(request)
      const result = await historyCall<{ code: string }>('commit', {
        sessionId: request.sessionId,
        content: snapshot.content,
        sha256: request.expectedSha256,
        message: request.message ?? '',
      })
      return { code: result.code, result }
    }
    if (!request.path) throw new CliError('invalid_arguments', 'Missing file path.')
    const document = fileId
      ? await historyDocument(fileId)
      : await historyCall<HistoryDocument>('register', {
          identity: getPathIdentityKey(request.path),
          path: request.path,
          workspace: historyWorkspaceForPath(request.path),
          name: request.path.split(/[\\/]/).pop(),
        })
    if (request.operation === 'historyList')
      return {
        code: 'history_list',
        result: await historyCall<HistoryEntry[]>('list', {
          documentId: document.id,
          offset: request.offset ?? 0,
        }),
      }
    if (request.operation === 'historyBegin') {
      if (fileId) {
        useEditorStore.getState().getEditorContent(fileId)
        if (useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges)
          throw new CliError(
            'content_conflict',
            'Save or resolve the open document before external editing.',
          )
      }
      const snapshot = await readStableFileSnapshot(request.path)
      if (snapshot.status === 'unstable')
        throw new CliError('file_unstable', 'The file is changing.')
      if (snapshot.status === 'unavailable' && snapshot.result.code !== 'NotFound')
        throw new CliError('file_unavailable', 'Cannot read the file.')
      if (fileId) {
        useEditorStore.getState().getEditorContent(fileId)
        if (useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges)
          throw new CliError(
            'content_conflict',
            'The draft changed while preparing the history session.',
          )
      }
      checkCliDeadline(request)
      return {
        code: 'history_started',
        result: await historyCall<HistorySession>('begin', {
          document,
          content: snapshot.status === 'success' ? snapshot.content : undefined,
          requestId: request.operationId,
        }),
      }
    }
    if (request.operation === 'save') {
      const fingerprint = `${request.path}:${request.expectedSha256}`
      const previous = await historyCall<{ code: string; result: unknown } | null>('receipt', {
        operationId: request.operationId,
        fingerprint,
      })
      if (previous) return previous
      if (!fileId) throw new CliError('file_not_open', 'Open this file before saving its draft.')
      const handle = editorAutomationRegistry.get(fileId)
      if (!handle?.save) throw new CliError('editor_unavailable', 'A readable editor is required.')
      const content = handle.readContent()
      if (
        (await contentSha256(content)) !== request.expectedSha256 ||
        handle.readContent() !== content
      )
        throw new CliError('content_changed', 'The draft no longer matches the expected content.')
      checkCliDeadline(request)
      if (!(await handle.save(content)))
        throw new CliError(
          'content_conflict',
          'Saving was not confirmed; inspect the draft and disk.',
        )
      const path = getFileObject(fileId)?.path
      if (!path || getPathIdentityKey(path) !== getPathIdentityKey(request.path))
        throw new CliError('content_changed', 'The document path changed while saving.')
      const snapshot = await readStableFileSnapshot(path)
      if (
        snapshot.status !== 'success' ||
        (await contentSha256(snapshot.content)) !== request.expectedSha256
      )
        throw new CliError(
          'content_changed',
          'The saved file does not match the requested content.',
        )
      const version = await historyCall<{ versionId: string | null }>('checkpoint', {
        document,
        content: snapshot.content,
        kind: 'save',
      })
      const receipt = {
        code: 'file_saved',
        result: {
          path: request.path,
          sha256: request.expectedSha256,
          historyCreated: !!version.versionId,
          versionId: version.versionId ?? undefined,
        },
      }
      await historyCall('recordReceipt', {
        operationId: request.operationId,
        fingerprint,
        result: receipt,
      })
      return receipt
    }
    throw new CliError('invalid_arguments', 'Unsupported history operation.')
  } catch (error) {
    if (error instanceof CliError) throw error
    const message = String(error)
    throw new CliError(
      [
        'history_disabled',
        'history_invalidated',
        'history_session_busy',
        'history_budget_exceeded',
        'content_conflict',
        'file_unstable',
        'content_changed',
        'request_conflict',
      ].find((code) => message.includes(code)) ?? 'history_failed',
      message,
    )
  }
}
