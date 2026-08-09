import { ContextMenu, FileTree, SideBarHeader, TableOfContents } from '@markflowy/interface'
import { FileTreeProvider, WebFileSystemProvider } from 'adapters'
import { EditorToolbar } from 'components/workspace/EditorToolbar'
import { FillFlexParent } from 'components/FillFlexParent'
import { normalizeWorkspaceIdParam, useWorkspaceState } from 'hooks/useWorkspaceState'
import type { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import styled from 'styled-components'
import rem from 'utils/rem'

const Editor = dynamic(() => import('components/Editor').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <LoadingContainer>
      <LoadingSpinner />
    </LoadingContainer>
  ),
})

const WorkspaceDetailCSRPage = dynamic(() => Promise.resolve(WorkspaceDetailPageContent), {
  ssr: false,
  loading: () => (
    <Container>
      <LoadingContainer>
        <LoadingSpinner />
      </LoadingContainer>
    </Container>
  ),
})

const ignoreFileTreeContextMenu = () => {}

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

export default function WorkspaceDetailPage() {
  return <WorkspaceDetailCSRPage />
}

function WorkspaceDetailPageContent() {
  const router = useRouter()
  const id = normalizeWorkspaceIdParam(router.query.id)

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
    refs,
    currentRef,
    canWrite,
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

  const isRemoteWorkspace = adapter?.type === 'remote'
  const isGitHubProvider = isRemoteWorkspace && adapter.provider.toLowerCase() === 'github'
  const supportsRefs = isRemoteWorkspace && adapter.capabilities.refs
  const refLabel = isGitHubProvider ? 'Branch' : 'Ref'
  const workspaceTitle = adapter?.title || id || 'Workspace'
  let workspaceIconClass = 'ri-folder-3-line'
  let statusIconClass = 'ri-hard-drive-2-line'
  let statusText = 'Local'

  if (isRemoteWorkspace) {
    workspaceIconClass = isGitHubProvider ? 'ri-github-fill' : 'ri-cloud-line'
    statusIconClass = supportsRefs ? 'ri-git-branch-line' : 'ri-cloud-line'
    statusText = supportsRefs
      ? `${refLabel}: ${currentRef || 'Default'}`
      : adapter.provider || 'Remote'
  }

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
                  <i className={workspaceIconClass} />
                </WorkspaceIcon>
                <WorkspaceTitle>{workspaceTitle}</WorkspaceTitle>
                {supportsRefs && refs.length > 0 && (
                  <BranchSelect
                    aria-label={`${refLabel} selector`}
                    title={refLabel}
                    value={currentRef || refs[0]?.name || ''}
                    disabled={loadingTree || saving}
                    onChange={(e) => handleRefChange(e.target.value)}
                  >
                    {refs.map((ref) => (
                      <option key={ref.name} value={ref.name}>
                        {ref.name}
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
                {canWrite && activeId && currentFileState && (
                  <>
                    <CommitInput
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder={isGitHubProvider ? 'Commit message' : 'Save message'}
                    />
                    <SaveButton
                      type='button'
                      onClick={handleSave}
                      disabled={saving}
                      aria-disabled={saving || stagedFiles.length === 0}
                      $status={saveStatus}
                      aria-label={
                        saveStatus === 'saving'
                          ? `Saving ${stagedFiles.length} staged files`
                          : saveStatus === 'saved'
                            ? 'All staged files saved'
                            : stagedFiles.length === 0
                              ? 'No staged files to save'
                              : `Save ${stagedFiles.length} staged files`
                      }
                    >
                      <SaveButtonViewport aria-hidden='true'>
                        <SaveButtonState $visible={saveStatus === 'idle'}>
                          Save{stagedFiles.length > 1 ? ` ${stagedFiles.length}` : ''}
                        </SaveButtonState>
                        <SaveButtonState $visible={saveStatus === 'saving'}>
                          <SaveSpinner className='ri-loader-4-line' />
                          Saving
                        </SaveButtonState>
                        <SaveButtonState $visible={saveStatus === 'saved'}>
                          <i className='ri-check-line' />
                          Saved
                        </SaveButtonState>
                      </SaveButtonViewport>
                    </SaveButton>
                    <SaveAnnouncement role='status' aria-live='polite'>
                      {saveStatus === 'saving'
                        ? 'Saving staged files'
                        : saveStatus === 'saved'
                          ? 'All staged files saved'
                          : ''}
                    </SaveAnnouncement>
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
                        disableFileOperations={isRemoteWorkspace}
                        fillFlexParentComponent={FillFlexParent}
                        onShowConfirm={handleShowConfirm}
                        onShowContextMenu={
                          isRemoteWorkspace ? ignoreFileTreeContextMenu : handleShowContextMenu
                        }
                        getFileObject={getFileObject}
                        getFileObjectByPath={getFileObjectByPath}
                      />
                    )
                  )}
                </FileTreeWrapper>
                <StagedPanel aria-label='Staged changes'>
                  <StagedHeader>
                    <StagedTitle>
                      <i className='ri-git-commit-line' aria-hidden='true' />
                      Staged Changes
                    </StagedTitle>
                    <StagedCount>{stagedFiles.length}</StagedCount>
                  </StagedHeader>
                  <StagedList>
                    {stagedFiles.length === 0 ? (
                      <StagedEmpty>Edited files will appear here</StagedEmpty>
                    ) : (
                      stagedFiles.map(({ file, fileId }) => (
                        <StagedItemButton
                          key={fileId}
                          type='button'
                          $active={activeId === fileId}
                          onClick={() => handleSelect(file)}
                          aria-current={activeId === fileId ? 'page' : undefined}
                          title={file.path}
                        >
                          <StagedFileIcon className='ri-file-text-line' aria-hidden='true' />
                          <StagedFileText>
                            <StagedFileName>{file.name}</StagedFileName>
                            {file.path && file.path !== file.name && (
                              <StagedFilePath>{file.path}</StagedFilePath>
                            )}
                          </StagedFileText>
                          <StagedDot aria-hidden='true' />
                        </StagedItemButton>
                      ))
                    )}
                  </StagedList>
                </StagedPanel>
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
                          editable={!isRemoteWorkspace || canWrite}
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
                <i className={statusIconClass} />
                {statusText}
              </StatusItem>
              {stagedFiles.length > 0 && (
                <StatusItem $accent>
                  {stagedFiles.length} staged {stagedFiles.length === 1 ? 'file' : 'files'}
                </StatusItem>
              )}
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

const SaveButton = styled.button<{ $status: 'idle' | 'saving' | 'saved' }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: ${rem(26)};
  padding: 0 ${rem(10)};
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 500;
  background: ${(props) =>
    props.$status === 'saved' ? props.theme.successColor : props.theme.accentColor};
  color: white;
  border: 1px solid
    ${(props) => (props.$status === 'saved' ? props.theme.successColor : props.theme.accentColor)};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  cursor: pointer;
  transform: scale(1);
  transition:
    background-color 180ms cubic-bezier(0.23, 1, 0.32, 1),
    border-color 180ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active:not(:disabled):not([aria-disabled='true']) {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.borderColorFocused};
    outline-offset: 2px;
  }

  &:disabled,
  &[aria-disabled='true'] {
    opacity: ${(props) => (props.$status === 'saved' ? 1 : 0.65)};
    cursor: not-allowed;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:disabled):not([aria-disabled='true']) {
      opacity: 0.9;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      opacity 120ms ease;

    &:active:not(:disabled):not([aria-disabled='true']) {
      transform: none;
    }
  }
`

const SaveButtonViewport = styled.span`
  position: relative;
  display: block;
  width: ${rem(64)};
  height: 1em;
  line-height: 1;
`

const SaveButtonState = styled.span<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(4)};
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  filter: ${(props) => (props.$visible ? 'blur(0)' : 'blur(2px)')};
  transform: ${(props) => (props.$visible ? 'translateY(0)' : 'translateY(4px)')};
  transition:
    opacity 180ms cubic-bezier(0.23, 1, 0.32, 1),
    filter 180ms ease,
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1);

  @media (prefers-reduced-motion: reduce) {
    filter: none;
    transform: none;
    transition: opacity 120ms ease;
  }
`

const SaveSpinner = styled.i`
  animation: mf-web-save-spin 700ms linear infinite;

  @keyframes mf-web-save-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 1.4s;
  }
`

const SaveAnnouncement = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

const StagedPanel = styled.section`
  flex: 0 0 auto;
  min-height: 0;
  border-top: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.sideBarBgColor};
`

const StagedHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: ${rem(30)};
  padding: 0 ${rem(10)};
`

const StagedTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${rem(6)};
  min-width: 0;
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

const StagedCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${rem(18)};
  height: ${rem(18)};
  padding: 0 ${rem(5)};
  border-radius: 999px;
  background: ${(props) => props.theme.accentColorFocused};
  color: ${(props) => props.theme.accentColor};
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1;
`

const StagedList = styled.div`
  max-height: ${rem(230)};
  overflow: auto;
  padding: 0 ${rem(6)} ${rem(7)};
`

const StagedEmpty = styled.div`
  padding: ${rem(8)} ${rem(6)} ${rem(10)};
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
`

const StagedItemButton = styled.button<{ $active: boolean }>`
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${rem(7)};
  padding: ${rem(6)} ${rem(7)};
  border: 0;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  background: ${(props) => (props.$active ? props.theme.fileTreeSelectedBgColor : 'transparent')};
  color: ${(props) => props.theme.primaryFontColor};
  font: inherit;
  text-align: left;
  cursor: pointer;
  opacity: 1;
  transform: translateY(0);
  transition:
    background-color 150ms ease,
    opacity 180ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1);

  @starting-style {
    opacity: 0;
    transform: translateY(-4px);
  }

  &:active {
    transform: scale(0.98);
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.borderColorFocused};
    outline-offset: -2px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: ${(props) =>
        props.$active ? props.theme.fileTreeSelectedBgColor : props.theme.hoverColor};
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: background-color 120ms ease;

    @starting-style {
      opacity: 1;
      transform: none;
    }

    &:active {
      transform: none;
    }
  }
`

const StagedFileIcon = styled.i`
  flex: 0 0 auto;
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${rem(14)};
`

const StagedFileText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${rem(1)};
`

const StagedFileName = styled.span`
  overflow: hidden;
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontXs};
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StagedFilePath = styled.span`
  overflow: hidden;
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StagedDot = styled.span`
  flex: 0 0 auto;
  width: ${rem(6)};
  height: ${rem(6)};
  border-radius: 50%;
  background: ${(props) => props.theme.accentColor};
  box-shadow: 0 0 0 ${rem(3)} ${(props) => props.theme.accentColorFocused};
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
