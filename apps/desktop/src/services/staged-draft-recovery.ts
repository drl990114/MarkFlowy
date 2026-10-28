import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { nanoid } from 'nanoid'
import {
  EXTERNAL_FILE_CONTENT_SYNC_EVENT,
  markExternalFileConflict,
  type ExternalFileContentSyncPayload,
} from '@/components/EditorArea/externalFileChanges'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { promoteOpeningRead, readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
import {
  OpeningReadQueue,
  type OpeningReadPriority,
} from '@/components/EditorArea/openingReadQueue'
import { sameTextFormat } from '@/components/EditorArea/textFileFormat'
import bus from '@/helper/eventBus'
import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile, type IFile } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore, { type EditorLayoutNode } from '@/stores/useEditorStore'
import { afterStartupInteractive } from '@/startup/interactive'
import { markStartupStage } from '@/startup/performance'
import { removeReloadSnapshot, retainPendingDrafts, type DraftSessionStore } from './draft-recovery'
import {
  recoverySessionSchema,
  recoveryDocuments,
  nativeRecoveryDocument,
  RELOAD_SESSION_KEY,
  SESSION_KEY_PREFIX,
  type DraftDescriptor,
  type RecoveryDocument,
} from './draftSessionFormat'
import { beginDraftRecoveryDiscovery, registerDraftRecovery, isDraftRecoveryPending } from './draftRecoveryState'
import { persistentDiskRevision } from './draftDiskRevision'
import type { WindowSession } from './window-session'
import {
  bindRecoveredDraft,
  draftProtectionStarted,
  flushDraftProtection,
  historyCall,
  historyWorkspace,
  observeHistoryFile,
  protectLocalEdit,
  startDraftProtection,
  ownsHistoryDraft,
  retainHistoryDraftOnClose,
  type HistoryDocument,
  type PersistedDraft,
} from './local-history'

interface RecoverySource {
  documents: RecoveryDocument[]
  activeId?: string
  native?: boolean
  restoreIds?: boolean
  consume?: () => Promise<void> | void
}
interface Candidate {
  document: RecoveryDocument
  claimed?: PersistedDraft
}
interface RecoveryJob {
  fileId: string
  document: RecoveryDocument
  candidates: Candidate[]
  priority: OpeningReadPriority
  published: boolean
  release: () => void
  ready?: Promise<void>
  firstAttempt: Promise<void>
  settle: () => void
  succeeded: boolean
  unavailable: boolean
  kept?: boolean
  keeping?: Promise<void>
  original?: IFile
}

let activeRecovery: AbortController | undefined
export interface StagedDraftRecovery {
  /** The selected document only; other visible panes have their own recovery gate. */
  visibleReady: Promise<void>
  finished: Promise<number>
}

function visibleIds(layout: EditorLayoutNode): string[] {
  return layout.type === 'leaf'
    ? layout.activeId
      ? [layout.activeId]
      : []
    : layout.children.flatMap(visibleIds)
}

const draftWriterKey = (draft: DraftDescriptor) => `${draft.document.id}:${draft.writer}`

