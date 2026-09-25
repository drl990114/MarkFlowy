import { sameTextFormat } from '@/components/EditorArea/textFileFormat'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { nanoid } from 'nanoid'
import { markExternalFileConflict } from '@/components/EditorArea/externalFileChanges'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { promoteOpeningRead, readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
import { OpeningReadQueue, type OpeningReadPriority } from '@/components/EditorArea/openingReadQueue'
import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile, type IFile } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore, { type EditorLayoutNode } from '@/stores/useEditorStore'
import { afterStartupInteractive } from '@/startup/interactive'
import { markStartupStage } from '@/startup/performance'
import { removeReloadSnapshot, type DraftSessionStore } from './draft-recovery'
import {
  recoverySessionSchema, recoveryDocuments, nativeRecoveryDocument,
  RELOAD_SESSION_KEY, SESSION_KEY_PREFIX,
  type DraftDescriptor, type RecoveryDocument,
} from './draftSessionFormat'
import { registerDraftRecovery, isDraftRecoveryPending } from './draftRecoveryState'
import {
  bindRecoveredDraft, draftProtectionStarted, flushDraftProtection, historyCall,
  historyWorkspace, observeHistoryFile, protectLocalEdit, startDraftProtection,
  type HistoryDocument, type PersistedDraft,
} from './local-history'

interface RecoverySource {
  documents: RecoveryDocument[]
  activeId?: string
  native?: boolean
  consume?: () => Promise<void> | void
}
interface Candidate { document: RecoveryDocument; claimed?: PersistedDraft }
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
  original?: IFile
}

let activeRecovery: AbortController | undefined
export interface StagedDraftRecovery {
  /** The selected document only; other visible panes have their own recovery gate. */
  visibleReady: Promise<void>
  finished: Promise<number>
}

function visibleIds(layout: EditorLayoutNode): string[] {
  return layout.type === 'leaf' ? layout.activeId ? [layout.activeId] : [] : layout.children.flatMap(visibleIds)
}

async function readSources(cache: DraftSessionStore | undefined, reload: boolean) {
  const rootPath = useEditorStore.getState().getRootPath()
  const workspace = historyWorkspace()
  const readSource = async (name: string, read: () => Promise<RecoverySource[]>) => {
    markStartupStage(`draft-${name}-source-start`)
    try { return await read() } finally { markStartupStage(`draft-${name}-source-end`) }
  }
  const results = await Promise.allSettled([
    readSource('native', async () => {
      if (!isTauri()) return []
      const ownerPrefix = `${getCurrentWindow().label}:`
      const groups = await Promise.all([
        historyCall<DraftDescriptor[]>('recoveryDraftIndex', { workspace, ownerPrefix }),
        workspace ? historyCall<DraftDescriptor[]>('recoveryDraftIndex', { workspace: '', ownerPrefix }) : [],
      ])
      return groups.flat().map((draft) => ({ native: true, documents: [nativeRecoveryDocument(draft)] }))
    }),
    readSource('reload', async () => {
      const raw = reload ? window.sessionStorage.getItem(RELOAD_SESSION_KEY) : null
      if (!raw) return []
      const session = recoverySessionSchema.parse(JSON.parse(raw))
      if (session.rootPath && session.rootPath !== rootPath) return []
      return [{ documents: recoveryDocuments(session), activeId: session.activeId, consume: () => removeReloadSnapshot(raw) }]
    }),
    readSource('exit', async () => {
      if (!cache) return []
      const sources: RecoverySource[] = []
      for (const [key, value] of await cache.entries<unknown>()) {
        if (!key.startsWith(SESSION_KEY_PREFIX)) continue
        const parsed = recoverySessionSchema.safeParse(value)
        if (!parsed.success) { logger.error('Unrecognized draft session retained', key); continue }
        const session = parsed.data
        if (session.rootPath && session.rootPath !== rootPath) continue
        sources.push({
          documents: recoveryDocuments(session), activeId: session.activeId,
          consume: async () => { await cache.delete(key); await cache.save() },
        })
      }
      return sources
    }),
  ])
  const sources: RecoverySource[] = []
  const errors: unknown[] = []
  for (const result of results)
    if (result.status === 'fulfilled') sources.push(...result.value)
    else errors.push(result.reason)
  return { sources, errors }
}

