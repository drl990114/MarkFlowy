import type { ContextMenuItem, IFile, IHeadingData } from '@markflowy/interface'
import { fileTreeHandler, showContextMenu } from '@markflowy/interface'
import {
  createWorkspaceAdapter,
  type WorkspaceAdapter,
  workspaceRequiresAuthentication,
} from 'adapters'
import {
  getRemoteWorkspaceErrorMessage,
  type RemoteWorkspaceRef,
} from 'features/workspace/services/remoteWorkspaceService'
import { useAuth } from 'hooks/useAuth'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MenuItemData } from 'zens'

export type ViewType = 'wysiwyg' | 'source' | 'preview'

export interface FileState {
  content: string
  savedContent: string
  version?: string
  isDirty: boolean
}

export type SaveStatus = 'idle' | 'saving' | 'saved'

export function normalizeWorkspaceIdParam(id?: string | string[]) {
  if (Array.isArray(id)) {
    return id.filter(Boolean).join('/')
  }
  return id || ''
}

const extractHeadingsForFile = (content: string, fileId: string): IHeadingData[] => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: IHeadingData[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const depth = match[1].length
    const value = match[2].trim()
    const headingId = `heading-${fileId}-${headings.length}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

    headings.push({
      depth,
      value,
      id: headingId,
      htmlNode: null,
      onClick: (headingItem) => {
        const element = document.getElementById(headingItem.id)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      },
    })
  }

  return headings
}

const findFirstFile = (items: IFile[]): IFile | undefined => {
  for (const item of items) {
    if (item.kind === 'file') return item
    if (item.children) {
      const found = findFirstFile(item.children)
      if (found) return found
    }
  }
  return undefined
}

export function useWorkspaceState(id: string) {
  const { loading: authLoading, isAuthenticated } = useAuth(false)

  const [adapter, setAdapter] = useState<WorkspaceAdapter | null>(null)
  const [viewType, setViewType] = useState<ViewType>('wysiwyg')
  const [headingsDataMap, setHeadingsDataMap] = useState<Record<string, IHeadingData[]>>({})
  const [folderData, setFolderData] = useState<IFile[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [opened, setOpened] = useState<string[]>([])
  const [fileStateMap, setFileStateMap] = useState<Record<string, FileState>>({})
  const [isClient, setIsClient] = useState(false)
  const [loadingTree, setLoadingTree] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState('')
  const [refs, setRefs] = useState<RemoteWorkspaceRef[]>([])
  const [currentRef, setCurrentRef] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('Update via MarkFlowy')
  const treeLoadVersionRef = useRef(0)
  const fileLoadVersionRef = useRef(0)
  const saveVersionRef = useRef(0)
  const workspaceContextVersionRef = useRef(0)
  const fileStateMapRef = useRef(fileStateMap)
  fileStateMapRef.current = fileStateMap

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!id || authLoading) return

    const contextVersion = ++workspaceContextVersionRef.current
    treeLoadVersionRef.current += 1
    fileLoadVersionRef.current += 1
    saveVersionRef.current += 1
    fileTreeHandler.clearLoadedDirsCache?.()
    setAdapter(null)
    setFolderData([])
    setActiveId('')
    setOpened([])
    setFileStateMap({})
    setHeadingsDataMap({})
    setRefs([])
    setCurrentRef(null)
    setLoadingFile(false)
    setSaveStatus('idle')

    if (workspaceRequiresAuthentication(id) && !isAuthenticated) {
      setLoadingTree(false)
      setError('Sign in to open this workspace.')
      return
    }

    let cancelled = false
    setLoadingTree(true)
    setError('')

    const initAdapter = async () => {
      try {
        const newAdapter = await createWorkspaceAdapter(id)

        if (cancelled || contextVersion !== workspaceContextVersionRef.current) return

        setAdapter(newAdapter)
        setCurrentRef(newAdapter.type === 'remote' ? newAdapter.defaultRef : null)
      } catch (caughtError) {
        if (cancelled || contextVersion !== workspaceContextVersionRef.current) return

        setLoadingTree(false)
        setError(getRemoteWorkspaceErrorMessage(caughtError, 'Failed to open workspace'))
      }
    }

    void initAdapter()

    return () => {
      cancelled = true
      workspaceContextVersionRef.current += 1
      treeLoadVersionRef.current += 1
      fileLoadVersionRef.current += 1
      saveVersionRef.current += 1
    }
  }, [authLoading, id, isAuthenticated])

  useEffect(() => {
    if (!adapter) return

    let cancelled = false
    const contextVersion = workspaceContextVersionRef.current
    const loadVersion = ++treeLoadVersionRef.current

    const isCurrentLoad = () =>
      !cancelled &&
      contextVersion === workspaceContextVersionRef.current &&
      loadVersion === treeLoadVersionRef.current

    const load = async () => {
      setLoadingTree(true)
      setError('')

      try {
        if (adapter.type === 'local') {
          const files = await adapter.loadTree()
          if (!isCurrentLoad()) return

          setFolderData(files)
          const firstFile = findFirstFile(files)
          if (!firstFile) return

          const { content, version } = await adapter.loadFileContent(firstFile)
          if (!isCurrentLoad()) return

          setActiveId(firstFile.id)
          setOpened([firstFile.id])
          setFileStateMap({
            [firstFile.id]: { content, savedContent: content, version, isDirty: false },
          })
          setHeadingsDataMap({
            [firstFile.id]: extractHeadingsForFile(content, firstFile.id),
          })
          return
        }

        const ref = adapter.defaultRef
        const refsPromise = adapter.capabilities.refs ? adapter.getRefs() : Promise.resolve([])
        const [files, remoteRefs] = await Promise.all([adapter.loadTree(ref), refsPromise])
        if (!isCurrentLoad()) return

        setFolderData(files)
        setRefs(remoteRefs)
        setCurrentRef(ref)
      } catch (caughtError) {
        if (isCurrentLoad()) {
          setError(getRemoteWorkspaceErrorMessage(caughtError, 'Failed to load workspace tree'))
        }
      } finally {
        if (isCurrentLoad()) {
          setLoadingTree(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [adapter])

  const getFileObject = useCallback(
    (fileId: string): IFile | undefined => {
      const findInFolder = (items: IFile[]): IFile | undefined => {
        for (const item of items) {
          if (item.id === fileId) return item
          if (item.children) {
            const found = findInFolder(item.children)
            if (found) return found
          }
        }
        return undefined
      }
      return findInFolder(folderData)
    },
    [folderData],
  )

  const getFileObjectByPath = useCallback(
    (path: string): IFile | undefined => {
      const findInFolder = (items: IFile[]): IFile | undefined => {
        for (const item of items) {
          if (item.path === path) return item
          if (item.children) {
            const found = findInFolder(item.children)
            if (found) return found
          }
        }
        return undefined
      }
      return findInFolder(folderData)
    },
    [folderData],
  )

  const loadFileContent = useCallback(
    async (file: IFile) => {
      if (!adapter || !file.path) return

      const fileId = file.id
      const loadVersion = ++fileLoadVersionRef.current
      const contextVersion = workspaceContextVersionRef.current
      const isCurrentLoad = () =>
        loadVersion === fileLoadVersionRef.current &&
        contextVersion === workspaceContextVersionRef.current

      setActiveId(fileId)
      setOpened((previous) => (previous.includes(fileId) ? previous : [...previous, fileId]))

      if (fileStateMapRef.current[fileId]) {
        setLoadingFile(false)
        return
      }

      setLoadingFile(true)
      setError('')

      try {
        const { content, version } = await adapter.loadFileContent(
          file,
          adapter.type === 'remote' ? currentRef : null,
        )
        if (!isCurrentLoad()) return

        setFileStateMap((previous) => ({
          ...previous,
          [fileId]: { content, savedContent: content, version, isDirty: false },
        }))
        setHeadingsDataMap((previous) => ({
          ...previous,
          [fileId]: extractHeadingsForFile(content, fileId),
        }))
      } catch (caughtError) {
        if (isCurrentLoad()) {
          setError(getRemoteWorkspaceErrorMessage(caughtError, 'Failed to load file content'))
        }
      } finally {
        if (isCurrentLoad()) {
          setLoadingFile(false)
        }
      }
    },
    [adapter, currentRef],
  )

  const handleSelect = useCallback(
    (file: IFile | undefined) => {
      if (file?.kind === 'file') {
        void loadFileContent(file)
      }
    },
    [loadFileContent],
  )

  const handleChange = useCallback((fileId: string, newContent: string) => {
    setSaveStatus('idle')
    setFileStateMap((previous) => {
      const current = previous[fileId]
      if (!current) return previous
      return {
        ...previous,
        [fileId]: {
          ...current,
          content: newContent,
          isDirty: newContent !== current.savedContent,
        },
      }
    })

    setHeadingsDataMap((previous) => ({
      ...previous,
      [fileId]: extractHeadingsForFile(newContent, fileId),
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!adapter?.capabilities.write || !adapter.saveFiles) return

    const snapshots = Object.entries(fileStateMapRef.current).flatMap(([fileId, fileState]) => {
      if (!fileState.isDirty) return []

      const file = getFileObject(fileId)
      if (!file?.path) return []

      return [
        {
          fileId,
          file,
          content: fileState.content,
          version: fileState.version,
        },
      ]
    })

    if (snapshots.length === 0) return

    const saveVersion = ++saveVersionRef.current
    const contextVersion = workspaceContextVersionRef.current
    const isCurrentSave = () =>
      saveVersion === saveVersionRef.current &&
      contextVersion === workspaceContextVersionRef.current

    setSaveStatus('saving')
    setError('')

    try {
      const result = await adapter.saveFiles(
        snapshots.map(({ file, content, version }) => ({ file, content, version })),
        {
          message: commitMessage || 'Update via MarkFlowy',
          ref: adapter.type === 'remote' ? currentRef : null,
        },
      )
      if (!isCurrentSave()) return

      const versionsByPath = new Map(result.files.map((file) => [file.path, file.version]))
      const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.fileId, snapshot]))
      const changedDuringSave = snapshots.some(
        (snapshot) => fileStateMapRef.current[snapshot.fileId]?.content !== snapshot.content,
      )

      setFileStateMap((previous) => {
        let changed = false
        const next = { ...previous }

        for (const [fileId, snapshot] of snapshotsById) {
          const current = previous[fileId]
          if (!current) continue

          changed = true
          next[fileId] = {
            ...current,
            savedContent: snapshot.content,
            version: versionsByPath.get(snapshot.file.path || '') ?? current.version,
            isDirty: current.content !== snapshot.content,
          }
        }

        return changed ? next : previous
      })

      setSaveStatus(changedDuringSave ? 'idle' : 'saved')
    } catch (caughtError) {
      if (isCurrentSave()) {
        setSaveStatus('idle')
        setError(getRemoteWorkspaceErrorMessage(caughtError, 'Failed to save staged files'))
      }
    }
  }, [adapter, commitMessage, currentRef, getFileObject])

  const handleShowConfirm = ({ title, onConfirm }: { title: string; onConfirm: () => void }) => {
    if (confirm(title)) {
      onConfirm()
    }
  }

  const handleShowContextMenu = ({
    x,
    y,
    items,
  }: {
    x: number
    y: number
    items: ContextMenuItem[]
  }) => {
    const menuItems: MenuItemData[] = items.map((item) => ({
      label: item.label,
      value: item.value,
      handler: item.handler,
    }))
    showContextMenu({ x, y, items: menuItems })
  }

  const currentHeadings = headingsDataMap[activeId] || []

  const currentFileName = useMemo(() => {
    const file = getFileObject(activeId)
    return file?.name || 'Untitled'
  }, [activeId, getFileObject])

  const currentFileState = fileStateMap[activeId]
  const stagedFiles = useMemo(
    () =>
      opened.flatMap((fileId) => {
        if (!fileStateMap[fileId]?.isDirty) return []
        const file = getFileObject(fileId)
        return file ? [{ file, fileId }] : []
      }),
    [fileStateMap, getFileObject, opened],
  )
  const saving = saveStatus === 'saving'

  const handleRefChange = useCallback(
    (ref: string) => {
      if (
        !adapter ||
        adapter.type !== 'remote' ||
        !adapter.capabilities.refs ||
        ref === currentRef
      ) {
        return
      }

      const hasUnsavedChanges = Object.values(fileStateMapRef.current).some((file) => file.isDirty)
      if (
        hasUnsavedChanges &&
        !confirm('You have unsaved changes. Switch refs and discard them?')
      ) {
        return
      }

      workspaceContextVersionRef.current += 1
      fileLoadVersionRef.current += 1
      saveVersionRef.current += 1
      const contextVersion = workspaceContextVersionRef.current
      const loadVersion = ++treeLoadVersionRef.current
      setLoadingFile(false)
      setSaveStatus('idle')
      setLoadingTree(true)
      setError('')

      void adapter
        .loadTree(ref)
        .then((files) => {
          if (
            loadVersion !== treeLoadVersionRef.current ||
            contextVersion !== workspaceContextVersionRef.current
          ) {
            return
          }
          fileTreeHandler.clearLoadedDirsCache?.()
          setFolderData(files)
          setCurrentRef(ref)
          setFileStateMap({})
          setHeadingsDataMap({})
          setActiveId('')
          setOpened([])
        })
        .catch((caughtError) => {
          if (
            loadVersion !== treeLoadVersionRef.current ||
            contextVersion !== workspaceContextVersionRef.current
          ) {
            return
          }
          setError(getRemoteWorkspaceErrorMessage(caughtError, 'Failed to load ref'))
        })
        .finally(() => {
          if (
            loadVersion === treeLoadVersionRef.current &&
            contextVersion === workspaceContextVersionRef.current
          ) {
            setLoadingTree(false)
          }
        })
    },
    [adapter, currentRef],
  )

  const handleReadSubdirectory = useCallback(
    async (folderPath: string): Promise<IFile[]> => {
      const currentAdapter = adapter
      if (!currentAdapter?.loadSubdirectory) return []

      const contextVersion = workspaceContextVersionRef.current
      const children = await currentAdapter.loadSubdirectory(
        folderPath,
        currentAdapter.type === 'remote' ? currentRef : null,
      )

      return contextVersion === workspaceContextVersionRef.current ? children : []
    },
    [adapter, currentRef],
  )

  return {
    authLoading,
    isAuthenticated,
    adapter,
    viewType,
    setViewType,
    folderData,
    setFolderData,
    activeId,
    setActiveId,
    opened,
    fileStateMap,
    isClient,
    loadingTree,
    loadingFile,
    saving,
    error,
    refs,
    currentRef,
    canWrite: Boolean(!loadingTree && adapter?.capabilities.write && adapter.saveFiles),
    commitMessage,
    setCommitMessage,
    saveStatus,
    stagedFiles,
    handleSelect,
    handleChange,
    handleSave,
    handleShowConfirm,
    handleShowContextMenu,
    handleRefChange,
    handleReadSubdirectory,
    getFileObject,
    getFileObjectByPath,
    currentHeadings,
    currentFileName,
    currentFileState,
  }
}
