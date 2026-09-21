import { ContextMenu, FileTree, SideBarHeader, TableOfContents } from '@markflowy/interface'
import { FileTreeProvider, WebFileSystemProvider } from 'adapters'
import { EditorToolbar } from 'components/workspace/EditorToolbar'
import { FillFlexParent } from 'components/FillFlexParent'
import { normalizeWorkspaceIdParam, useWorkspaceState } from 'hooks/useWorkspaceState'
import type { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator, useGroupCallbackRef } from 'react-resizable-panels'
import styled from 'styled-components'
import rem from 'utils/rem'
import NavButton from '../../components/Nav/NavButton'
import SeoHead from '../../components/SeoHead'

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

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale || 'en', ['common'])) },
})

export default function WorkspaceDetailPage() {
  return <WorkspaceDetailCSRPage />
}

function WorkspaceDetailPageContent() {
  const { t } = useTranslation()
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
  const [mobileView, setMobileView] = useState<'files' | 'editor' | 'outline'>('editor')
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  const [panelGroup, setPanelGroup] = useGroupCallbackRef()
  const wasCompact = useRef(compact)
  const desktopLayout = useRef<Record<string, number>>({
    'workspace-left': 19,
    'workspace-center': 64,
    'workspace-right': 17,
  })

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!panelGroup) return
    if (compact) {
      if (!wasCompact.current) desktopLayout.current = panelGroup.getLayout()
      panelGroup.setLayout({
        'workspace-left': mobileView === 'files' ? 100 : 0,
        'workspace-center': mobileView === 'editor' ? 100 : 0,
        'workspace-right': mobileView === 'outline' ? 100 : 0,
      })
    } else if (wasCompact.current) {
      panelGroup.setLayout(desktopLayout.current)
    }
    wasCompact.current = compact
  }, [compact, mobileView, panelGroup])

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
  let statusText = t('workspace.local')

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
        <Container data-mobile-view={mobileView}>
          <SeoHead title={`${workspaceTitle} | MarkFlowy`} />
          <TopToolbar>
            <ToolbarLeft>
              <BackLink href='/workspace'>
                <i className='ri-arrow-left-line' />
                {t('workspace.title')}
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
                      aria-label={t(
                        isGitHubProvider ? 'workspace.commitMessage' : 'workspace.saveMessage',
                      )}
                      placeholder={t(
                        isGitHubProvider ? 'workspace.commitMessage' : 'workspace.saveMessage',
                      )}
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
                          {t('workspace.save')}
                          {stagedFiles.length > 1 ? ` ${stagedFiles.length}` : ''}
                        </SaveButtonState>
                        <SaveButtonState $visible={saveStatus === 'saving'}>
                          <SaveSpinner className='ri-loader-4-line' />
                          {t('workspace.saving')}
                        </SaveButtonState>
                        <SaveButtonState $visible={saveStatus === 'saved'}>
                          <i className='ri-check-line' />
                          {t('workspace.saved')}
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

          <MobilePanelNavigation aria-label={t('workspace.panels')}>
            {(['files', 'editor', 'outline'] as const).map((view) => (
              <MobilePanelButton
                type='button'
                key={view}
                aria-pressed={mobileView === view}
                onClick={() => setMobileView(view)}
              >
                {t(`workspace.${view}`)}
              </MobilePanelButton>
            ))}
          </MobilePanelNavigation>
          <MainContent groupRef={setPanelGroup} disabled={compact}>
            <Panel
              className='mf-editor-panel'
              data-section='files'
              id='workspace-left'
              defaultSize={compact ? '0%' : 240}
              minSize={compact ? 0 : 200}
              maxSize={compact ? '100%' : 320}
              collapsible={compact}
              inert={compact && mobileView !== 'files'}
            >
              <LeftSidebar>
                <SideBarHeader name={t('workspace.files')} />
                <FileTreeWrapper ref={fileTreeRef}>
                  {loadingTree ? (
                    <LoadingText>{t('workspace.loadingFiles')}</LoadingText>
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
                <StagedPanel aria-label={t('workspace.staged')}>
                  <StagedHeader>
                    <StagedTitle>
                      <i className='ri-git-commit-line' aria-hidden='true' />
                      {t('workspace.staged')}
                    </StagedTitle>
                    <StagedCount>{stagedFiles.length}</StagedCount>
                  </StagedHeader>
                  <StagedList>
                    {stagedFiles.length === 0 ? (
                      <StagedEmpty>{t('workspace.stagedEmpty')}</StagedEmpty>
                    ) : (
                      stagedFiles.map(({ file, fileId }) => (
                        <StagedItemButton
                          key={fileId}
                          type='button'
                          $active={activeId === fileId}
                          onClick={() => {
                            handleSelect(file)
                            setMobileView('editor')
                          }}
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

            <StyleSeparator className='mf-editor-separator' />

            <Panel
              className='mf-editor-panel'
              data-section='editor'
              id='workspace-center'
              minSize={compact ? 0 : 320}
              defaultSize={compact ? '100%' : undefined}
              collapsible={compact}
              inert={compact && mobileView !== 'editor'}
              groupResizeBehavior='preserve-relative-size'
            >
              <CenterArea>
                <EditorToolbar viewType={viewType} onViewTypeChange={setViewType} />
                <EditorContent ref={tocRef}>
                  {loadingFile && (
                    <EditorLoading>
                      <LoadingText>{t('workspace.loadingFile')}</LoadingText>
                    </EditorLoading>
                  )}
                  {!loadingFile && opened.length === 0 && (
                    <EditorEmpty>
                      <EmptyIcon className='ri-file-list-3-line' />
                      <EmptyText>{t('workspace.noFile')}</EmptyText>
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

            <StyleSeparator className='mf-editor-separator' />

            <Panel
              className='mf-editor-panel'
              data-section='outline'
              id='workspace-right'
              defaultSize={compact ? '0%' : 220}
              minSize={compact ? 0 : 180}
              maxSize={compact ? '100%' : 340}
              collapsible={compact}
              inert={compact && mobileView !== 'outline'}
            >
              <RightSidebar>
                <SideBarHeader name={t('workspace.outline')} />
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
              <StatusItem>
                {t(
                  `workspace.${viewType === 'wysiwyg' ? 'editor' : viewType === 'preview' ? 'previewMode' : 'source'}`,
                )}
              </StatusItem>
              <StatusItem>
                {t('workspace.headingCount', { count: currentHeadings.length })}
              </StatusItem>
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
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);

  @media (max-width: 900px) {
    .mf-editor-separator {
      display: none;
    }
  }
`

const TopToolbar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 20px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--paper);
  flex-shrink: 0;
  min-height: 64px;

  @media (max-width: 1100px) {
    gap: 10px;
    padding: 0 12px;
  }
  @media (max-width: 900px) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px 16px;
    padding: 12px 16px;
  }
`

const MobilePanelNavigation = styled.nav`
  display: none;
  @media (max-width: 900px) {
    display: flex;
    gap: 6px;
    padding: 6px 16px;
    background: var(--paper-warm);
    border-bottom: 1px solid var(--line-soft);
  }
`

const MobilePanelButton = styled(NavButton)`
  && {
    height: 32px;
    flex: 1;
    padding: 0 12px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--ink-mute);
    transition:
      color 160ms ease,
      background-color 160ms ease;
  }
  &[aria-pressed='true'] {
    background: var(--paper);
    color: var(--seal);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 10%, transparent);
  }
`

const ToolbarLeft = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
`

const ToolbarCenter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
`

const ToolbarRight = styled.div`
  flex: 0 1 auto;
  min-width: 0;
  @media (max-width: 900px) {
    grid-column: 1 / -1;
  }
  display: flex;
  align-items: center;
  justify-content: flex-end;
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${rem(4)};
  height: 34px;
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
  width: 32px;
  height: 32px;
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
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const BranchSelect = styled.select`
  height: 34px;
  padding: 0 ${rem(8)};
  font-size: ${(props) => props.theme.fontXs};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => props.theme.primaryFontColor};
  cursor: pointer;

  &:focus-visible {
    outline: none;
    text-decoration-line: underline;
    text-underline-offset: 2px;
    opacity: 0.8;
  }
`

const Actions = styled.div`
  width: 100%;
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
  height: 34px;
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
  height: 34px;
  padding: 0 ${rem(8)};
  font-size: ${(props) => props.theme.fontXs};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => props.theme.primaryFontColor};
  width: clamp(100px, 14vw, 180px);
  min-width: 0;
  @media (max-width: 900px) {
    flex: 1;
  }

  &:focus {
    outline: none;
  }
`

const SaveButton = styled.button<{ $status: 'idle' | 'saving' | 'saved' }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
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
    outline: none;
    text-decoration-line: underline;
    text-underline-offset: 2px;
    opacity: 0.8;
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
  background: ${(props) => `color-mix(in srgb, ${props.theme.dangerColor} 7%, var(--paper))`};
  border-bottom: 1px solid ${(props) => props.theme.dangerColor};
  color: ${(props) => props.theme.dangerColor};
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

  &:focus-visible {
    outline: none;
    background-color: ${(props) => props.theme.labelFontColor};
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
    outline: none;
    text-decoration-line: underline;
    text-underline-offset: 2px;
    opacity: 0.8;
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
  height: 30px;
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
  border: 3px solid var(--line-soft);
  border-top-color: var(--seal);
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
