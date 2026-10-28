import type { LazyStore } from '@tauri-apps/plugin-store'
import { z } from 'zod'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import useEditorStore, { type EditorLayoutNode } from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { captureProtectedDraftSession } from './draft-recovery'
import { recoveryDocuments, recoverySessionSchema } from './draftSessionFormat'
import { isPristineDocument } from './pristine-document'

export const LAST_WINDOW_SESSION_KEY = 'window-session:last-active'
const RELOAD_WINDOW_KEY = 'window-session:current-window'
export const windowSessionKey = (label: string) => `window-session:v1:${label}`
const layoutSchema: z.ZodType<EditorLayoutNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('leaf'),
      id: z.string(),
      opened: z.array(z.string()),
      activeId: z.string().optional(),
      previewId: z.string().optional(),
    }),
    z.object({
      type: z.literal('branch'),
      id: z.string(),
      direction: z.enum(['horizontal', 'vertical']),
      sizes: z.array(z.number()),
      children: z.array(layoutSchema),
    }),
  ]),
)
export const windowSessionSchema = z.object({
  version: z.literal(1),
  windowLabel: z.string(),
  rootPath: z.string().optional(),
  files: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      path: z.string().optional(),
      ext: z.string().optional(),
    }),
  ),
  editorLayout: layoutSchema,
  activeGroupId: z.string().optional(),
  drafts: recoverySessionSchema,
})
export type WindowSession = z.infer<typeof windowSessionSchema>
type SessionStore = Pick<LazyStore, 'get' | 'set' | 'save'>

export const isWindowSessionReload = (label: string) =>
  sessionStorage.getItem(RELOAD_WINDOW_KEY) === label

export async function readWindowSession(
  store: SessionStore,
  label: string,
  restoreSessionLabel?: string | null,
) {
  // A WebView reload keeps its own latest snapshot. Cold launches instead use
  // the native app-session list; null explicitly starts an empty window.
  const key = isWindowSessionReload(label)
    ? windowSessionKey(label)
    : restoreSessionLabel === null
      ? undefined
      : restoreSessionLabel !== undefined
        ? windowSessionKey(restoreSessionLabel)
        : label === 'main'
          ? await store.get<string>(LAST_WINDOW_SESSION_KEY)
          : windowSessionKey(label)
  if (!key) return undefined
  const parsed = windowSessionSchema.safeParse(await store.get(key))
  return parsed.success ? parsed.data : undefined
}

export function restoreWindowDocuments(session: WindowSession) {
  // Draft placeholders are gated by staged recovery before the editor mounts.
  for (const file of session.files) createFile({ ...file, content: undefined })
  const drafts = recoveryDocuments(session.drafts)
  const draftIds = new Set(drafts.map((file) => file.id))
  const draftPaths = new Set(drafts.flatMap((file) => file.path ? [getPathIdentityKey(file.path)] : []))
  for (const file of session.files) {
    if (file.path && draftPaths.has(getPathIdentityKey(file.path))) draftIds.add(file.id)
  }
  useEditorStore
    .getState()
    .setEditorLayout(
      filterSessionLayout(session.editorLayout, new Set(session.files.map((file) => file.id)), draftIds),
      session.activeGroupId,
    )
}

export function filterSessionLayout(
  node: EditorLayoutNode,
  ids: ReadonlySet<string>,
  permanentIds: ReadonlySet<string> = new Set(),
): EditorLayoutNode {
  if (node.type === 'branch')
    return { ...node, children: node.children.map((child) => filterSessionLayout(child, ids, permanentIds)) }
  const opened = node.opened.filter((id) => ids.has(id))
  return {
    ...node,
    opened,
    activeId: node.activeId && ids.has(node.activeId) ? node.activeId : opened[0],
    previewId: node.previewId && opened.includes(node.previewId) && !permanentIds.has(node.previewId)
      ? node.previewId
      : undefined,
  }
}

export function createWindowSessionPersistence(store: SessionStore, windowLabel: string) {
  sessionStorage.setItem(RELOAD_WINDOW_KEY, windowLabel)
  let timer: ReturnType<typeof setTimeout> | undefined
  let tail = Promise.resolve()
  let disposed = false
  let focused = document.hasFocus()
  const key = windowSessionKey(windowLabel)
  const save = async (): Promise<void> => {
    const initial = useEditorStore.getState()
    const rootPath = initial.folderData?.[0]?.path
    const metadataRevision = useFileCacheStore.getState().metadataRevision
    const dirtyStates = useEditorStateStore.getState().idStateMap
    const drafts = await captureProtectedDraftSession()
    const state = useEditorStore.getState()
    if (
      state.editorLayout !== initial.editorLayout ||
      state.folderData?.[0]?.path !== rootPath ||
      state.activeGroupId !== initial.activeGroupId ||
      useEditorStateStore.getState().idStateMap !== dirtyStates ||
      useFileCacheStore.getState().metadataRevision !== metadataRevision
    )
      return save()
    const files = state.opened.flatMap((id) => {
      const file = getFileObject(id)
      if (!file || file.kind !== 'file' || isPristineDocument(id)) return []
      return [{ id, name: file.name, path: file.path, ext: file.ext }]
    })
    const session: WindowSession = {
      version: 1,
      windowLabel,
      rootPath: state.getRootPath(),
      files,
      editorLayout: filterSessionLayout(state.editorLayout, new Set(files.map((file) => file.id))),
      activeGroupId: state.activeGroupId,
      drafts,
    }
    await store.set(key, session)
    if (focused || !(await store.get(LAST_WINDOW_SESSION_KEY)))
      await store.set(LAST_WINDOW_SESSION_KEY, key)
    await store.save()
  }
  const flush = () => {
    clearTimeout(timer)
    tail = tail.catch(() => undefined).then(save)
    return tail
  }
  const schedule = () => {
    if (disposed) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      void flush().catch((error) => logger.error('Failed to preserve window session', error))
    }, 800)
  }
  const unsubscribe = useEditorStore.subscribe((state, previous) => {
    if (
      state.editorLayout !== previous.editorLayout ||
      state.activeGroupId !== previous.activeGroupId ||
      state.folderData?.[0]?.path !== previous.folderData?.[0]?.path
    )
      schedule()
  })
  const unsubscribeFiles = useFileCacheStore.subscribe((state, previous) => {
    if (state.metadataRevision !== previous.metadataRevision) schedule()
  })
  const unsubscribeDirty = useEditorStateStore.subscribe(schedule)
  const focus = () => {
    focused = true
    schedule()
  }
  const blur = () => {
    focused = false
  }
  window.addEventListener('focus', focus)
  window.addEventListener('blur', blur)
  schedule()
  return {
    flush,
    dispose: async () => {
      disposed = true
      clearTimeout(timer)
      unsubscribe()
      unsubscribeFiles()
      unsubscribeDirty()
      window.removeEventListener('focus', focus)
      window.removeEventListener('blur', blur)
      await tail.catch((error) =>
        logger.error('Failed to finish window session persistence', error),
      )
    },
  }
}