async function readSources(
  cache: DraftSessionStore | undefined,
  reload: boolean,
  session?: WindowSession,
  isolatedWindow?: string,
  reopenPaths: readonly string[] = [],
  freshWindow = false,
) {
  const rootPath = useEditorStore.getState().getRootPath()
  const rootKey = getPathIdentityKey(rootPath ?? '')
  const workspace = historyWorkspace()
  const savedDocuments = session ? recoveryDocuments(session.drafts) : []
  const savedDrafts = savedDocuments.flatMap((doc) => doc.source.kind === 'native' ? [doc.source.draft] : [])
  const savedFiles = [...(session?.files ?? []), ...savedDocuments]
  const savedIds = new Set(savedFiles.map((file) => file.id))
  const savedPaths = new Set(savedFiles.flatMap((file) => file.path ? [getPathIdentityKey(file.path)] : []))
  const followedDrafts = new Map<string, DraftDescriptor>()
  const readSource = async (name: string, read: () => Promise<RecoverySource[]>) => {
    markStartupStage(`draft-${name}-source-start`)
    try {
      return await read()
    } finally {
      markStartupStage(`draft-${name}-source-end`)
    }
  }
  const results = await Promise.allSettled([
    readSource('native', async () => {
      if (!isTauri() || (freshWindow && !session)) return []
      const ownerPrefix = `${getCurrentWindow().label}:`
      const workspaces = new Set([workspace])
      for (const draft of savedDrafts) workspaces.add(draft.document.workspace)
      const groups = await Promise.all(
        [...workspaces].map((scope) =>
          historyCall<DraftDescriptor[]>('recoveryDraftIndex', { workspace: scope, ownerPrefix }),
        ),
      )
      const indexed = groups.flat()
      for (const saved of savedDrafts) {
        const matches = indexed.filter((draft) => sameRecoveryDocument(draft.document, saved.document))
        const original = matches.find((draft) => draft.writer === saved.writer)
        const current = matches.filter((draft) => draft.writer.startsWith(ownerPrefix))
        // A reused main label can still have an unrelated closed window's draft.
        // Prefer the saved writer; follow a completed claim only when unambiguous.
        const next = original ?? (current.length === 1 ? current[0] : undefined)
        if (next) followedDrafts.set(draftWriterKey(saved), next)
      }
      const owner = session?.windowLabel ?? isolatedWindow
      const reopened = new Set(reopenPaths.map(getPathIdentityKey))
      return indexed
        .filter((draft) => {
          const references = savedDrafts.filter((saved) => sameRecoveryDocument(draft.document, saved.document))
          // A window may attach or close a workspace while retaining a draft.
          // Only its explicit references may cross that workspace boundary.
          if (draft.document.workspace !== workspace && !references.length) return false
          if (session) {
            if (references.length)
              return references.some((saved) => followedDrafts.get(draftWriterKey(saved)) === draft)
            return !!draft.document.path && savedPaths.has(getPathIdentityKey(draft.document.path)) &&
              draft.writer.startsWith(`${session.windowLabel}:`)
          }
          return !owner ||
            draft.writer.startsWith(`${owner}:`) ||
            // Explicit single-file startup may recover the same path from a closed
            // window. Native indexing and claiming still reject another live owner.
            (!session && isolatedWindow && draft.document.workspace === workspace &&
              draft.document.path && reopened.has(getPathIdentityKey(draft.document.path)))
        })
        .map((draft) => ({ native: true, documents: [nativeRecoveryDocument(draft)] }))
    }),
    readSource('reload', async () => {
      const raw = reload ? window.sessionStorage.getItem(RELOAD_SESSION_KEY) : null
      if (!raw) return []
      const reloadSession = recoverySessionSchema.parse(JSON.parse(raw))
      if (getPathIdentityKey(reloadSession.rootPath ?? '') !== rootKey) return []
      return [
        {
          documents: recoveryDocuments(reloadSession),
          activeId: reloadSession.activeId,
          consume: () => removeReloadSnapshot(raw),
        },
      ]
    }),
    readSource('exit', async () => {
      if (!cache || (freshWindow && !session)) return []
      const sources: RecoverySource[] = []
      for (const [key, value] of await cache.entries<unknown>()) {
        if (!key.startsWith(SESSION_KEY_PREFIX)) continue
        const owner = session?.windowLabel ?? isolatedWindow
        if (owner && !key.startsWith(`${SESSION_KEY_PREFIX}${owner}:`)) continue
        const parsed = recoverySessionSchema.safeParse(value)
        if (!parsed.success) {
          logger.error('Unrecognized draft session retained', key)
          continue
        }
        const exitSession = parsed.data
        if (getPathIdentityKey(exitSession.rootPath ?? '') !== rootKey) continue
        const documents = recoveryDocuments(exitSession)
        const selected = new Set(documents.flatMap((doc, index) => {
          if (!session) return [index]
          if (!savedIds.has(doc.id) && !(doc.path && savedPaths.has(getPathIdentityKey(doc.path)))) return []
          if (doc.source.kind === 'native' && doc.source.draft.document.workspace !== workspace) {
            const previous = doc.source.draft.document
            if (!savedDrafts.some((saved) => sameRecoveryDocument(previous, saved.document))) return []
          }
          return [index]
        }))
        if (session && !selected.size) continue
        const remaining = exitSession.documents.filter((_doc, index) => !selected.has(index))
        sources.push({
          documents: documents.filter((_doc, index) => selected.has(index)),
          activeId: exitSession.activeId,
          consume: async () => {
            if (remaining.length) {
              // A window session may select only part of an older exit snapshot.
              // Keep the other bodies/references available for their own recovery.
              await cache.set(key, { ...exitSession, documents: remaining,
                activeId: remaining.some((doc) => doc.id === exitSession.activeId) ? exitSession.activeId : undefined,
              })
            } else await cache.delete(key)
            await cache.save()
          },
        })
      }
      return sources
    }),
  ])
  const sources: RecoverySource[] = session
    ? [
        {
          documents: recoveryDocuments(session.drafts),
          activeId: session.drafts.activeId,
          restoreIds: true,
        },
      ]
    : []
  const errors: unknown[] = []
  for (const result of results)
    if (result.status === 'fulfilled') sources.push(...result.value)
    else errors.push(result.reason)
  // A recovery claim changes the writer. If the app exits before its next session
  // save, retain the saved tab identity while following that one current draft.
  for (const source of sources.filter((entry) => entry.restoreIds)) {
    source.documents = source.documents.map((doc) => {
      if (doc.source.kind !== 'native') return doc
      const next = followedDrafts.get(draftWriterKey(doc.source.draft))
      return next ? { ...doc, source: { ...doc.source, draft: next } } : doc
    })
  }
  return { sources, errors }
}

