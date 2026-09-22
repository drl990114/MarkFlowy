import { sameTextFormat } from '@/components/EditorArea/textFileFormat'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { markExternalFileConflict } from '@/components/EditorArea/externalFileChanges'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { promoteOpeningRead, readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
import type { OpeningReadPriority } from '@/components/EditorArea/openingReadQueue'
import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore, { type EditorLayoutNode } from '@/stores/useEditorStore'
import { markStartupStage } from '@/startup/performance'
import {
  draftSessionSchema,
  RELOAD_SESSION_KEY,
  SESSION_KEY_PREFIX,
  type DraftDocument,
  type DraftSession,
  type DraftSessionStore,
} from './draft-recovery'
import { registerDraftRecovery } from './draftRecoveryState'
import {
  bindRecoveredDraft,
  draftProtectionStarted,
  flushDraftProtection,
  historyCall,
  historyWorkspace,
  observeHistoryFile,
  protectLocalEdit,
  startDraftProtection,
  type PersistedDraft,
} from './local-history'

interface RecoverySource {
  session: DraftSession
  nativeDraft?: PersistedDraft
  consume?: () => Promise<void> | void
}

interface RecoveryJob {
  fileId: string
  document: DraftDocument
  nativeDrafts: PersistedDraft[]
  priority: OpeningReadPriority
  release: () => void
  ready?: Promise<boolean>
}

let activeRecovery: AbortController | undefined

export interface StagedDraftRecovery {
  visibleReady: Promise<void>
  finished: Promise<number>
}

function visibleIds(layout: EditorLayoutNode): string[] {
  return layout.type === 'leaf'
    ? layout.activeId ? [layout.activeId] : []
    : layout.children.flatMap(visibleIds)
}

/** Read complete recovery sources concurrently, then schedule document disk validation. */
async function readSources(cache: DraftSessionStore | undefined, reload: boolean) {
  const rootPath = useEditorStore.getState().getRootPath()
  const workspace = historyWorkspace()
  const readSource = async (name: string, read: () => Promise<RecoverySource[]>) => {
    markStartupStage(`draft-${name}-source-start`)
    try {
      return await read()
    } finally {
      // Includes IPC and source validation. Separate from later disk validation;
      // these calls still transfer complete drafts, including hidden documents.
      markStartupStage(`draft-${name}-source-end`)
    }
  }
  const [native, reloading, exiting] = await Promise.allSettled([
    readSource('native', async () => {
      if (!isTauri()) return []
      const ownerPrefix = `${getCurrentWindow().label}:`
      const groups = await Promise.all([
        historyCall<PersistedDraft[]>('recoveryDrafts', { workspace, ownerPrefix }),
        workspace
          ? historyCall<PersistedDraft[]>('recoveryDrafts', { workspace: '', ownerPrefix })
          : Promise.resolve([]),
      ])
      return groups.flat().map((draft) => ({
        nativeDraft: draft,
        session: {
          version: 1,
          documents: [{
            id: draft.document.id,
            name: draft.document.name,
            path: draft.document.path ?? undefined,
            ext: draft.document.name.match(/\.([^./\\]+)$/)?.[1].toLowerCase() ?? 'md',
            content: draft.content,
            diskRevision: draft.diskRevision,
            format: draft.format ?? undefined,
          }],
        },
      }))
    }),
    readSource('reload', async () => {
      const raw = reload ? window.sessionStorage.getItem(RELOAD_SESSION_KEY) : null
      if (!raw) return []
      const session = draftSessionSchema.parse(JSON.parse(raw))
      return [{
        session,
        consume: () => {
          // beforeunload may already have stored newer input while background recovery ran.
          if (window.sessionStorage.getItem(RELOAD_SESSION_KEY) === raw)
            window.sessionStorage.removeItem(RELOAD_SESSION_KEY)
        },
      }]
    }),
    readSource('exit', async () => {
      if (!cache) return []
      const sources: RecoverySource[] = []
      for (const [key, value] of await cache.entries<unknown>()) {
        if (!key.startsWith(SESSION_KEY_PREFIX)) continue
        const parsed = draftSessionSchema.safeParse(value)
        if (!parsed.success) {
          logger.error('Unrecognized draft session retained', key)
          continue
        }
        if (parsed.data.rootPath && parsed.data.rootPath !== rootPath) continue
        sources.push({
          session: parsed.data,
          consume: async () => { await cache.delete(key); await cache.save() },
        })
      }
      return sources
    }),
  ])
  const sources: RecoverySource[] = []
  const errors: unknown[] = []
  for (const result of [native, reloading, exiting]) {
    if (result.status === 'fulfilled') sources.push(...result.value)
    else errors.push(result.reason)
  }
  return { sources, errors }
}

/**
 * Publish every exact draft before the shell becomes editable. Only visible documents
 * wait for disk validation; hidden drafts retain their content and cannot yet mount,
 * save, or enter local-history protection. Reload can still capture them synchronously.
 */
export async function stageDraftRecovery({
  cache,
  reload = false,
  signal,
  onError,
}: {
  cache?: DraftSessionStore
  reload?: boolean
  signal?: AbortSignal
  onError: (error: unknown) => void
}): Promise<StagedDraftRecovery> {
  const initial = useEditorStore.getState()
  const rootPath = initial.getRootPath()
  const scope = {}
  const controller = new AbortController()
  activeRecovery?.abort()
  activeRecovery = controller
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  const stopWorkspaceWatch = useEditorStore.subscribe((state) => {
    if (state.getRootPath() !== rootPath) abort()
  })
  const cleanup = () => {
    signal?.removeEventListener('abort', abort)
    stopWorkspaceWatch()
    if (activeRecovery === controller) activeRecovery = undefined
  }
  const { sources, errors } = await readSources(cache, reload)
  errors.forEach(onError)
  if (controller.signal.aborted) {
    cleanup()
    return { visibleReady: Promise.resolve(), finished: Promise.resolve(0) }
  }

  const jobs = new Map<string, RecoveryJob>()
  const sourceJobs = new Map<RecoverySource, RecoveryJob[]>()
  const canRestoreFocus = useEditorStore.getState().activeId === initial.activeId
  let preferredActiveId: string | undefined
  try {
    for (const source of sources) {
      const members: RecoveryJob[] = []
      sourceJobs.set(source, members)
      for (const doc of source.session.documents) {
        let path = doc.path
        const existing = path ? getFileObjectByPath(path) : undefined
        const prior = existing && jobs.get(existing.id)
        // Only an untouched native recovery may be superseded by its exit snapshot.
        // A live edit or a different recovered version keeps its own document.
        if (
          existing &&
          useEditorStateStore.getState().idStateMap.get(existing.id)?.hasUnsavedChanges &&
          useEditorStore.getState().getEditorContent(existing.id) !== doc.content &&
          !(prior?.nativeDrafts.length && !source.nativeDraft &&
            getFileObject(existing.id)?.content === prior.document.content)
        ) path = undefined
        const file = path && existing
          ? updateFile({ id: existing.id, content: doc.content })
          : createFile({ name: doc.name, content: doc.content, path, ext: doc.ext ?? 'md' })
        let job = jobs.get(file.id)
        if (!job) {
          job = {
            fileId: file.id,
            document: { ...doc, path },
            nativeDrafts: [],
            priority: 'background',
            release: () => {},
          }
          const registered = job
          job.release = registerDraftRecovery(file.id, (priority) => {
            if (priority === 'foreground' || registered.priority === 'background')
              registered.priority = priority
            if (registered.document.path)
              promoteOpeningRead(registered.document.path, scope, registered.priority)
          })
          jobs.set(file.id, job)
        }
        job.document = { ...doc, path }
        if (source.nativeDraft) job.nativeDrafts.push(source.nativeDraft)
        members.push(job)
        fileSaveCoordinator.recordContent(file.id, doc.content)
        fileSaveCoordinator.recordFormat(file.id, doc.format ?? fileSaveCoordinator.getTextMetadata(file.id).format, !!doc.format)
        if (doc.diskRevision) fileSaveCoordinator.setDiskRevision(file.id, doc.diskRevision)
        // Until validation finishes, conservatively protect the exact draft as dirty.
        useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
        if (!useEditorStore.getState().opened.includes(file.id))
          useEditorStore.getState().addOpenedFile(file.id)
        if (source.session.activeId === doc.id) preferredActiveId = file.id
      }
    }
    // Restore focus once. Background completions never change selection.
    const active = preferredActiveId || useEditorStore.getState().activeId || jobs.keys().next().value
    if (active && canRestoreFocus && active !== useEditorStore.getState().activeId)
      useEditorStore.getState().setActiveId(active)
    await startDraftProtection().catch(onError)
  } catch (error) {
    jobs.forEach((job) => job.release())
    cleanup()
    throw error
  }

  const visible = new Set(visibleIds(useEditorStore.getState().editorLayout))
  const activeId = useEditorStore.getState().activeId
  const rank = (job: RecoveryJob) => job.fileId === activeId ? 0 : visible.has(job.fileId) ? 1 : 2
  const ordered = [...jobs.values()].sort((a, b) => rank(a) - rank(b))
  const recover = async (job: RecoveryJob) => {
    const { fileId, document: doc } = job
    const startingDiskRevision = fileSaveCoordinator.getDiskRevision(fileId)
    try {
      const disk = doc.path ? await readStableFileSnapshot(doc.path, {
        reuseInFlight: true,
        scope,
        signal: controller.signal,
        priority: job.priority,
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) logger.error('Draft disk validation failed', error)
        return undefined
      }) : undefined
      const editor = useEditorStore.getState()
      const file = getFileObject(fileId)
      if (controller.signal.aborted || !editor.opened.includes(fileId) || !file ||
        file.path !== doc.path) return false
      if (fileSaveCoordinator.getDiskRevision(fileId) !== startingDiskRevision) return false

      // Never write the original content back after an asynchronous read.
      const content = editor.getEditorContent(fileId)
      if (doc.path && disk?.status !== 'success') updateFile({ id: fileId, path: undefined })
      const format = fileSaveCoordinator.getPersistedFormat(fileId)
      const dirty = !doc.path || disk?.status !== 'success' || disk.content !== content ||
        (!!format && !sameTextFormat(format, disk.text?.format ?? format))
      useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: dirty })
      if (doc.path && disk?.status === 'success') {
        fileSaveCoordinator.setSavedBaseline(fileId, disk)
        if (!dirty) fileSaveCoordinator.loadSnapshot(fileId, disk)
        else if (!format && disk.text) fileSaveCoordinator.recordFormat(fileId, disk.text.format, false)
        if (dirty && disk.revision !== doc.diskRevision)
          markExternalFileConflict(fileId, disk.revision)
      }
      for (const draft of job.nativeDrafts)
        await bindRecoveredDraft(fileId, { ...draft, content, format, diskRevision: doc.diskRevision })
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      job.release()
      if (!controller.signal.aborted && useEditorStore.getState().opened.includes(fileId)) {
        if (useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges)
          protectLocalEdit(fileId)
        else if (typeof getFileObject(fileId)?.content === 'string')
          void observeHistoryFile(fileId, getFileObject(fileId).content!).catch(onError)
      }
    }
  }
  for (const job of ordered) {
    job.priority = job.fileId === activeId ? 'foreground' : visible.has(job.fileId) ? 'visible' : job.priority
    job.ready = recover(job)
  }
  const visibleReady = Promise.all(
    ordered.filter((job) => visible.has(job.fileId)).map((job) => job.ready),
  ).then(() => undefined)
  const finished = Promise.all(ordered.map((job) => job.ready)).then(async () => {
    if (controller.signal.aborted) return 0
    // Retain original sources until every resulting document has durable protection.
    await flushDraftProtection()
    if (controller.signal.aborted) return 0
    let count = 0
    for (const [source, members] of sourceJobs) {
      if (!(await Promise.all(members.map((job) => job.ready))).every(Boolean)) continue
      if (!isTauri() || draftProtectionStarted()) await source.consume?.()
      count += source.session.documents.length
    }
    return count
  }).catch((error: unknown) => { onError(error); return 0 }).finally(cleanup)
  return { visibleReady, finished }
}
