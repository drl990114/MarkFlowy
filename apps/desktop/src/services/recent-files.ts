import useFileCacheStore, { getFileObject } from '@/helper/files'
import useEditorStore from '@/stores/useEditorStore'
import useRecentFilesStore, { type RecentFile } from '@/stores/useRecentFilesStore'
import { getPathIdentityKey } from '@/helper/pathIdentity'

function openedHistory(): RecentFile[] {
  const { opened, activeId } = useEditorStore.getState()
  const ids = activeId ? [activeId, ...opened.filter((id) => id !== activeId)] : opened
  return ids.flatMap((id) => {
    const file = getFileObject(id)
    return file?.kind === 'file' ? [{ path: file.path, fileId: id }] : []
  })
}

/** Restore the layout and history as one synchronous publication to persistence. */
export function restoreRecentFileHistory(
  restoreEditor: () => void,
  entries?: readonly RecentFile[],
): void {
  const previous = useRecentFilesStore.getState()
  useRecentFilesStore.setState({ restoring: true })
  try {
    restoreEditor()
    const opened = openedHistory()
    const fileIds = new Map(
      opened.flatMap((file) =>
        file.path ? [[getPathIdentityKey(file.path), file.fileId] as const] : [],
      ),
    )
    useRecentFilesStore
      .getState()
      .replaceEntries(
        entries?.map((entry) =>
          entry.path
            ? { ...entry, fileId: fileIds.get(getPathIdentityKey(entry.path)) ?? entry.fileId }
            : entry,
        ) ?? opened,
      )
    useRecentFilesStore.setState({
      rootPath: useEditorStore.getState().getRootPath(),
      restoring: false,
    })
  } catch (error) {
    useRecentFilesStore.setState({
      entries: previous.entries,
      rootPath: previous.rootPath,
      restoring: false,
    })
    throw error
  }
}

/** One application-owned subscription, independent of Quick Open's mount lifetime. */
export function startRecentFileTracking(): () => void {
  const initial = useEditorStore.getState()
  if (useRecentFilesStore.getState().rootPath !== initial.getRootPath()) {
    useRecentFilesStore.setState({ rootPath: initial.getRootPath(), entries: [] })
  }
  const visitActive = () => {
    const file = getFileObject(useEditorStore.getState().activeId ?? '')
    if (file?.kind === 'file') {
      useRecentFilesStore.getState().visit({ path: file.path, fileId: file.id })
    }
  }
  if (useRecentFilesStore.getState().entries.length === 0) visitActive()

  const unsubscribeEditor = useEditorStore.subscribe((state, previous) => {
    if (useRecentFilesStore.getState().restoring) return
    const rootPath = state.getRootPath()
    if (rootPath !== useRecentFilesStore.getState().rootPath) {
      useRecentFilesStore.setState({ rootPath, entries: [] })
    }
    if (state.opened !== previous.opened) {
      const opened = new Set(state.opened)
      const history = useRecentFilesStore.getState()
      history.replaceEntries(
        history.entries.filter((entry) => entry.path || (entry.fileId && opened.has(entry.fileId))),
      )
    }
    if (state.activeId !== previous.activeId || state.activeGroupId !== previous.activeGroupId) {
      visitActive()
    }
  })
  const unsubscribeMetadata = useFileCacheStore.subscribe((state, previous) => {
    const history = useRecentFilesStore.getState()
    if (history.restoring || state.metadataRevision === previous.metadataRevision) return
    // Save As and cached file metadata changes keep the visit's original position.
    history.replaceEntries(
      history.entries.map((entry) => {
        const file = entry.fileId ? state.entries[entry.fileId] : undefined
        return file?.kind === 'file' ? { path: file.path, fileId: file.id } : entry
      }),
    )
  })
  return () => {
    unsubscribeEditor()
    unsubscribeMetadata()
  }
}