/** Publish metadata first, then load/claim only the selected and visible documents.
 * Hidden work starts after first paint, or earlier when explicitly requested. */
export async function stageDraftRecovery({ cache, reload = false, signal, onError }: {
  cache?: DraftSessionStore; reload?: boolean; signal?: AbortSignal; onError: (error: unknown) => void
}): Promise<StagedDraftRecovery> {
  const initial = useEditorStore.getState()
  const rootPath = initial.getRootPath()
  const scope = {}
  const controller = new AbortController()
  activeRecovery?.abort()
  activeRecovery = controller
  const jobs = new Map<string, RecoveryJob>()
  const sourceJobs = new Map<RecoverySource, Set<RecoveryJob>>()
  const nativeJobs = new Map<string, RecoveryJob>()
  const consumed = new Set<RecoverySource>()
  const queue = new OpeningReadQueue<void>()
  let stopBackground = () => {}
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  const stopWorkspaceWatch = useEditorStore.subscribe((state) => {
    if (state.getRootPath() !== rootPath) abort()
  })
  const cleanup = () => {
    signal?.removeEventListener('abort', abort)
    stopWorkspaceWatch()
    stopBackground()
    if (activeRecovery === controller) activeRecovery = undefined
  }
  controller.signal.addEventListener('abort', () => {
    for (const job of jobs.values()) { job.release(); job.settle() }
    cleanup()
  }, { once: true })
  const { sources, errors } = await readSources(cache, reload)
  errors.forEach(onError)
  if (controller.signal.aborted) {
    cleanup()
    return { visibleReady: Promise.resolve(), finished: Promise.resolve(0) }
  }

  const canRestoreFocus = useEditorStore.getState().activeId === initial.activeId
  let preferredActiveId: string | undefined
  const snapshot = (job: RecoveryJob): RecoveryDocument => {
    const file = getFileObject(job.fileId)
    if (!job.published || !file) return job.document
    return {
      ...job.document, id: file.id, name: file.name, path: file.path,
      diskRevision: fileSaveCoordinator.getDiskRevision(file.id),
      format: fileSaveCoordinator.getPersistedFormat(file.id),
      source: { kind: 'inline', content: useEditorStore.getState().getEditorContent(file.id) },
    }
  }
  const publish = (job: RecoveryJob, content: string) => {
    updateFile({ id: job.fileId, content })
    job.published = true
    fileSaveCoordinator.recordContent(job.fileId, content)
    fileSaveCoordinator.recordFormat(job.fileId,
      job.document.format ?? fileSaveCoordinator.getTextMetadata(job.fileId).format, !!job.document.format)
    if (job.document.diskRevision) fileSaveCoordinator.setDiskRevision(job.fileId, job.document.diskRevision)
  }

  const materialize = async (job: RecoveryJob) => {
    let content: string | undefined
    let selected: RecoveryDocument | undefined
    const claims = new Map<string, PersistedDraft>()
    for (const candidate of job.candidates) {
      if (controller.signal.aborted) throw new DOMException('Draft recovery canceled.', 'AbortError')
      const source = candidate.document.source
      if (source.kind === 'inline') { content = source.content; selected = candidate.document }
      else if (source.kind === 'reload') {
        const raw = window.sessionStorage.getItem(source.key)
        if (raw === null) throw new Error('A reload draft body is unavailable.')
        const body: unknown = JSON.parse(raw)
        if (typeof body !== 'string') throw new Error('Invalid reload draft body.')
        content = body
        selected = candidate.document
      } else {
        const key = `${source.draft.document.id}:${source.draft.writer}:${source.draft.sequence}:${source.draft.hash}`
        let claimed = candidate.claimed ?? claims.get(key)
        if (!claimed) {
          source.claimId ??= nanoid()
          const claim = () => historyCall<PersistedDraft | null>('claimRecoveryDraft', {
            draft: source.draft, ownerPrefix: `${getCurrentWindow().label}:`, claimId: source.claimId,
          })
          try { claimed = await claim() ?? undefined } catch (error) {
            if (controller.signal.aborted || !String(error).includes('history_invalidated')) throw error
            const current = await historyCall<HistoryDocument>('document', { id: source.draft.document.id })
            const previous = source.draft.document
            if (current.id !== previous.id || current.workspace !== previous.workspace ||
              getPathIdentityKey(current.path ?? '') !== getPathIdentityKey(previous.path ?? '')) throw error
            // Clearing/disabling history advances its generation, but preserves drafts.
            // Refresh only that handle; the native transaction still verifies the exact
            // writer, sequence, hash, baseline, format and current liveness claim.
            source.draft = { ...source.draft, document: current }
            if (controller.signal.aborted) throw error
            claimed = await claim() ?? undefined
          }
        }
        // A stale manifest may name a writer already replaced by the indexed draft.
        // It cannot overwrite that newer body, or turn a sole missing reference into empty text.
        if (claimed) {
          candidate.claimed = claimed
          claims.set(key, claimed)
          content = claimed.content
          selected = {
            ...candidate.document, diskRevision: claimed.diskRevision ?? undefined, format: claimed.format ?? undefined,
            source: { kind: 'native', draft: {
              ...source.draft, document: claimed.document, writer: claimed.writer, sequence: claimed.sequence,
              diskRevision: claimed.diskRevision, format: claimed.format,
            } },
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

  const recover = async (job: RecoveryJob) => {
    const { fileId } = job
    const path = job.document.path
    const startingDiskRevision = fileSaveCoordinator.getDiskRevision(fileId)
    const startingRevision = fileSaveCoordinator.getRevision(fileId)
    const startingContent = getFileObject(fileId)?.content
    // Body IPC and disk validation are independent after workspace permissions are restored.
    const diskPromise = path ? readStableFileSnapshot(path, {
      reuseInFlight: true, scope, signal: controller.signal, priority: job.priority,
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) logger.error('Draft disk validation failed', error)
      return undefined
    }) : Promise.resolve(undefined)
    const [content, disk] = await Promise.all([materialize(job), diskPromise])
    const editor = useEditorStore.getState()
    const file = getFileObject(fileId)
    if (controller.signal.aborted || !editor.opened.includes(fileId) || !file || file.path !== path)
      throw new DOMException('Draft recovery canceled.', 'AbortError')
    if (fileSaveCoordinator.getDiskRevision(fileId) !== startingDiskRevision)
      throw new Error('The document changed while its draft was being recovered.')
    if (!job.published && (fileSaveCoordinator.getRevision(fileId) !== startingRevision || file.content !== startingContent))
      throw new Error('The document was edited before its draft was loaded.')
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
    const dirty = !path || disk?.status !== 'success' || disk.content !== latest ||
      (!!format && !sameTextFormat(format, disk.text?.format ?? format))
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: dirty })
    if (path && disk?.status === 'success') {
      fileSaveCoordinator.setSavedBaseline(fileId, disk)
      if (!dirty) fileSaveCoordinator.loadSnapshot(fileId, disk)
      else if (!format && disk.text) fileSaveCoordinator.recordFormat(fileId, disk.text.format, false)
      if (dirty && disk.revision !== job.document.diskRevision) markExternalFileConflict(fileId, disk.revision)
    }
    const bound = new Set<string>()
    for (const candidate of job.candidates) {
      const draft = candidate.claimed
      if (!draft || bound.has(draft.writer)) continue
      await bindRecoveredDraft(fileId, { ...draft, content: latest, format, diskRevision: job.document.diskRevision })
      bound.add(draft.writer)
    }
    job.succeeded = true
    job.release()
    if (dirty) protectLocalEdit(fileId)
    else void observeHistoryFile(fileId, latest).catch(onError)
  }

  let finalization = Promise.resolve(0)
  const finalize = () => {
    finalization = finalization.then(async () => {
      if (controller.signal.aborted) return 0
      await flushDraftProtection()
      if (controller.signal.aborted) return 0
      for (const [source, members] of sourceJobs) {
        if (consumed.has(source) || ![...members].every((job) => job.succeeded || job.unavailable)) continue
        if (!isTauri() || draftProtectionStarted()) { await source.consume?.(); consumed.add(source) }
      }
      return [...jobs.values()].filter((job) => job.succeeded).length
    }).catch((error: unknown) => { onError(error); return 0 })
    return finalization
  }
  let initialFinished = false
  const start = (job: RecoveryJob, priority: OpeningReadPriority): Promise<void> => {
    if (job.succeeded || job.unavailable) return Promise.resolve()
    if (priority === 'foreground' || job.priority === 'background') job.priority = priority
    queue.promote(job.fileId, scope, job.priority)
    if (job.document.path) promoteOpeningRead(job.document.path, scope, job.priority)
    if (!job.ready) {
      job.ready = queue.read(job.fileId, () => recover(job), { scope, signal: controller.signal, priority: job.priority })
        .catch((error: unknown) => {
          job.ready = undefined
          if (!controller.signal.aborted) onError(error)
          // Keep the pending gate and source; retry and close must never see a placeholder as text.
          throw error
        }).finally(() => {
          job.settle()
          if (initialFinished && (job.succeeded || job.unavailable)) void finalize().then(() => {
            if (![...jobs.values()].some((item) => isDraftRecoveryPending(item.fileId))) cleanup()
          })
        })
    }
    return job.ready
  }

  try {
    for (const source of sources) {
      const members = new Set<RecoveryJob>()
      sourceJobs.set(source, members)
      for (const doc of source.documents) {
        let path = doc.path
        const nativeKey = doc.source.kind === 'native' ? `${doc.source.draft.document.id}:${doc.source.draft.writer}` : undefined
        const existing = path ? getFileObjectByPath(path) : undefined
        const prior = nativeKey && nativeJobs.get(nativeKey) || existing && jobs.get(existing.id)
        const inline = doc.source.kind === 'inline' ? doc.source.content : undefined
        if (existing && useEditorStateStore.getState().idStateMap.get(existing.id)?.hasUnsavedChanges &&
          (!prior || prior.published) && existing.content !== inline) path = undefined
        // Distinct native writers retain independent versions even when they share a path.
        if (source.native && prior && nativeKey && !nativeJobs.has(nativeKey)) path = undefined
        const file = nativeKey && nativeJobs.has(nativeKey)
          ? getFileObject(nativeJobs.get(nativeKey)!.fileId)!
          : path && existing ? existing : createFile({ name: doc.name, content: undefined, path, ext: doc.ext ?? 'md' })
        let job = jobs.get(file.id)
        if (!job) {
          let settle!: () => void
          job = {
            fileId: file.id, document: { ...doc, path: file.path }, candidates: [],
            priority: 'background', published: false, release: () => {},
            firstAttempt: new Promise<void>((done) => { settle = done }), settle: () => settle(), succeeded: false,
            unavailable: false, original: file === existing ? { ...file } : undefined,
          }
          const registered = job
          job.release = registerDraftRecovery(file.id, (priority) => start(registered, priority), () => snapshot(registered))
          jobs.set(file.id, job)
        }
        job.document = { ...doc, path: file.path }
        job.candidates.push({ document: job.document })
        if (nativeKey) nativeJobs.set(nativeKey, job)
        members.add(job)
        if (inline !== undefined) publish(job, inline)
        useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
        if (!useEditorStore.getState().opened.includes(file.id)) useEditorStore.getState().addOpenedFile(file.id)
        if (source.activeId === doc.id) preferredActiveId = file.id
      }
    }
    const active = preferredActiveId || useEditorStore.getState().activeId || jobs.keys().next().value
    if (active && canRestoreFocus && active !== useEditorStore.getState().activeId) useEditorStore.getState().setActiveId(active)
    await startDraftProtection().catch(onError)
  } catch (error) { abort(); throw error }

  const activeId = useEditorStore.getState().activeId
  const visible = new Set(visibleIds(useEditorStore.getState().editorLayout))
  const ordered = [...jobs.values()].sort((a, b) => Number(b.fileId === activeId) - Number(a.fileId === activeId))
  for (const job of ordered) {
    if (job.fileId === activeId || visible.has(job.fileId))
      void start(job, job.fileId === activeId ? 'foreground' : 'visible').catch(() => undefined)
  }
  stopBackground = afterStartupInteractive(() => {
    for (const job of ordered) if (!job.ready && !job.succeeded && !job.unavailable)
      void start(job, 'background').catch(() => undefined)
  }, { signal: controller.signal })
  const visibleReady = jobs.get(activeId ?? '')?.firstAttempt ?? Promise.resolve()
  const finished = Promise.all(ordered.map((job) => job.firstAttempt)).then(async () => {
    initialFinished = true
    const count = await finalize()
    if (![...jobs.values()].some((job) => isDraftRecoveryPending(job.fileId))) cleanup()
    return count
  })
  return { visibleReady, finished }
}
