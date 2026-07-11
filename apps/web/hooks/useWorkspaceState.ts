import type { ContextMenuItem, IFile, IHeadingData } from '@markflowy/interface'
import { fileTreeHandler, showContextMenu } from '@markflowy/interface'
import { createAdapterFromId, createServerWorkspaceAdapter, type WorkspaceAdapter } from 'adapters'
import { getGitHubWorkspaceErrorMessage } from 'features/githubWorkspace/services/workspaceGitHubService'
import { useAuth } from 'hooks/useAuth'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MenuItemData } from 'zens'

export type ViewType = 'wysiwyg' | 'source' | 'preview'

export interface FileState {
  content: string
  sha?: string
  isDirty: boolean
}

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [commitMessage, setCommitMessage] = useState('Update via MarkFlowy')
  const treeLoadVersionRef = useRef(0)

  const findFirstFile = useCallback((items: IFile[]): IFile | undefined => {
    for (const item of items) {
      if (item.kind === 'file') return item
      if (item.children) {
        const found = findFirstFile(item.children)
        if (found) return found
      }
    }
    return undefined
  }, [])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!id || authLoading) return

    if (id !== 'demo-workspace' && !isAuthenticated) {
      setAdapter(null)
      setError('Sign in to open this workspace.')
      return
    }

    let cancelled = false

    const initAdapter = async () => {
      try {
        const newAdapter =
          id === 'demo-workspace' ? createAdapterFromId(id) : await createServerWorkspaceAdapter(id)

        if (cancelled) return

        treeLoadVersionRef.current += 1
        fileTreeHandler.clearLoadedDirsCache?.()
        setAdapter(newAdapter)
        setFolderData([])
        setActiveId('')
        setOpened([])
        setFileStateMap({})
        setHeadingsDataMap({})
        setBranches([])
        setCurrentBranch(newAdapter.getCurrentBranch?.() || '')
        setError('')
      } catch (caughtError) {
        if (cancelled) return

        setAdapter(null)
        setFolderData([])
        setError(getGitHubWorkspaceErrorMessage(caughtError, 'Failed to open workspace'))
      }
    }

    void initAdapter()

    return () => {
      cancelled = true
      treeLoadVersionRef.current += 1
    }
  }, [authLoading, id, isAuthenticated])

  useEffect(() => {
    if (!adapter) return
    if (adapter.requiresAuth && authLoading) return

    if (adapter.requiresAuth && !isAuthenticated) {
      setError('Sign in to open this workspace.')
      setLoadingTree(false)
      setLoadingFile(false)
      return
    }

    let cancelled = false
    const loadVersion = ++treeLoadVersionRef.current

    const load = async () => {
      setLoadingTree(true)
      setError('')

      try {
        if (adapter.type === 'local') {
          const files = await adapter.loadTree()
          if (cancelled || loadVersion !== treeLoadVersionRef.current) return

          setFolderData(files)
          const firstFile = findFirstFile(files)
          if (!firstFile) return

          const { content } = await adapter.loadFileContent(firstFile)
          if (cancelled || loadVersion !== treeLoadVersionRef.current) return

          setActiveId(firstFile.id)
          setOpened([firstFile.id])
          setFileStateMap({ [firstFile.id]: { content, isDirty: false } })
          setHeadingsDataMap({
            [firstFile.id]: extractHeadingsForFile(content, firstFile.id),
          })
          return
        }

        if (adapter.loadTreeWithBranches) {
          const { branch, branches: branchList, files } = await adapter.loadTreeWithBranches()
          if (cancelled || loadVersion !== treeLoadVersionRef.current) return

          setFolderData(files)
          setBranches(branchList)
          setCurrentBranch(branch)
          return
        }

        const files = await adapter.loadTree()
        if (cancelled || loadVersion !== treeLoadVersionRef.current) return

        setFolderData(files)
        if (adapter.getBranches) {
          const branchList = await adapter.getBranches()
          if (cancelled || loadVersion !== treeLoadVersionRef.current) return

          setBranches(branchList)
          setCurrentBranch(adapter.getCurrentBranch?.() || branchList[0] || '')
        }
      } catch (caughtError) {
        if (!cancelled && loadVersion === treeLoadVersionRef.current) {
          setError(getGitHubWorkspaceErrorMessage(caughtError, 'Failed to load workspace tree'))
        }
      } finally {
        if (!cancelled && loadVersion === treeLoadVersionRef.current) {
          setLoadingTree(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [adapter, authLoading, findFirstFile, isAuthenticated])

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

      if (fileStateMap[fileId]) {
        setActiveId(fileId)
        setOpened((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
        return
      }

      setLoadingFile(true)
      setError('')

      try {
        const { content, sha } = await adapter.loadFileContent(file)
        setFileStateMap((prev) => ({
          ...prev,
          [fileId]: { content, sha, isDirty: false },
        }))
        setHeadingsDataMap((prev) => ({
          ...prev,
          [fileId]: extractHeadingsForFile(content, fileId),
        }))
        setActiveId(fileId)
        setOpened((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
      } catch (caughtError) {
        setError(getGitHubWorkspaceErrorMessage(caughtError, 'Failed to load file content'))
      } finally {
        setLoadingFile(false)
      }
    },
    [adapter, fileStateMap],
  )

  const handleSelect = useCallback(
    (file: IFile | undefined) => {
      if (file && file.kind === 'file') {
        loadFileContent(file)
      }
    },
    [loadFileContent],
  )

  const handleChange = useCallback((fileId: string, newContent: string) => {
    setFileStateMap((prev) => {
      const current = prev[fileId]
      if (!current) return prev
      return {
        ...prev,
        [fileId]: { ...current, content: newContent, isDirty: true },
      }
    })

    const headings = extractHeadingsForFile(newContent, fileId)
    setHeadingsDataMap((prev) => ({
      ...prev,
      [fileId]: headings,
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!adapter || !activeId || !adapter.saveFileContent) return

    const fileState = fileStateMap[activeId]
    const file = getFileObject(activeId)

    if (!fileState || !file || !file.path) return

    setSaving(true)
    setError('')

    try {
      const result = await adapter.saveFileContent(file, fileState.content, {
        message: commitMessage || 'Update via MarkFlowy',
        sha: fileState.sha,
      })

      setFileStateMap((prev) => ({
        ...prev,
        [activeId]: { ...fileState, sha: result?.content?.sha || fileState.sha, isDirty: false },
      }))

      alert('Saved successfully')
    } catch (caughtError) {
      setError(getGitHubWorkspaceErrorMessage(caughtError, 'Failed to save file'))
    } finally {
      setSaving(false)
    }
  }, [adapter, activeId, fileStateMap, getFileObject, commitMessage])

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

  const currentHeadings = useMemo(() => {
    return headingsDataMap[activeId] || []
  }, [headingsDataMap, activeId])

  const currentFileName = useMemo(() => {
    const file = getFileObject(activeId)
    return file?.name || 'Untitled'
  }, [activeId, getFileObject])

  const currentFileState = useMemo(() => {
    return fileStateMap[activeId]
  }, [fileStateMap, activeId])

  const handleBranchChange = useCallback(
    (branch: string) => {
      if (!adapter || adapter.type !== 'github' || !adapter.setBranch || branch === currentBranch)
        return

      const hasUnsavedChanges = Object.values(fileStateMap).some((file) => file.isDirty)
      if (
        hasUnsavedChanges &&
        !confirm('You have unsaved changes. Switch branches and discard them?')
      ) {
        return
      }

      const previousBranch = currentBranch
      const loadVersion = ++treeLoadVersionRef.current
      adapter.setBranch(branch)
      fileTreeHandler.clearLoadedDirsCache?.()
      setCurrentBranch(branch)
      setFileStateMap({})
      setHeadingsDataMap({})
      setActiveId('')
      setOpened([])
      setLoadingTree(true)
      setError('')

      void adapter
        .loadTree()
        .then((files) => {
          if (loadVersion !== treeLoadVersionRef.current) return
          setFolderData(files)
        })
        .catch((caughtError) => {
          if (loadVersion !== treeLoadVersionRef.current) return
          adapter.setBranch?.(previousBranch)
          setCurrentBranch(previousBranch)
          setError(getGitHubWorkspaceErrorMessage(caughtError, 'Failed to load branch'))
        })
        .finally(() => {
          if (loadVersion === treeLoadVersionRef.current) {
            setLoadingTree(false)
          }
        })
    },
    [adapter, currentBranch, fileStateMap],
  )

  const handleReadSubdirectory = useCallback(
    async (folderPath: string): Promise<IFile[]> => {
      if (adapter?.loadSubdirectory) {
        return adapter.loadSubdirectory(folderPath)
      }
      return []
    },
    [adapter],
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
    branches,
    currentBranch,
    commitMessage,
    setCommitMessage,
    handleSelect,
    handleChange,
    handleSave,
    handleShowConfirm,
    handleShowContextMenu,
    handleBranchChange,
    handleReadSubdirectory,
    getFileObject,
    getFileObjectByPath,
    currentHeadings,
    currentFileName,
    currentFileState,
  }
}
