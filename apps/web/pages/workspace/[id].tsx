import type { IFile } from '@markflowy/interface'
import { ContextMenu, FileTree, SideBarHeader, TableOfContents } from '@markflowy/interface'
import { FileTreeProvider, WebFileSystemProvider } from 'adapters'
import { EditorToolbar } from 'components/workspace/EditorToolbar'
import { FillFlexParent } from 'components/FillFlexParent'
import { useWorkspaceState } from 'hooks/useWorkspaceState'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'

const Editor = dynamic(() => import('components/Editor'), {
  ssr: false,
  loading: () => (
    <LoadingContainer>
      <LoadingSpinner />
    </LoadingContainer>
  ),
})

export default function WorkspaceDetailPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  const {
    authLoading,
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
  } = useWorkspaceState(id)

  const tocRef = useRef<HTMLDivElement>(null)
  const fileTreeRef = useRef<HTMLDivElement>(null)

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
              <EditorToolbar viewType={viewType} onViewTypeChange={setViewType} />
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
  background: linear-gradient(135deg, #d4564a 0%, #b8453c 100%);
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
    border-color: #d4564a;
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
    border-color: #d4564a;
  }
`

const SaveButton = styled.button`
  padding: ${rem(4)} ${rem(12)};
  font-size: ${rem(13)};
  font-weight: 500;
  background: #d4564a;
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
  border-top-color: #d4564a;
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
