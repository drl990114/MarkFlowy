import type { ContextMenuItem, IFile, IHeadingData } from '@markflowy/interface'
import { ContextMenu, FileTree, MfIconButton, MfIconLabelButton, SideBarHeader, TableOfContents, ToolbarDivider, ToolbarWrapper, showContextMenu } from '@markflowy/interface'
import { FileTreeProvider, WebFileSystemProvider } from 'adapters'
import { FillFlexParent } from 'components/FillFlexParent'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'
import type { MenuItemData } from 'zens'

// Dynamically import Editor to avoid SSR issues with rme
const Editor = dynamic(() => import('components/Editor'), {
  ssr: false,
  loading: () => (
    <LoadingContainer>
      <LoadingSpinner />
    </LoadingContainer>
  ),
})

const STORAGE_KEY_PREFIX = 'markflowy-temp-content'

const getStorageKey = (fileId: string) => `${STORAGE_KEY_PREFIX}-${fileId}`

const defaultContents: Record<string, string> = {
  'temp-file': `# Quick Edit

This is a **temporary workspace** - your content is automatically saved to your browser's local storage.

## Features

- ✅ No login required
- ✅ Auto-save to local storage
- ✅ Full markdown support
- ✅ WYSIWYG editing

## Try it out!

Start typing here... Your changes will be preserved even if you refresh the page.

### Subsection 1

You can add subsections like this.

### Subsection 2

More content here...

---

*Happy writing! ✍️*
`,
  'temp-notes': `# Notes

Welcome to your notes file!

## Getting Started

Use this space to jot down your ideas, meeting notes, or anything you need to remember.

## Tips

- Use **bold** for emphasis
- Use *italic* for style
- Create lists for organization

---

Start writing your notes here...
`,
}

const getDefaultContent = (fileId: string): string => {
  return defaultContents[fileId] || '# New File\n\nStart writing here...'
}

// Mock file data with folder structure
const mockFolderData: IFile[] = [
  {
    id: 'temp-root',
    name: 'Quick Edit',
    kind: 'dir',
    path: '/temp',
    children: [
      {
        id: 'temp-file',
        name: 'Quick Edit.md',
        kind: 'file',
        path: '/temp/Quick Edit.md',
        ext: 'md',
      },
      {
        id: 'temp-notes',
        name: 'Notes.md',
        kind: 'file',
        path: '/temp/Notes.md',
        ext: 'md',
      },
    ],
  },
]

type ViewType = 'wysiwyg' | 'source' | 'preview'

// Get all file IDs from folder data
const getAllFileIds = (files: IFile[]): string[] => {
  const ids: string[] = []
  const traverse = (items: IFile[]) => {
    items.forEach(item => {
      if (item.kind === 'file') {
        ids.push(item.id)
      }
      if (item.children) {
        traverse(item.children)
      }
    })
  }
  traverse(files)
  return ids
}

// Extract headings from content for specific file
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