/** Publish metadata first, then load/claim only the selected and visible documents.
 * Hidden work starts after first paint, or earlier when explicitly requested. */
function sameRecoveryDocument(current: HistoryDocument, previous: HistoryDocument) {
  return (
    current.id === previous.id &&
    current.workspace === previous.workspace &&
    getPathIdentityKey(current.path ?? '') === getPathIdentityKey(previous.path ?? '')
  )
}

export async function stageDraftRecovery({
  cache,
  reload = false,
  signal,
  onError,
  session,
  isolatedWindow,
  reopenPaths,
  freshWindow = false,
  preserveOpenDocuments = false,
}: {
  cache?: DraftSessionStore
  reload?: boolean
  signal?: AbortSignal
  onError: (error: unknown) => void
  session?: WindowSession
  isolatedWindow?: string
  /** Explicitly reopened paths may cross the isolated owner boundary in this workspace. */
  reopenPaths?: readonly string[]
  /** A newly created window must not revive drafts from a previously closed owner. */
  freshWindow?: boolean
  preserveOpenDocuments?: boolean
}): Promise<StagedDraftRecovery> {
  const initial = useEditorStore.getState()
  const rootPath = initial.getRootPath()
  const scope = {}
  const controller = new AbortController()
  activeRecovery?.abort()
  activeRecovery = controller
  const finishDiscovery = beginDraftRecoveryDiscovery()
  const jobs = new Map<string, RecoveryJob>()
  const sourceJobs = new Map<RecoverySource, Set<RecoveryJob>>()
  const nativeJobs = new Map<string, RecoveryJob>()
  const consumed = new Set<RecoverySource>()
  const queue = new OpeningReadQueue<void>()
  let stopBackground = () => {}
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const stopWorkspaceWatch = useEditorStore.subscribe((state) => {
    if (state.getRootPath() !== rootPath) abort()
  })
  const cleanup = () => {
    finishDiscovery()
    signal?.removeEventListener('abort', abort)
    stopWorkspaceWatch()
    stopBackground()
    if (activeRecovery === controller) activeRecovery = undefined
  }
  controller.signal.addEventListener(
    'abort',
    () => {
      for (const job of jobs.values()) {
        job.release()
        job.settle()
      }
      cleanup()
    },
    { once: true },
  )
  if (signal?.aborted) abort()
  if (controller.signal.aborted) {
    cleanup()
    return { visibleReady: Promise.resolve(), finished: Promise.resolve(0) }
  }
  const { sources, errors } = await readSources(cache, reload, session, isolatedWindow, reopenPaths, freshWindow)
    .catch((error: unknown) => {
      abort()
      throw error
    })
  try {
    errors.forEach(onError)
  } catch (error) {
    abort()
    throw error
  }
  if (controller.signal.aborted) {
    cleanup()
    return { visibleReady: Promise.resolve(), finished: Promise.resolve(0) }
  }

  const canRestoreFocus =
    !preserveOpenDocuments && useEditorStore.getState().activeId === initial.activeId
  let preferredActiveId: string | undefined
  const snapshot = (job: RecoveryJob): RecoveryDocument => {
    const file = getFileObject(job.fileId)
    if (!job.published || !file) return job.document
    return {
      ...job.document,
      id: file.id,
      name: file.name,
      path: file.path,
      diskRevision: persistentDiskRevision(fileSaveCoordinator.getDiskRevision(file.id)),
      format: fileSaveCoordinator.getPersistedFormat(file.id),
      source: { kind: 'inline', content: useEditorStore.getState().getEditorContent(file.id) },
    }
  }
  const publish = (job: RecoveryJob, content: string) => {
    updateFile({ id: job.fileId, content })
    job.published = true
    fileSaveCoordinator.recordContent(job.fileId, content)
    fileSaveCoordinator.recordFormat(
      job.fileId,
      job.document.format ?? fileSaveCoordinator.getTextMetadata(job.fileId).format,
      !!job.document.format,
    )
    if (job.document.diskRevision)
      fileSaveCoordinator.setDiskRevision(job.fileId, job.document.diskRevision)
    // Workspace switching can mount the disk document before recovery is indexed.
    // Replace that live document too, before any reader or draft binding sees it.
    bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
      fileId: job.fileId,
      content,
    } satisfies ExternalFileContentSyncPayload)
  }

  const claimCandidate = async (candidate: Candidate, claims: Map<string, PersistedDraft>) => {
    const source = candidate.document.source
    if (source.kind !== 'native') throw new Error('Expected a native draft candidate.')
    const key = `${source.draft.document.id}:${source.draft.writer}:${source.draft.sequence}:${source.draft.hash}`
    let claimed = candidate.claimed ?? claims.get(key)
    if (!claimed) {
      source.claimId ??= nanoid()
      const claim = () =>
        historyCall<PersistedDraft | null>('claimRecoveryDraft', {
          draft: source.draft,
          ownerPrefix: `${getCurrentWindow().label}:`,
          claimId: source.claimId,
        })
      for (let attempt = 0; ; attempt++) {
        try {
          claimed = (await claim()) ?? undefined
          break
        } catch (error) {
          const changed = String(error).includes('history_draft_changed')
          if (
            controller.signal.aborted || attempt >= 2 ||
            (!changed && !String(error).includes('history_invalidated'))
          ) throw error
          const current = await historyCall<HistoryDocument>('document', {
            id: source.draft.document.id,
          })
          if (!sameRecoveryDocument(current, source.draft.document)) throw error
          if (changed) {
            // Refresh the same writer, never a different window's candidate. A lost
            // IPC response may have already moved it to this idempotent claim id.
            const latest = await historyCall<DraftDescriptor | null>('draftDescriptor', {
              document: current, writer: source.draft.writer,
            }) ?? await historyCall<DraftDescriptor | null>('draftDescriptor', {
              document: current, writer: `${getCurrentWindow().label}:${source.claimId}`,
            })
            if (!latest) return { key, claimed: undefined }
            if (!sameRecoveryDocument(latest.document, current)) throw error
            source.draft = { ...latest, writer: source.draft.writer }
          } else {
            // Clearing/disabling history advances its generation but preserves drafts.
            source.draft = { ...source.draft, document: current }
          }
          // Retry through the native transaction: exact version, liveness and
          // checksum validation still apply, including if the row changes again.
          if (controller.signal.aborted) throw error
        }
      }
    }
    return { key, claimed }
  }

  const materialize = async (job: RecoveryJob) => {
    let content: string | undefined
    let selected: RecoveryDocument | undefined
    const claims = new Map<string, PersistedDraft>()
    for (const candidate of job.candidates) {
      if (controller.signal.aborted)
        throw new DOMException('Draft recovery canceled.', 'AbortError')
      const source = candidate.document.source
      if (source.kind === 'inline') {
        content = source.content
        selected = candidate.document
      } else if (source.kind === 'reload') {
        const raw = window.sessionStorage.getItem(source.key)
        if (raw === null) throw new Error('A reload draft body is unavailable.')
        const body: unknown = JSON.parse(raw)
        if (typeof body !== 'string') throw new Error('Invalid reload draft body.')
        content = body
        selected = candidate.document
      } else {
        const { key, claimed } = await claimCandidate(candidate, claims)
        // A stale manifest may name a writer already replaced by the indexed draft.
        // It cannot overwrite that newer body, or turn a sole missing reference into empty text.
        if (claimed) {
          candidate.claimed = claimed
          claims.set(key, claimed)
          content = claimed.content
          selected = {
            ...candidate.document,
            diskRevision: claimed.diskRevision ?? undefined,
            format: claimed.format ?? undefined,
            source: {
              kind: 'native',
              draft: {
                ...source.draft,
                document: claimed.document,
                writer: claimed.writer,
                sequence: claimed.sequence,
                diskRevision: claimed.diskRevision,
                format: claimed.format,
              },
            },
          }
        }
      }
    }
    // Null is an authoritative native response: the reference was saved/retired or
    // is held by another window. Exceptions (I/O, corruption, stale version) still fail.
    if (content === undefined) return undefined
    // A manifest may have referenced an older revision/encoding than the indexed body.
    // Keep metadata from the body actually read, including on an interrupted reload.
    job.document = { ...selected!, path: job.document.path }
    return content
  }

  const assertRecoveryCurrent = (
    job: RecoveryJob,
    path: string | undefined,
    startingDiskRevision: string | undefined,
    startingRevision: number,
    startingContent: string | undefined,
  ) => {
    const { fileId } = job
    const editor = useEditorStore.getState()
    if (controller.signal.aborted || !editor.opened.includes(fileId))
      throw new DOMException('Draft recovery canceled.', 'AbortError')
    // Flush coalesced input before comparing revisions. A replacement must not
    // cancel a newer local edit or an active composition in an already mounted view.
    editorSnapshotRegistry.flushForRead(fileId)
    const file = getFileObject(fileId)
    if (!file || file.path !== path)
      throw new DOMException('Draft recovery canceled.', 'AbortError')
    if (fileSaveCoordinator.getDiskRevision(fileId) !== startingDiskRevision)
      throw new Error('The document changed while its draft was being recovered.')
    if (
      !job.published &&
      (fileSaveCoordinator.getRevision(fileId) !== startingRevision ||
        file.content !== startingContent)
    )
      throw new Error('The document was edited before its draft was loaded.')
    return editor
  }

  const bindCandidateDrafts = async (
    job: RecoveryJob,
    latest: string,
    format: ReturnType<typeof fileSaveCoordinator.getPersistedFormat>,
  ) => {
    const { fileId } = job
    const bound = new Set<string>()
    for (const candidate of job.candidates) {
      const draft = candidate.claimed
      if (!draft || bound.has(draft.writer)) continue
      await bindRecoveredDraft(fileId, {
        ...draft,
        content: latest,
        format,
        diskRevision: job.document.diskRevision,
      })
      bound.add(draft.writer)
    }
  }

  const keepAndClose = (job: RecoveryJob): Promise<void> => {
    if (job.keeping) return job.keeping
    job.keeping = (async () => {
      // A foreground retry can finish while the confirmation is open. Never
      // close that newly recovered editor without the normal unsaved check.
      await job.ready?.catch(() => undefined)
      if (job.succeeded || job.unavailable || job.kept) return
      const file = getFileObject(job.fileId)
      const revision = fileSaveCoordinator.getRevision(job.fileId)
      const assertCurrent = () => {
        if (
          controller.signal.aborted || !file ||
          !useEditorStore.getState().opened.includes(job.fileId) ||
          getFileObject(job.fileId) !== file ||
          fileSaveCoordinator.getRevision(job.fileId) !== revision
        ) throw new Error('The document changed while its draft was being preserved.')
      }
      assertCurrent()
      const documents = job.candidates.map((candidate) => candidate.document)
      if (job.published) documents.push(snapshot(job))
      const rollback = await retainPendingDrafts(cache, getCurrentWindow().label, rootPath, documents)
      try {
        assertCurrent()
        await retainHistoryDraftOnClose(job.fileId)
        assertCurrent()
        job.kept = true
        // Keep the recovery gate until the document is removed. Its placeholder
        // must never be read or checkpointed as an empty/discarded document.
        useEditorStore.getState().delOpenedFile(job.fileId)
        useEditorStateStore.getState().delIdStateMap(job.fileId)
        job.release()
        job.settle()
        if (![...jobs.values()].some((item) => isDraftRecoveryPending(item.fileId))) cleanup()
      } catch (error) {
        await rollback()
        throw error
      }
    })().finally(() => { job.keeping = undefined })
    return job.keeping
  }

  const reconcileRecoveredDisk = (
    job: RecoveryJob,
    latest: string,
    path: string | undefined,
    disk: Awaited<ReturnType<typeof readStableFileSnapshot>> | undefined,
    format: ReturnType<typeof fileSaveCoordinator.getPersistedFormat>,
  ) => {
    const { fileId } = job
    const dirty =
      !path ||
      disk?.status !== 'success' ||
      disk.content !== latest ||
      (!!format && !sameTextFormat(format, disk.text?.format ?? format))
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: dirty })
    if (path && disk?.status === 'success') {
      fileSaveCoordinator.setSavedBaseline(fileId, disk)
      if (!dirty) fileSaveCoordinator.loadSnapshot(fileId, disk)
      else if (!format && disk.text)
        fileSaveCoordinator.recordFormat(fileId, disk.text.format, false)
      if (dirty && persistentDiskRevision(disk.revision) !== persistentDiskRevision(job.document.diskRevision))
        markExternalFileConflict(fileId, disk.revision)
      else
        // The persisted signature validates recovery, not live saves. Rebase to
        // this process's full token so subsequent CAS still checks generations.
        fileSaveCoordinator.setDiskRevision(fileId, disk.revision)
    }
    return dirty
  }

  const recover = async (job: RecoveryJob) => {
    const { fileId } = job
    const path = job.document.path
    const startingDiskRevision = fileSaveCoordinator.getDiskRevision(fileId)
    const startingRevision = fileSaveCoordinator.getRevision(fileId)
    const startingContent = getFileObject(fileId)?.content
    // Body IPC and disk validation are independent after workspace permissions are restored.
    const diskPromise = path
      ? readStableFileSnapshot(path, {
          reuseInFlight: true,
          scope,
          signal: controller.signal,
          priority: job.priority,
        }).catch((error: unknown) => {
          if (!controller.signal.aborted) logger.error('Draft disk validation failed', error)
          return undefined
        })
      : Promise.resolve(undefined)
    const [content, disk] = await Promise.all([materialize(job), diskPromise])
    const editor = assertRecoveryCurrent(
      job,
      path,
      startingDiskRevision,
      startingRevision,
      startingContent,
    )
    if (content === undefined) {
      job.unavailable = true
      job.release()
      useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: false })
      if (job.original) updateFile(job.original)
      else editor.delOpenedFile(fileId)
      return
    }
    // Legacy bodies were published synchronously. Preserve input/format edits made since then.
    if (!job.published) publish(job, content)
    const latest = editor.getEditorContent(fileId)
    if (path && disk?.status !== 'success') {
      updateFile({ id: fileId, path: undefined })
      job.document.path = undefined
    }
    const format = fileSaveCoordinator.getPersistedFormat(fileId)
    const dirty = reconcileRecoveredDisk(job, latest, path, disk, format)
    await bindCandidateDrafts(job, latest, format)
    job.succeeded = true
    job.release()
    if (dirty) protectLocalEdit(fileId)
    else void observeHistoryFile(fileId, latest).catch(onError)
  }

  let finalization = Promise.resolve(0)
  const finalize = () => {
    finalization = finalization
      .then(async () => {
        if (controller.signal.aborted) return 0
        await flushDraftProtection()
        if (controller.signal.aborted) return 0
        for (const [source, members] of sourceJobs) {
          if (
            consumed.has(source) ||
            ![...members].every((job) => job.succeeded || job.unavailable)
          )
            continue
          if (!isTauri() || draftProtectionStarted()) {
            await source.consume?.()
            consumed.add(source)
          }
        }
        return [...jobs.values()].filter((job) => job.succeeded).length
      })
      .catch((error: unknown) => {
        onError(error)
        return 0
      })
    return finalization
  }
  let initialFinished = false
  const start = (job: RecoveryJob, priority: OpeningReadPriority): Promise<void> => {
    if (job.succeeded || job.unavailable || job.kept) return Promise.resolve()
    if (job.keeping) return job.keeping
    if (priority === 'foreground' || job.priority === 'background') job.priority = priority
    queue.promote(job.fileId, scope, job.priority)
    if (job.document.path) promoteOpeningRead(job.document.path, scope, job.priority)
    if (!job.ready) {
      job.ready = queue
        .read(job.fileId, () => recover(job), {
          scope,
          signal: controller.signal,
          priority: job.priority,
        })
        .catch((error: unknown) => {
          job.ready = undefined
          if (!controller.signal.aborted) onError(error)
          // Keep the pending gate and source; retry and close must never see a placeholder as text.
          throw error
        })
        .finally(() => {
          job.settle()
          if (initialFinished && (job.succeeded || job.unavailable))
            void finalize().then(() => {
              if (![...jobs.values()].some((item) => isDraftRecoveryPending(item.fileId))) cleanup()
            })
        })
    }
    return job.ready
  }

  const resolveRecoveryPath = (
    source: RecoverySource,
    path: string | undefined,
    existing: ReturnType<typeof getFileObject> | undefined,
    prior: RecoveryJob | undefined | '',
    nativeKey: string | undefined,
    inline: string | undefined,
  ) => {
    const preserveExisting = !!(
      existing &&
      useEditorStateStore.getState().idStateMap.get(existing.id)?.hasUnsavedChanges &&
      (!prior || prior.published) &&
      existing.content !== inline
    )
    if (preserveExisting) path = undefined
    // Distinct native writers retain independent versions even when they share a path.
    if (source.native && prior && nativeKey && !nativeJobs.has(nativeKey)) path = undefined
    return { path, preserveExisting }
  }

  const resolveRecoveryFile = (source: RecoverySource, doc: RecoveryDocument) => {
    let path = doc.path
    const nativeKey =
      doc.source.kind === 'native'
        ? `${doc.source.draft.document.id}:${doc.source.draft.writer}`
        : undefined
    let existing = path
      ? getFileObjectByPath(path)
      : source.restoreIds
        ? getFileObject(doc.id)
        : undefined
    const inline = doc.source.kind === 'inline' ? doc.source.content : undefined
    const composing = !!(existing && inline !== undefined && !editorSnapshotRegistry.canRead(existing.id))
    if (existing && inline !== undefined && !composing) {
      // Inline bodies publish during registration. Read pending input before
      // deciding whether the old draft can reuse this live document's identity.
      editorSnapshotRegistry.flushForRead(existing.id)
      existing = getFileObject(existing.id)
    }
    const prior = (nativeKey && nativeJobs.get(nativeKey)) || (existing && jobs.get(existing.id))
    const resolved = resolveRecoveryPath(source, path, existing, prior, nativeKey, inline)
    // Composition cannot be read yet. Preserve both versions independently,
    // without blocking unrelated drafts in the same recovery batch.
    const preserveExisting = composing || resolved.preserveExisting
    path = preserveExisting ? undefined : resolved.path
    const file =
      nativeKey && nativeJobs.has(nativeKey)
        ? getFileObject(nativeJobs.get(nativeKey)!.fileId)!
        : existing && !preserveExisting && (path || source.restoreIds)
          ? existing
          : createFile({ name: doc.name, content: undefined, path, ext: doc.ext ?? 'md' })
    return { file, existing, nativeKey, inline }
  }

  const registerDocument = (
    source: RecoverySource,
    doc: RecoveryDocument,
    members: Set<RecoveryJob>,
  ) => {
    if (
      preserveOpenDocuments &&
      doc.source.kind === 'native' &&
      initial.opened.some((id) =>
        ownsHistoryDraft(id, doc.source.kind === 'native' ? doc.source.draft : undefined),
      )
    )
      return
    const { file, existing, nativeKey, inline } = resolveRecoveryFile(source, doc)
    let job = jobs.get(file.id)
    if (!job) {
      let settle!: () => void
      job = {
        fileId: file.id,
        document: { ...doc, path: file.path },
        candidates: [],
        priority: 'background',
        published: false,
        release: () => {},
        firstAttempt: new Promise<void>((done) => {
          settle = done
        }),
        settle: () => settle(),
        succeeded: false,
        unavailable: false,
        original: file === existing && (!source.restoreIds || file.path) ? { ...file } : undefined,
      }
      const registered = job
      job.release = registerDraftRecovery(
        file.id,
        (priority) => start(registered, priority),
        () => snapshot(registered),
        () => keepAndClose(registered),
      )
      jobs.set(file.id, job)
    }
    job.document = { ...doc, path: file.path }
    job.candidates.push({ document: job.document })
    if (nativeKey) nativeJobs.set(nativeKey, job)
    members.add(job)
    if (inline !== undefined) publish(job, inline)
    useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
    if (!useEditorStore.getState().opened.includes(file.id))
      useEditorStore.getState().addOpenedFile(file.id)
    if (source.activeId === doc.id) preferredActiveId = file.id
  }

  try {
    for (const source of sources) {
      const members = new Set<RecoveryJob>()
      sourceJobs.set(source, members)
      for (const doc of source.documents) registerDocument(source, doc, members)
    }
    const active =
      preferredActiveId || useEditorStore.getState().activeId || jobs.keys().next().value
    if (active && canRestoreFocus && active !== useEditorStore.getState().activeId)
      useEditorStore.getState().setActiveId(active)
    // Every indexed draft is now registered and dirty. Their per-file recovery
    // gates protect content while the remaining body reads continue.
    finishDiscovery()
    await startDraftProtection().catch(onError)
  } catch (error) {
    abort()
    throw error
  } finally {
    finishDiscovery()
  }

  const activeId = useEditorStore.getState().activeId
  const visible = new Set(visibleIds(useEditorStore.getState().editorLayout))
  const ordered = [...jobs.values()].sort(
    (a, b) => Number(b.fileId === activeId) - Number(a.fileId === activeId),
  )
  const startVisibleJobs = () => {
    for (const job of ordered) {
      if (job.fileId === activeId || visible.has(job.fileId))
        void start(job, job.fileId === activeId ? 'foreground' : 'visible').catch(() => undefined)
    }
  }
  startVisibleJobs()
  stopBackground = afterStartupInteractive(
    () => {
      for (const job of ordered)
        if (!job.ready && !job.succeeded && !job.unavailable)
          void start(job, 'background').catch(() => undefined)
    },
    { signal: controller.signal },
  )
  const visibleReady = jobs.get(activeId ?? '')?.firstAttempt ?? Promise.resolve()
  const finished = Promise.all(ordered.map((job) => job.firstAttempt)).then(async () => {
    initialFinished = true
    const count = await finalize()
    if (![...jobs.values()].some((job) => isDraftRecoveryPending(job.fileId))) cleanup()
    return count
  })
  return { visibleReady, finished }
}
