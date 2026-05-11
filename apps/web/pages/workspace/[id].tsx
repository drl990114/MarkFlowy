import type { ContextMenuItem, IFile, IHeadingData } from '@markflowy/interface'
import { ContextMenu, FileTree, MfIconButton, SideBarHeader, TableOfContents, ToolbarDivider, ToolbarWrapper, showContextMenu } from '@markflowy/interface'
import { FileTreeProvider, WebFileSystemProvider, createAdapterFromId, createLocalAdapter, createServerWorkspaceAdapter, type WorkspaceAdapter } from 'adapters'
import { FillFlexParent } from 'components/FillFlexParent'
import { useAuth } from 'hooks/useAuth'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'
import type { MenuItemData } from 'zens'

const Editor = dynamic(() => import('components/Editor'), {
  ssr: false,
  loading: () => (
    <LoadingContainer>
      <LoadingSpinner />
    </LoadingContainer>
  ),
})

type ViewType = 'wysiwyg' | 'source' | 'preview'

interface FileState {
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

function MenuList({ viewType, onViewTypeChange }: { viewType: ViewType; onViewTypeChange: (type: ViewType) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: rem(4) }}>
      <MfIconButton
        icon='ri-eye-line'
        onClick={() => onViewTypeChange('wysiwyg')}
        tooltipProps={{ title: 'WYSIWYG' }}
        size='small'
        rounded='smooth'
        className={viewType === 'wysiwyg' ? 'active' : ''}
      />
      <MfIconButton
        icon='ri-code-line'
        onClick={() => onViewTypeChange('source')}
        tooltipProps={{ title: 'Source' }}
        size='small'
        rounded='smooth'
        className={viewType === 'source' ? 'active' : ''}
      />
      <MfIconButton
        icon='ri-file-list-line'
        onClick={() => onViewTypeChange('preview')}
        tooltipProps={{ title: 'Preview' }}
        size='small'
        rounded='smooth'
        className={viewType === 'preview' ? 'active' : ''}
      />
    </div>
  )
}