export default function TempWorkspacePage() {
  const [viewType, setViewType] = useState<ViewType>('wysiwyg')
  const [headingsDataMap, setHeadingsDataMap] = useState<Record<string, IHeadingData[]>>({})
  const [folderData, setFolderData] = useState<IFile[]>(mockFolderData)
  const [activeId, setActiveId] = useState<string>('temp-file')
  const [opened, setOpened] = useState<string[]>(['temp-file'])
  const [contentMap, setContentMap] = useState<Record<string, string>>({})
  const tocRef = useRef<HTMLDivElement>(null)
  const fileTreeRef = useRef<HTMLDivElement>(null)

  // Get all available file IDs
  const allFileIds = useMemo(() => getAllFileIds(folderData), [folderData])

  // Load initial content for all files
  useEffect(() => {
    const initialContentMap: Record<string, string> = {}
    const initialHeadingsMap: Record<string, IHeadingData[]> = {}
    allFileIds.forEach(fileId => {
      const storageKey = getStorageKey(fileId)
      const savedContent = localStorage.getItem(storageKey)
      const content = savedContent || getDefaultContent(fileId)
      initialContentMap[fileId] = content
      initialHeadingsMap[fileId] = extractHeadingsForFile(content, fileId)
    })
    setContentMap(initialContentMap)
    setHeadingsDataMap(initialHeadingsMap)
  }, [allFileIds])

  // Handle file selection from file tree
  const handleSelect = useCallback((file: IFile | undefined) => {
    if (file && file.kind === 'file') {
      const fileId = file.id
      setActiveId(fileId)
      setOpened(prev => {
        if (!prev.includes(fileId)) {
          return [...prev, fileId]
        }
        return prev
      })
    }
  }, [setActiveId, setOpened])

  // Handle content change for specific file
  const handleChange = useCallback((fileId: string, newContent: string) => {
    setContentMap(prev => ({
      ...prev,
      [fileId]: newContent,
    }))
    // Auto-save to localStorage with file-specific key
    const storageKey = getStorageKey(fileId)
    localStorage.setItem(storageKey, newContent)
    // Update headings for TOC
    const headings = extractHeadingsForFile(newContent, fileId)
    setHeadingsDataMap(prev => ({
      ...prev,
      [fileId]: headings,
    }))
  }, [])

  // Handle clear current file
  const handleClear = useCallback(() => {
    if (confirm('Are you sure you want to clear all content? This cannot be undone.')) {
      const storageKey = getStorageKey(activeId)
      localStorage.removeItem(storageKey)
      // Reset to default content for current file
      const defaultContent = getDefaultContent(activeId)
      setContentMap(prev => ({
        ...prev,
        [activeId]: defaultContent,
      }))
    }
  }, [activeId])

  const handleShowConfirm = ({ title, onConfirm }: { title: string; onConfirm: () => void }) => {
    if (confirm(title)) {
      onConfirm()
    }
  }

  const handleShowContextMenu = ({ x, y, items }: { x: number; y: number; items: ContextMenuItem[] }) => {
    const menuItems: MenuItemData[] = items.map(item => ({
      label: item.label,
      value: item.value,
      handler: item.handler,
    }))
    showContextMenu({ x, y, items: menuItems })
  }

  // Mock file object getters
  const getFileObject = (id: string): IFile | undefined => {
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
  }

  const getFileObjectByPath = (path: string): IFile | undefined => {
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
  }

  // Get current headings for active file
  const currentHeadings = useMemo(() => {
    return headingsDataMap[activeId] || []
  }, [headingsDataMap, activeId])

  return (
    <WebFileSystemProvider>
      <FileTreeProvider
        folderData={folderData}
        activeId={activeId}
        onFolderDataChange={setFolderData}
        onActiveIdChange={setActiveId}
      >
        <Container>
          {/* Top Toolbar */}
          <TopToolbar>
            <ToolbarLeft>
              <BackLink href='/workspace'>← Workspaces</BackLink>
            </ToolbarLeft>
            <ToolbarCenter>
              <WorkspaceInfo>
                <WorkspaceIcon>
                  <EditIcon />
                </WorkspaceIcon>
                <WorkspaceTitle>Quick Edit</WorkspaceTitle>
              </WorkspaceInfo>
            </ToolbarCenter>
            <ToolbarRight>
              <Actions>
                <ClearButton onClick={handleClear}>Clear</ClearButton>
                <SaveStatus>Saved to local</SaveStatus>
              </Actions>
            </ToolbarRight>
          </TopToolbar>

          {/* Main Content Area */}
          <MainContent>
            {/* Left Sidebar - File Tree */}
            <LeftSidebar>
              <SideBarHeader name='Explorer' />
              <FileTreeWrapper ref={fileTreeRef}>
                {fileTreeRef.current && (
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
                )}
              </FileTreeWrapper>
            </LeftSidebar>

            {/* Center - Editor Area */}
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
                {opened.map(fileId => (
                  <EditorWrapper key={fileId} active={activeId === fileId}>
                    <Editor
                      fileId={fileId}
                      initialContent={contentMap[fileId] || getDefaultContent(fileId)}
                      onChange={(content) => handleChange(fileId, content)}
                      viewType={viewType}
                      active={activeId === fileId}
                    />
                  </EditorWrapper>
                ))}
              </EditorContent>
            </CenterArea>

            {/* Right Sidebar - Outline */}
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

// Top Toolbar Styles
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

const EditIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'></path>
    <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'></path>
  </svg>
)

const WorkspaceTitle = styled.div`
  font-size: ${rem(15)};
  font-weight: 600;
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
`

const ClearButton = styled.button`
  padding: ${rem(5)} ${rem(12)};
  background: transparent;
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(4)};
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
`

const SaveStatus = styled.div`
  font-size: ${rem(12)};
  color: ${(props) => props.theme.disabledFontColor};
  padding: ${rem(4)} ${rem(10)};
  background: ${(props) => props.theme.bgColor};
  border-radius: ${rem(4)};
`

// Main Content Area Styles
const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

// Left Sidebar Styles
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

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${(props) => props.theme.borderColor};
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${(props) => props.theme.borderColorFocused};
  }

  /* File tree item styles */
  .file-icon {
    margin-right: ${rem(6)};
    font-size: ${rem(14)};
    color: ${(props) => props.theme.accentColor};
  }

  /* Selected file highlight */
  [role="treeitem"] {
    border-radius: ${rem(4)};
    margin: 0 ${rem(8)};
  }
`

// Center Area Styles
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

// Editor wrapper - controls visibility like desktop
const EditorWrapper = styled.div<{ active: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: ${props => props.active ? 'block' : 'none'};
`

// Right Sidebar Styles
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

interface MenuListProps {
  viewType: ViewType
  onViewTypeChange: (type: ViewType) => void
}

// MenuList Component
const MenuList = ({ viewType, onViewTypeChange }: MenuListProps) => {
  const ref = useRef<HTMLDivElement>(null)

  const handleClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return

    const items: MenuItemData[] = [
      {
        label: 'WYSIWYG',
        value: 'wysiwyg',
        checked: viewType === 'wysiwyg',
        handler: () => onViewTypeChange('wysiwyg'),
      },
      {
        label: 'Source Code',
        value: 'source',
        checked: viewType === 'source',
        handler: () => onViewTypeChange('source'),
      },
      {
        label: 'Preview',
        value: 'preview',
        checked: viewType === 'preview',
        handler: () => onViewTypeChange('preview'),
      },
    ]

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items,
    })
  }, [viewType, onViewTypeChange])

  return (
    <MfIconLabelButton
      iconRef={ref}
      icon={'ri-menu-line'}
      onClick={handleClick}
      tooltipProps={{ title: 'More' }}
      label={'View'}
      size='small'
      rounded='smooth'
    />
  )
}
