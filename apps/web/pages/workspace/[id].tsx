import { ContextMenu, FileTree, SideBarHeader, TableOfContents } from '@markflowy/interface'
import { FileTreeProvider, WebFileSystemProvider } from 'adapters'
import { EditorToolbar } from 'components/workspace/EditorToolbar'
import { FillFlexParent } from 'components/FillFlexParent'
import { useWorkspaceState } from 'hooks/useWorkspaceState'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
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
  const workspaceTitle = adapter?.title || id || 'Workspace'

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
              <BackLink href='/workspace'>
                <i className='ri-arrow-left-line' />
                Workspaces
              </BackLink>
            </ToolbarLeft>
            <ToolbarCenter>
              <WorkspaceInfo>
                <WorkspaceIcon>
                  <i className={isGithubWorkspace ? 'ri-github-fill' : 'ri-folder-3-line'} />
                </WorkspaceIcon>
                <WorkspaceTitle>{workspaceTitle}</WorkspaceTitle>
                {isGithubWorkspace && branches.length > 0 && (
                  <BranchSelect
                    value={currentBranch || branches[0] || ''}
                    onChange={(e) => handleBranchChange(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </BranchSelect>
                )}
              </WorkspaceInfo>
            </ToolbarCenter>
            <ToolbarRight>
              <Actions>
                <FileChip>
                  <i className='ri-file-text-line' />
                  {currentFileName}
                  {currentFileState?.isDirty && ' *'}
                </FileChip>
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
            <Panel id='workspace-left' defaultSize={240} minSize={200} maxSize={320}>
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
            </Panel>

            <StyleSeparator />

            <Panel id='workspace-center' minSize={420} groupResizeBehavior='preserve-relative-size'>
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
                      <EmptyIcon className='ri-file-list-3-line' />
                      <EmptyText>No file selected</EmptyText>
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
            </Panel>

            <StyleSeparator />

            <Panel id='workspace-right' defaultSize={260} minSize={220} maxSize={340}>
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
            </Panel>
          </MainContent>
          <StatusBar>
            <StatusLeft>
              <StatusItem>
                <i className={isGithubWorkspace ? 'ri-git-branch-line' : 'ri-hard-drive-2-line'} />
                {isGithubWorkspace ? currentBranch || 'main' : 'Local'}
              </StatusItem>
              {currentFileState?.isDirty && <StatusItem $accent>Unsaved</StatusItem>}
            </StatusLeft>
            <StatusRight>
              <StatusItem>{viewType}</StatusItem>
              <StatusItem>{currentHeadings.length} headings</StatusItem>
            </StatusRight>
          </StatusBar>
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
  width: 100vw;
  overflow: hidden;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  border-top: 1px solid ${(props) => props.theme.borderColor};
  font-family: ${(props) => props.theme.fontFamily};
`

const TopToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${rem(8)};
  padding: 0 ${rem(8)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.titleBarBgColor};
  flex-shrink: 0;
  height: ${rem(36)};
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
  min-width: 0;
`

const ToolbarRight = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${rem(4)};
  height: ${rem(26)};
  padding: 0 ${rem(8)};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.disabledFontColor};
  text-decoration: none;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    background: ${(props) => props.theme.hoverColor};
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const WorkspaceInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  min-width: 0;
  max-width: 100%;
`

const WorkspaceIcon = styled.div`
  width: ${rem(24)};
  height: ${rem(24)};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.theme.accentColorFocused};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => props.theme.accentColor};
  font-size: ${rem(15)};
  flex: 0 0 auto;
`

const WorkspaceTitle = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const BranchSelect = styled.select`
  height: ${rem(26)};
  padding: 0 ${rem(8)};
  font-size: ${(props) => props.theme.fontXs};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => props.theme.primaryFontColor};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.borderColorFocused};
  }
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(6)};
  min-width: 0;
`

const FileChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${rem(5)};
  max-width: ${rem(180)};
  height: ${rem(26)};
  padding: 0 ${rem(8)};
  font-size: ${(props) => props.theme.fontXs};
  color: ${(props) => props.theme.disabledFontColor};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CommitInput = styled.input`
  height: ${rem(26)};
  padding: 0 ${rem(8)};
  font-size: ${(props) => props.theme.fontXs};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => props.theme.primaryFontColor};
  width: ${rem(190)};

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.borderColorFocused};
  }
`

const SaveButton = styled.button`
  height: ${rem(26)};
  padding: 0 ${rem(10)};
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 500;
  background: ${(props) => props.theme.accentColor};
  color: white;
  border: 1px solid ${(props) => props.theme.accentColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  cursor: pointer;
  transition: opacity 0.16s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ErrorBanner = styled.div`
  padding: ${rem(8)} ${rem(12)};
  background: rgba(220, 38, 38, 0.12);
  border-bottom: 1px solid rgba(220, 38, 38, 0.28);
  color: #ff7b72;
  font-size: ${(props) => props.theme.fontSm};
`

const MainContent = styled(Group)`
  flex: 1;
  overflow: hidden;
  min-height: 0;
`

const StyleSeparator = styled(Separator)`
  width: 1px;
  background-color: ${(props) => props.theme.borderColor};
  cursor: col-resize !important;
  transition:
    background-color 0.16s ease,
    width 0.16s ease;
  flex: 0 0 auto;

  &:focus {
    outline: 1px solid ${(props) => props.theme.accentColor};
  }

  &[data-separator='hover'],
  &[data-separator='active'] {
    background-color: ${(props) => props.theme.accentColor};
  }
`

const LeftSidebar = styled.div`
  width: 100%;
  height: 100%;
  background: ${(props) => props.theme.sideBarBgColor};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const FileTreeWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: ${rem(6)} 0;
`

const CenterArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  height: 100%;
  background: ${(props) => props.theme.bgColor};
`

const EditorContent = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
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
  gap: ${rem(8)};
`

const EmptyIcon = styled.i`
  font-size: ${rem(28)};
  color: ${(props) => props.theme.disabledFontColor};
`

const EmptyText = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.disabledFontColor};
`

const RightSidebar = styled.div`
  width: 100%;
  height: 100%;
  background: ${(props) => props.theme.rightBarBgColor};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const TocContainer = styled.div`
  flex: 1;
  overflow: hidden;
`

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: ${(props) => props.theme.statusBarHeight};
  padding: 0 ${rem(8)};
  background: ${(props) => props.theme.statusBarBgColor};
  border-top: 1px solid ${(props) => props.theme.borderColor};
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  flex-shrink: 0;
  gap: ${rem(8)};
`

const StatusLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  min-width: 0;
`

const StatusRight = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${rem(10)};
  min-width: 0;
`

const StatusItem = styled.span<{ $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${rem(4)};
  color: ${(props) => (props.$accent ? props.theme.warnColor : 'inherit')};
  white-space: nowrap;
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
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(20)};
`