export default function WorkspaceDetailPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }

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

  const tocRef = useRef<HTMLDivElement>(null)
  const fileTreeRef = useRef<HTMLDivElement>(null)

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

  if (authLoading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
        </LoadingContainer>
      </Container>
    )
  }

  if (!isClient) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
        </LoadingContainer>
      </Container>
    )
  }

  const isGithubWorkspace = adapter?.type === 'github'
  const workspaceTitle = adapter?.title || (id || 'Workspace')

  return (
    <WebFileSystemProvider readSubdirectory={handleReadSubdirectory}>
      <FileTreeProvider
        folderData={folderData}
        activeId={activeId}
        onFolderDataChange={setFolderData}
        onActiveIdChange={setActiveId}
      >
        <Container>
          <TopToolbar>
            <ToolbarLeft>
              <BackLink href='/workspace'>← Workspaces</BackLink>
            </ToolbarLeft>
            <ToolbarCenter>
              <WorkspaceInfo>
                <WorkspaceIcon>
                  {isGithubWorkspace ? <GitHubIcon /> : <WorkspaceIconSvg />}
                </WorkspaceIcon>
                <WorkspaceTitle>{workspaceTitle}</WorkspaceTitle>
                {isGithubWorkspace && branches.length > 0 && (
                  <BranchSelect
                    value={currentBranch || branches[0] || ''}
                    onChange={(e) => handleBranchChange(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </BranchSelect>
                )}
              </WorkspaceInfo>
            </ToolbarCenter>
            <ToolbarRight>
              <Actions>
                <FileName>
                  {currentFileName}
                  {currentFileState?.isDirty && ' *'}
                </FileName>
                {isGithubWorkspace && activeId && currentFileState && (
                  <>
                    <CommitInput
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder='Commit message'
                    />
                    <SaveButton onClick={handleSave} disabled={saving || !currentFileState.isDirty}>
                      {saving ? 'Saving...' : 'Save'}
                    </SaveButton>
                  </>
                )}
              </Actions>
            </ToolbarRight>
          </TopToolbar>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <MainContent>
            <LeftSidebar>
              <SideBarHeader name='Explorer' />
              <FileTreeWrapper ref={fileTreeRef}>
                {loadingTree ? (
                  <LoadingText>Loading files...</LoadingText>
                ) : (
                  fileTreeRef.current && (
                    <FileTree
                      data={folderData}
                      onSelect={handleSelect}
                      dndRootElement={fileTreeRef.current}
                      disableDrag={true}
                      fillFlexParentComponent={FillFlexParent}
                      onShowConfirm={handleShowConfirm}
                      onShowContextMenu={handleShowContextMenu}
                      getFileObject={getFileObject}
                      getFileObjectByPath={getFileObjectByPath}
                    />
                  )
                )}
              </FileTreeWrapper>
            </LeftSidebar>

            <CenterArea>
              <ToolbarWrapper>
                <ToolbarSection>
                  <MfIconButton
                    icon='ri-arrow-go-back-line'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Undo' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-arrow-go-forward-line'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Redo' }}
                    size='small'
                    rounded='smooth'
                  />
                </ToolbarSection>
                <ToolbarDivider />
                <ToolbarSection>
                  <MfIconButton
                    icon='ri-h-1'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Heading 1' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-h-2'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Heading 2' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-h-3'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Heading 3' }}
                    size='small'
                    rounded='smooth'
                  />
                </ToolbarSection>
                <ToolbarDivider />
                <ToolbarSection>
                  <MfIconButton
                    icon='ri-bold'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Bold' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-italic'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Italic' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-strikethrough'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Strikethrough' }}
                    size='small'
                    rounded='smooth'
                  />
                </ToolbarSection>
                <ToolbarDivider />
                <ToolbarSection>
                  <MfIconButton
                    icon='ri-list-unordered'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Bullet List' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-list-ordered'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Numbered List' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-checkbox-line'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Task List' }}
                    size='small'
                    rounded='smooth'
                  />
                </ToolbarSection>
                <ToolbarDivider />
                <ToolbarSection>
                  <MfIconButton
                    icon='ri-link'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Link' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-image-line'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Image' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-code-line'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Code' }}
                    size='small'
                    rounded='smooth'
                  />
                  <MfIconButton
                    icon='ri-double-quotes-l'
                    onClick={() => {}}
                    tooltipProps={{ title: 'Quote' }}
                    size='small'
                    rounded='smooth'
                  />
                </ToolbarSection>
                <ToolbarDivider />
                <ToolbarSection>
                  <MenuList viewType={viewType} onViewTypeChange={setViewType} />
                </ToolbarSection>
              </ToolbarWrapper>
              <EditorContent ref={tocRef}>
                {loadingFile && (
                  <EditorLoading>
                    <LoadingText>Loading file...</LoadingText>
                  </EditorLoading>
                )}
                {!loadingFile && opened.length === 0 && (
                  <EditorEmpty>
                    <EmptyIcon>📄</EmptyIcon>
                    <EmptyText>Select a file from the file tree to start editing</EmptyText>
                  </EditorEmpty>
                )}
                {opened.map((fileId) => {
                  const fileState = fileStateMap[fileId]
                  if (!fileState) return null
                  return (
                    <EditorWrapper key={fileId} $active={activeId === fileId}>
                      <Editor
                        fileId={fileId}
                        initialContent={fileState.content}
                        onChange={(content) => handleChange(fileId, content)}
                        viewType={viewType}
                        active={activeId === fileId}
                      />
                    </EditorWrapper>
                  )
                })}
              </EditorContent>
            </CenterArea>

            <RightSidebar>
              <SideBarHeader name='Outline' />
              <TocContainer>
                <TableOfContents
                  headingsData={currentHeadings}
                  variant='sidebar'
                  compact={false}
                  pinned
                />
              </TocContainer>
            </RightSidebar>
          </MainContent>
          <ContextMenu />
        </Container>
      </FileTreeProvider>
    </WebFileSystemProvider>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
`

const TopToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(10)} ${rem(20)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.bgColorSecondary};
  flex-shrink: 0;
  height: ${rem(50)};
`

const ToolbarLeft = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
`

const ToolbarCenter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`

const ToolbarRight = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`

const BackLink = styled(Link)`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const WorkspaceInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
`

const WorkspaceIcon = styled.div`
  width: ${rem(28)};
  height: ${rem(28)};
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #da936a 0%, #c47a4f 100%);
  border-radius: ${rem(6)};
  color: #ffffff;
`

const WorkspaceIconSvg = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M3 7v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7'></path>
    <path d='M17 21v-8'></path>
    <path d='M7 21v-8'></path>
    <path d='M7 3v5h10V3'></path>
    <path d='M9 3h6'></path>
  </svg>
)

const GitHubIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
    <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
  </svg>
)

const WorkspaceTitle = styled.div`
  font-size: ${rem(15)};
  font-weight: 600;
`

const BranchSelect = styled.select`
  padding: ${rem(4)} ${rem(8)};
  font-size: ${rem(13)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(4)};
  color: ${(props) => props.theme.primaryFontColor};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #da936a;
  }
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
`

const FileName = styled.div`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  padding: ${rem(4)} ${rem(10)};
  background: ${(props) => props.theme.bgColor};
  border-radius: ${rem(4)};
`

const CommitInput = styled.input`
  padding: ${rem(4)} ${rem(10)};
  font-size: ${rem(13)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(4)};
  color: ${(props) => props.theme.primaryFontColor};
  width: ${rem(200)};

  &:focus {
    outline: none;
    border-color: #da936a;
  }
`

const SaveButton = styled.button`
  padding: ${rem(4)} ${rem(12)};
  font-size: ${rem(13)};
  font-weight: 500;
  background: #da936a;
  color: white;
  border: none;
  border-radius: ${rem(4)};
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ErrorBanner = styled.div`
  padding: ${rem(10)} ${rem(20)};
  background: #dc2626;
  color: white;
  font-size: ${rem(14)};
  text-align: center;
`

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

const LeftSidebar = styled.div`
  width: ${rem(240)};
  min-width: ${rem(200)};
  max-width: ${rem(300)};
  background: ${(props) => props.theme.bgColorSecondary};
  border-right: 1px solid ${(props) => props.theme.borderColor};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`

const FileTreeWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: ${rem(8)} 0;
`

const CenterArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
`

const ToolbarSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(2)};
`

const EditorContent = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
`

const EditorWrapper = styled.div<{ $active: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: ${(props) => (props.$active ? 'block' : 'none')};
`

const EditorLoading = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.theme.bgColor};
`

const EditorEmpty = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.theme.bgColor};
  gap: ${rem(16)};
`

const EmptyIcon = styled.div`
  font-size: ${rem(48)};
  opacity: 0.5;
`

const EmptyText = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
`

const RightSidebar = styled.div`
  width: ${rem(260)};
  min-width: ${rem(220)};
  max-width: ${rem(320)};
  background: ${(props) => props.theme.bgColorSecondary};
  border-left: 1px solid ${(props) => props.theme.borderColor};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`

const TocContainer = styled.div`
  flex: 1;
  overflow: hidden;
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
`

const LoadingSpinner = styled.div`
  width: ${rem(40)};
  height: ${rem(40)};
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #da936a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

const LoadingText = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(20)};
`
