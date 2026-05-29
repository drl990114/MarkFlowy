import type { ContextMenuItem, IFile, IHeadingData } from '@markflowy/interface'
import { showContextMenu } from '@markflowy/interface'
import { createAdapterFromId, createLocalAdapter, createServerWorkspaceAdapter, type WorkspaceAdapter } from 'adapters'
import { useAuth } from 'hooks/useAuth'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MenuItemData } from 'zens'

export type ViewType = 'wysiwyg' | 'source' | 'preview'

export interface FileState {
  content: string
  sha?: string
  isDirty: boolean
}

const extractHeadingsForFile = (content: string, fileId: string): IHeadingData[] => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: IHeadingData[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const depth = match[1].length
    const value = match[2].trim()
    const id = `heading-${fileId}-${headings.length}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

    headings.push({
      depth,
      value,
      id,
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
  const { loading: authLoading, isAuthenticated } = useAuth(true)

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
    if (!id) return

    const initAdapter = async () => {
      let newAdapter: WorkspaceAdapter
      if (id === 'demo-workspace' || id.startsWith('github-')) {
        newAdapter = createAdapterFromId(id)
      } else {
        try {
          newAdapter = await createServerWorkspaceAdapter(id)
        } catch {
          newAdapter = createLocalAdapter()
        }
      }
      setAdapter(newAdapter)
      setActiveId('')
      setOpened([])
      setFileStateMap({})
      setHeadingsDataMap({})
      setBranches([])
      setCurrentBranch('')
    }

    initAdapter()
  }, [id])

  useEffect(() => {
    if (!adapter) return

    if (adapter.type === 'local') {
      adapter.loadTree().then((files) => {
        setFolderData(files)
        const firstFile = findFirstFile(files)
        if (firstFile) {
          setActiveId(firstFile.id)
          setOpened([firstFile.id])
          adapter.loadFileContent(firstFile).then(({ content }) => {
            setFileStateMap((prev) => ({ ...prev, [firstFile.id]: { content, isDirty: false } }))
            setHeadingsDataMap((prev) => ({ ...prev, [firstFile.id]: extractHeadingsForFile(content, firstFile.id) }))
          })
        }
      })
      return
    }

    if (adapter.type === 'github' && !isAuthenticated) return

    const load = async () => {
      setLoadingTree(true)
      setError('')
      try {
        const files = await adapter.loadTree()
        setFolderData(files)

        if (adapter.getBranches) {
          const branchList = await adapter.getBranches()
          setBranches(branchList)
          if (branchList.length > 0 && !currentBranch) {
            setCurrentBranch(branchList[0])
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load workspace tree')
      } finally {
        setLoadingTree(false)
      }
    }

    load()
  }, [adapter, isAuthenticated, findFirstFile, currentBranch])

  const getFileObject = useCallback((id: string): IFile | undefined => {
    const findInFolder = (items: IFile[]): IFile | undefined => {
      for (const item of items) {
        if (item.id === id) return item
        if (item.children) {
          const found = findInFolder(item.children)
          if (found) return found
        }
      }
      return undefined
    }
    return findInFolder(folderData)
  }, [folderData])

  const getFileObjectByPath = useCallback((path: string): IFile | undefined => {
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
  }, [folderData])

  const loadFileContent = useCallback(async (file: IFile) => {
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
    } catch (err: any) {
      setError(err?.message || 'Failed to load file content')
    } finally {
      setLoadingFile(false)
    }
  }, [adapter, fileStateMap])

  const handleSelect = useCallback((file: IFile | undefined) => {
    if (file && file.kind === 'file') {
      loadFileContent(file)
    }
  }, [loadFileContent])

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
    } catch (err: any) {
      setError(err?.message || 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }, [adapter, activeId, fileStateMap, getFileObject, commitMessage])

  const handleShowConfirm = ({ title, onConfirm }: { title: string; onConfirm: () => void }) => {
    if (confirm(title)) {
      onConfirm()
    }
  }

  const handleShowContextMenu = ({ x, y, items }: { x: number; y: number; items: ContextMenuItem[] }) => {
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

  const handleBranchChange = useCallback((branch: string) => {
    if (adapter && adapter.type === 'github' && 'setBranch' in adapter) {
      setCurrentBranch(branch)
      ;(adapter as any).setBranch(branch)
      setFileStateMap({})
      setHeadingsDataMap({})
      setActiveId('')
      setOpened([])
      setLoadingTree(true)
      adapter.loadTree().then((files) => {
        setFolderData(files)
        setLoadingTree(false)
      }).catch((err: any) => {
        setError(err?.message || 'Failed to load tree')
        setLoadingTree(false)
      })
    }
  }, [adapter])

  const handleReadSubdirectory = useCallback(async (folderPath: string): Promise<IFile[]> => {
    if (adapter?.loadSubdirectory) {
      return adapter.loadSubdirectory(folderPath)
    }
    return []
  }, [adapter])

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
