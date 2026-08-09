import { githubService, type GitHubRepo } from 'features/githubWorkspace/services/githubService'
import { useGitHubWorkspaceImport } from 'features/githubWorkspace/hooks/useGitHubWorkspaceImport'
import { getRemoteWorkspaceErrorMessage } from 'features/workspace/services/remoteWorkspaceService'
import { useAuth } from 'hooks/useAuth'
import type { GitHubConnectionStatus } from '@markflowy/types'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { apiClient } from 'utils/apiClient'
import { redirectToGitHub } from 'utils/githubAuthorization'
import rem from 'utils/rem'

interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: string
  createdAt: string
}

interface WorkspaceSettings {
  id: string
  workspaceId: string
  settingsJson: Record<string, any>
}

interface Workspace {
  id: string
  name: string
  slug: string
  type: 'LOCAL' | 'SYNCED' | 'SHARED' | 'GITHUB'
  folderFingerprint: string | null
  sourceUrl: string | null
  githubRepoId: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  members?: WorkspaceMember[]
  settings?: WorkspaceSettings
}

const formatWorkspaceDate = (value?: string) => {
  if (!value) return 'Not available'

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const getRepoKey = (repo: GitHubRepo) => `${repo.installationId}:${repo.id}`

export default function WorkspaceListPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated } = useAuth(false)

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [githubConnection, setGithubConnection] = useState<GitHubConnectionStatus | null>(null)
  const [loadingGitHubConnection, setLoadingGitHubConnection] = useState(false)
  const [githubConnectionError, setGitHubConnectionError] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoError, setRepoError] = useState('')
  const [selectedRepoKey, setSelectedRepoKey] = useState('')
  const [authorizingRepositories, setAuthorizingRepositories] = useState(false)

  const [showImportModal, setShowImportModal] = useState(false)
  const { importingRepo, importError, clearImportError, importRepository } =
    useGitHubWorkspaceImport()

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    loadWorkspaces()
  }, [isAuthenticated, authLoading])

  const loadWorkspaces = async () => {
    setLoadingWorkspaces(true)
    setWorkspaceError('')
    try {
      const data = await apiClient.get<Workspace[]>('/workspaces')
      setWorkspaces(data)
    } catch (error) {
      setWorkspaceError(getRemoteWorkspaceErrorMessage(error, 'Failed to load workspaces'))
    } finally {
      setLoadingWorkspaces(false)
    }
  }

  const loadRepos = async () => {
    setLoadingRepos(true)
    setRepoError('')
    try {
      const data = await githubService.listRepos(1, 100)
      setRepos(data)
    } catch (err: any) {
      setRepoError(err?.message || 'Failed to load GitHub repositories')
    } finally {
      setLoadingRepos(false)
    }
  }

  const loadGitHubConnection = async () => {
    setLoadingGitHubConnection(true)
    setGitHubConnectionError('')
    try {
      const data = await githubService.getConnection()
      setGithubConnection(data)
      return data
    } catch (caughtError) {
      setGithubConnection(null)
      setGitHubConnectionError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Failed to load GitHub connection',
      )
      return null
    } finally {
      setLoadingGitHubConnection(false)
    }
  }

  const handleOpenImportModal = async () => {
    setShowImportModal(true)
    setSelectedRepoKey('')
    setRepos([])
    setRepoError('')
    clearImportError()

    const data = await loadGitHubConnection()
    if (data?.linked) {
      await loadRepos()
    }
  }

  const handleAuthorizeRepositories = async () => {
    if (authorizingRepositories) return

    setAuthorizingRepositories(true)
    setRepoError('')

    try {
      const locale = router.locale === router.defaultLocale ? undefined : router.locale
      const { authorizeUrl } = await githubService.startInstallation('/workspace', locale)
      redirectToGitHub(authorizeUrl)
    } catch (caughtError) {
      setRepoError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Failed to start GitHub repository authorization',
      )
      setAuthorizingRepositories(false)
    }
  }

  const handleImportRepo = async (repo: GitHubRepo) => {
    const workspace = await importRepository(repo)
    if (!workspace) return

    await loadWorkspaces()
    setShowImportModal(false)
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace?')) return
    try {
      await apiClient.delete(`/workspaces/${workspaceId}`)
      await loadWorkspaces()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete workspace')
    }
  }

  const getWorkspaceHref = (workspace: Workspace) => {
    return `/workspace/${encodeURIComponent(workspace.id)}`
  }

  const getWorkspaceTypeLabel = (type: Workspace['type']) => {
    switch (type) {
      case 'GITHUB':
        return 'GitHub'
      case 'LOCAL':
        return 'Local'
      case 'SYNCED':
        return 'Synced'
      case 'SHARED':
        return 'Shared'
      default:
        return type
    }
  }

  const getImportedWorkspace = (repo: GitHubRepo) => {
    return workspaces.find(
      (workspace) => workspace.type === 'GITHUB' && workspace.githubRepoId === repo.id,
    )
  }

  if (authLoading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
      </LoadingContainer>
    )
  }

  const myWorkspaces = workspaces.filter((w) => w.type !== 'GITHUB')
  const githubWorkspaces = workspaces.filter((w) => w.type === 'GITHUB')
  const selectedRepo = repos.find((repo) => getRepoKey(repo) === selectedRepoKey)
  const selectedImportedWorkspace = selectedRepo ? getImportedWorkspace(selectedRepo) : undefined

  return (
    <Container>
      <Header>
        <HeaderInner>
          <HeaderNavigation aria-label='Workspace navigation'>
            <BrandLink href='/' aria-label='Go to MarkFlowy home'>
              <BrandLogo src='/logo.svg' alt='' />
              <BrandName>MarkFlowy</BrandName>
            </BrandLink>
            <NavigationDivider aria-hidden='true' />
            <CurrentLocation aria-current='page'>
              <i className='ri-folder-3-line' aria-hidden='true' />
              Workspaces
            </CurrentLocation>
          </HeaderNavigation>
          <HeaderRight>
            {isAuthenticated ? (
              <>
                <SettingsLink href='/settings'>
                  <i className='ri-user-settings-line' aria-hidden='true' />
                  <span>Settings</span>
                </SettingsLink>
                <ImportButton type='button' onClick={handleOpenImportModal}>
                  <i className='ri-add-line' aria-hidden='true' />
                  Import Workspace
                </ImportButton>
              </>
            ) : (
              <GitHubSignInLink href='/auth'>
                <i className='ri-github-fill' aria-hidden='true' />
                Sign in
              </GitHubSignInLink>
            )}
          </HeaderRight>
        </HeaderInner>
      </Header>

      <Content>
        <PageIntro>
          <PageIntroCopy>
            <PageEyebrow>Workspace hub</PageEyebrow>
            <Title>Workspaces</Title>
            <Subtitle>
              Open the local demo or connect GitHub repositories for focused Markdown editing.
            </Subtitle>
          </PageIntroCopy>
          <PageStatus>
            <StatusDot aria-hidden='true' />
            {isAuthenticated
              ? `${workspaces.length} synced workspace${workspaces.length === 1 ? '' : 's'}`
              : 'Demo workspace ready'}
          </PageStatus>
        </PageIntro>
        <WorkspaceShell>
          {workspaceError && (
            <ErrorPanel>
              <i className='ri-error-warning-line' />
              <span>{workspaceError}</span>
            </ErrorPanel>
          )}
          <SectionStack>
            {!isAuthenticated && (
              <Section>
                <SectionHeader>
                  <SectionHeading>
                    <SectionIcon className='ri-history-line' aria-hidden='true' />
                    <SectionTitle>Recent</SectionTitle>
                  </SectionHeading>
                  <SectionMeta>Pinned preview</SectionMeta>
                </SectionHeader>
                <WorkspaceList>
                  <WorkspaceRow href='/workspace/demo-workspace'>
                    <WorkspaceIcon $variant='demo'>
                      <i className='ri-folder-3-line' />
                    </WorkspaceIcon>
                    <WorkspaceMain>
                      <WorkspaceName>Demo Workspace</WorkspaceName>
                      <WorkspacePath>/workspace/demo-workspace</WorkspacePath>
                    </WorkspaceMain>
                    <WorkspaceTags>
                      <WorkspaceTag>Demo</WorkspaceTag>
                      <WorkspaceTag>Local</WorkspaceTag>
                    </WorkspaceTags>
                    <OpenIndicator className='ri-arrow-right-s-line' />
                  </WorkspaceRow>
                </WorkspaceList>
              </Section>
            )}

            {!isAuthenticated && (
              <Section aria-labelledby='github-workspaces-heading'>
                <SectionHeader>
                  <SectionHeading>
                    <SectionIcon className='ri-github-fill' aria-hidden='true' />
                    <SectionTitle id='github-workspaces-heading'>GitHub</SectionTitle>
                  </SectionHeading>
                  <SectionMeta>Sign-in required</SectionMeta>
                </SectionHeader>
                <GitHubLockedState>
                  <WorkspaceIcon $variant='github'>
                    <i className='ri-github-fill' aria-hidden='true' />
                  </WorkspaceIcon>
                  <GitHubLockedCopy>
                    <WorkspaceName>Open a GitHub repository as a workspace</WorkspaceName>
                    <EmptyTextLine>
                      Sign in first, then connect GitHub and choose the repositories MarkFlowy may
                      access.
                    </EmptyTextLine>
                  </GitHubLockedCopy>
                  <GitHubLockedLink href='/auth'>Sign in</GitHubLockedLink>
                </GitHubLockedState>
              </Section>
            )}

            {isAuthenticated && myWorkspaces.length > 0 && (
              <Section>
                <SectionHeader>
                  <SectionHeading>
                    <SectionIcon className='ri-folder-shared-line' aria-hidden='true' />
                    <SectionTitle>Local & Shared</SectionTitle>
                  </SectionHeading>
                  <SectionMeta>
                    {myWorkspaces.length} workspace{myWorkspaces.length === 1 ? '' : 's'}
                  </SectionMeta>
                </SectionHeader>
                <WorkspaceList>
                  {myWorkspaces.map((workspace) => (
                    <WorkspaceRow key={workspace.id} href={getWorkspaceHref(workspace)}>
                      <WorkspaceIcon $variant='local'>
                        <i className='ri-folder-3-line' />
                      </WorkspaceIcon>
                      <WorkspaceMain>
                        <WorkspaceName>{workspace.name}</WorkspaceName>
                        <WorkspacePath>{workspace.sourceUrl || workspace.slug}</WorkspacePath>
                      </WorkspaceMain>
                      <WorkspaceTags>
                        <WorkspaceTag>{getWorkspaceTypeLabel(workspace.type)}</WorkspaceTag>
                        <WorkspaceTag>{formatWorkspaceDate(workspace.updatedAt)}</WorkspaceTag>
                      </WorkspaceTags>
                      <DeleteButton
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeleteWorkspace(workspace.id)
                        }}
                        aria-label={`Delete ${workspace.name}`}
                        title={`Delete ${workspace.name}`}
                      >
                        <i className='ri-delete-bin-line' />
                      </DeleteButton>
                    </WorkspaceRow>
                  ))}
                </WorkspaceList>
              </Section>
            )}

            {isAuthenticated && githubWorkspaces.length > 0 && (
              <Section>
                <SectionHeader>
                  <SectionHeading>
                    <SectionIcon className='ri-github-fill' aria-hidden='true' />
                    <SectionTitle>GitHub</SectionTitle>
                  </SectionHeading>
                  <SectionMeta>
                    {githubWorkspaces.length} repository workspace
                    {githubWorkspaces.length === 1 ? '' : 's'}
                  </SectionMeta>
                </SectionHeader>
                <WorkspaceList>
                  {githubWorkspaces.map((workspace) => (
                    <WorkspaceRow key={workspace.id} href={getWorkspaceHref(workspace)}>
                      <WorkspaceIcon $variant='github'>
                        <i className='ri-github-fill' />
                      </WorkspaceIcon>
                      <WorkspaceMain>
                        <WorkspaceName>{workspace.name}</WorkspaceName>
                        <WorkspacePath>{workspace.sourceUrl || workspace.slug}</WorkspacePath>
                      </WorkspaceMain>
                      <WorkspaceTags>
                        <WorkspaceTag>GitHub</WorkspaceTag>
                        <WorkspaceTag>{formatWorkspaceDate(workspace.updatedAt)}</WorkspaceTag>
                      </WorkspaceTags>
                      <DeleteButton
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeleteWorkspace(workspace.id)
                        }}
                        aria-label={`Delete ${workspace.name}`}
                        title={`Delete ${workspace.name}`}
                      >
                        <i className='ri-delete-bin-line' />
                      </DeleteButton>
                    </WorkspaceRow>
                  ))}
                </WorkspaceList>
              </Section>
            )}

            {loadingWorkspaces && <LoadingText>Loading workspaces...</LoadingText>}

            {isAuthenticated && !loadingWorkspaces && workspaces.length === 0 && (
              <EmptyPanel>
                <i className='ri-inbox-2-line' />
                <EmptyCopy>
                  <EmptyTitle>No synced workspaces yet.</EmptyTitle>
                  <EmptyTextLine>Import a GitHub repository when you are ready.</EmptyTextLine>
                </EmptyCopy>
              </EmptyPanel>
            )}
          </SectionStack>
        </WorkspaceShell>
      </Content>

      {showImportModal && (
        <ModalOverlay onClick={() => setShowImportModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Import Workspace</ModalTitle>
              <ModalClose
                onClick={() => setShowImportModal(false)}
                aria-label='Close'
                title='Close'
              >
                <i className='ri-close-line' />
              </ModalClose>
            </ModalHeader>
            <ModalBody>
              {loadingGitHubConnection && <LoadingText>Checking GitHub connection...</LoadingText>}

              {!loadingGitHubConnection && githubConnectionError && (
                <ErrorPanel>
                  <i className='ri-error-warning-line' />
                  <span>{githubConnectionError}</span>
                </ErrorPanel>
              )}

              {!loadingGitHubConnection && !githubConnectionError && !githubConnection?.linked && (
                <SetupPanel>
                  <SetupIcon>
                    <i className='ri-github-fill' />
                  </SetupIcon>
                  <SetupCopy>
                    <SetupTitle>Connect GitHub first</SetupTitle>
                    <SetupText>
                      Link your GitHub account in personal settings before importing a repository
                      workspace.
                    </SetupText>
                  </SetupCopy>
                  <SetupLink href='/settings#github'>
                    Link GitHub
                    <i className='ri-arrow-right-line' />
                  </SetupLink>
                </SetupPanel>
              )}

              {!loadingGitHubConnection &&
                !githubConnectionError &&
                githubConnection?.linked && (
                  <ImportForm>
                    <ImportField>
                      <FieldLabel htmlFor='github-repo-select'>GitHub repository</FieldLabel>
                      <RepoSelect
                        id='github-repo-select'
                        value={selectedRepoKey}
                        onChange={(e) => setSelectedRepoKey(e.target.value)}
                        disabled={loadingRepos || authorizingRepositories || !!importingRepo}
                      >
                        <option value=''>
                          {loadingRepos ? 'Loading repositories...' : 'Select a repository'}
                        </option>
                        {repos.map((repo) => (
                          <option key={getRepoKey(repo)} value={getRepoKey(repo)}>
                            {repo.full_name}
                          </option>
                        ))}
                      </RepoSelect>
                    </ImportField>

                    {(repoError || importError) && (
                      <ErrorPanel>
                        <i className='ri-error-warning-line' />
                        <span>{repoError || importError}</span>
                      </ErrorPanel>
                    )}

                    {!loadingRepos && repos.length === 0 && !repoError && (
                      <SetupPanel>
                        <SetupIcon>
                          <i className='ri-github-fill' />
                        </SetupIcon>
                        <SetupCopy>
                          <SetupTitle>No authorized repositories found</SetupTitle>
                          <SetupText>
                            Choose the GitHub repositories that MarkFlowy can import and edit.
                          </SetupText>
                        </SetupCopy>
                        <ImportRepoButton
                          type='button'
                          onClick={handleAuthorizeRepositories}
                          disabled={authorizingRepositories}
                        >
                          {authorizingRepositories ? 'Opening GitHub...' : 'Choose Repositories'}
                        </ImportRepoButton>
                      </SetupPanel>
                    )}

                    {selectedRepo && (
                      <SelectedRepoPanel>
                        <RepoInfo>
                          <RepoName>{selectedRepo.full_name}</RepoName>
                          {selectedRepo.description && (
                            <RepoDesc>{selectedRepo.description}</RepoDesc>
                          )}
                          <RepoMeta>
                            <RepoTag $private={selectedRepo.private}>
                              {selectedRepo.private ? 'Private' : 'Public'}
                            </RepoTag>
                            <RepoUpdated>
                              Updated {new Date(selectedRepo.updated_at).toLocaleDateString()}
                            </RepoUpdated>
                          </RepoMeta>
                        </RepoInfo>
                      </SelectedRepoPanel>
                    )}

                    {selectedImportedWorkspace && (
                      <NoticePanel>
                        <i className='ri-checkbox-circle-line' />
                        <span>This repository is already imported.</span>
                        <ExistingWorkspaceLink href={getWorkspaceHref(selectedImportedWorkspace)}>
                          Open
                        </ExistingWorkspaceLink>
                      </NoticePanel>
                    )}

                    <ModalActions>
                      <ImportRepoButton
                        onClick={() => selectedRepo && handleImportRepo(selectedRepo)}
                        disabled={
                          !selectedRepo ||
                          !!selectedImportedWorkspace ||
                          authorizingRepositories ||
                          !!importingRepo
                        }
                      >
                        {importingRepo === selectedRepo?.full_name
                          ? 'Importing...'
                          : 'Import Repository'}
                      </ImportRepoButton>
                    </ModalActions>
                  </ImportForm>
                )}
            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  )
}

const workspacePalette = {
  page: '#0d0d0f',
  header: 'rgba(13, 13, 15, 0.86)',
  surface: '#141416',
  surfaceRaised: '#1b1b1f',
  surfaceMuted: '#111113',
  line: 'rgba(232, 230, 227, 0.09)',
  lineStrong: 'rgba(232, 230, 227, 0.15)',
  text: '#ececea',
  textMuted: '#a0a09c',
  textFaint: '#777873',
  accent: '#d4564a',
  accentHover: '#e06357',
  accentSoft: 'rgba(212, 86, 74, 0.14)',
  danger: '#ff6b64',
  success: '#73c991',
}

const Container = styled.div`
  min-height: 100vh;
  background:
    radial-gradient(circle at 50% ${rem(-260)}, rgba(212, 86, 74, 0.13), transparent ${rem(520)}),
    ${workspacePalette.page};
  color: ${workspacePalette.text};
  font-family: ${(props) => props.theme.fontFamily};
`

const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid ${workspacePalette.line};
  background: ${workspacePalette.header};
  backdrop-filter: blur(${rem(18)});
  -webkit-backdrop-filter: blur(${rem(18)});
`

const HeaderInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: ${rem(1180)};
  min-height: ${rem(64)};
  margin: 0 auto;
  padding: 0 ${rem(28)};
  gap: ${rem(18)};

  @media (max-width: 720px) {
    min-height: ${rem(58)};
    padding: 0 ${rem(14)};
    gap: ${rem(10)};
  }
`

const HeaderNavigation = styled.nav`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  min-width: 0;
`

const BrandLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: ${rem(40)};
  gap: ${rem(9)};
  color: ${workspacePalette.text};
  text-decoration: none;
  border-radius: ${rem(8)};

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 3px;
  }
`

const BrandLogo = styled.img`
  width: ${rem(25)};
  height: ${rem(25)};
  flex: 0 0 auto;
`

const BrandName = styled.strong`
  font-size: ${rem(15)};
  font-weight: 700;
  letter-spacing: -0.01em;

  @media (max-width: 350px) {
    display: none;
  }
`

const NavigationDivider = styled.span`
  width: 1px;
  height: ${rem(20)};
  background: ${workspacePalette.lineStrong};

  @media (max-width: 720px) {
    display: none;
  }
`

const CurrentLocation = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${rem(7)};
  color: ${workspacePalette.textMuted};
  font-size: ${rem(13)};
  white-space: nowrap;

  i {
    color: ${workspacePalette.accent};
    font-size: ${rem(15)};
  }

  @media (max-width: 720px) {
    display: none;
  }
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  flex-shrink: 0;
`

const HeaderActionLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(7)};
  height: ${rem(36)};
  padding: 0 ${rem(13)};
  background: ${workspacePalette.surfaceRaised};
  border: 1px solid ${workspacePalette.lineStrong};
  border-radius: ${rem(8)};
  font-size: ${rem(13)};
  font-weight: 600;
  color: ${workspacePalette.text};
  text-decoration: none;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  white-space: nowrap;

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: #202127;
      border-color: rgba(232, 230, 227, 0.22);
      color: #ffffff;
    }
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }
`

const SettingsLink = styled(HeaderActionLink)`
  min-width: ${rem(104)};

  @media (max-width: 720px) {
    width: ${rem(36)};
    min-width: ${rem(36)};
    padding: 0;

    span {
      display: none;
    }
  }
`

const ImportButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(7)};
  min-width: ${rem(156)};
  height: ${rem(36)};
  padding: 0 ${rem(15)};
  background: ${workspacePalette.accent};
  border: 1px solid ${workspacePalette.accent};
  border-radius: ${rem(8)};
  font-size: ${rem(13)};
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  white-space: nowrap;

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: ${workspacePalette.accentHover};
      border-color: ${workspacePalette.accentHover};
    }
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    min-width: ${rem(132)};
  }
`

const GitHubSignInLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(7)};
  min-width: ${rem(94)};
  height: ${rem(36)};
  padding: 0 ${rem(15)};
  background: ${workspacePalette.accent};
  border: 1px solid ${workspacePalette.accent};
  border-radius: ${rem(8)};
  color: #ffffff;
  font-size: ${rem(13)};
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: ${workspacePalette.accentHover};
      border-color: ${workspacePalette.accentHover};
    }
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }

`

const PageIntro = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${rem(28)};
  margin-bottom: ${rem(28)};
  padding: ${rem(8)} ${rem(2)} 0;

  @media (max-width: 720px) {
    align-items: flex-start;
    flex-direction: column;
    gap: ${rem(14)};
    margin-bottom: ${rem(22)};
    padding-top: ${rem(2)};
  }
`

const PageIntroCopy = styled.div`
  min-width: 0;
`

const PageEyebrow = styled.div`
  margin-bottom: ${rem(8)};
  color: ${workspacePalette.accent};
  font-size: ${rem(11)};
  font-weight: 800;
  letter-spacing: 0.13em;
  line-height: 1;
  text-transform: uppercase;
`

const Title = styled.h1`
  margin: 0;
  color: ${workspacePalette.text};
  font-size: clamp(${rem(30)}, 4vw, ${rem(36)});
  font-weight: 720;
  letter-spacing: -0.035em;
  line-height: 1.08;
`

const Subtitle = styled.p`
  max-width: ${rem(690)};
  margin: ${rem(10)} 0 0;
  color: ${workspacePalette.textMuted};
  font-size: ${rem(14)};
  line-height: 1.6;
`

const PageStatus = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${rem(8)};
  min-height: ${rem(30)};
  padding: 0 ${rem(11)};
  border: 1px solid ${workspacePalette.line};
  border-radius: ${rem(999)};
  background: rgba(20, 20, 22, 0.72);
  color: ${workspacePalette.textMuted};
  font-size: ${rem(12)};
  font-weight: 600;
  white-space: nowrap;
`

const StatusDot = styled.span`
  width: ${rem(7)};
  height: ${rem(7)};
  border-radius: 50%;
  background: ${workspacePalette.success};
  box-shadow: 0 0 0 ${rem(3)} rgba(115, 201, 145, 0.12);
`

const Content = styled.main`
  width: 100%;
  max-width: ${rem(1180)};
  margin: 0 auto;
  padding: ${rem(38)} ${rem(28)} ${rem(52)};

  @media (max-width: 720px) {
    padding: ${rem(24)} ${rem(14)} ${rem(32)};
  }
`

const WorkspaceShell = styled.div`
  min-width: 0;
`

const SectionStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(16)};
`

const GitHubLockedState = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(14)};
  min-height: ${rem(88)};
  padding: ${rem(16)} ${rem(18)};

  @media (max-width: 640px) {
    align-items: stretch;
    flex-direction: column;
  }
`

const GitHubLockedCopy = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${rem(3)};
  min-width: 0;
`

const GitHubLockedLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${rem(92)};
  min-height: ${rem(34)};
  padding: 0 ${rem(13)};
  border: 1px solid ${workspacePalette.lineStrong};
  border-radius: ${rem(7)};
  background: ${workspacePalette.surfaceRaised};
  color: ${workspacePalette.text};
  font-size: ${rem(13)};
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    border-color: ${workspacePalette.accent};
    color: ${workspacePalette.accent};
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    width: 100%;
  }
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${workspacePalette.page};
`

const LoadingSpinner = styled.div`
  width: ${rem(40)};
  height: ${rem(40)};
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: ${workspacePalette.accent};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

const Section = styled.section`
  border: 1px solid ${workspacePalette.lineStrong};
  background: rgba(20, 20, 22, 0.92);
  border-radius: ${rem(12)};
  overflow: hidden;
  box-shadow: 0 ${rem(12)} ${rem(36)} rgba(0, 0, 0, 0.12);
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: ${rem(52)};
  padding: 0 ${rem(18)};
  border-bottom: 1px solid ${workspacePalette.line};
  background: rgba(17, 17, 19, 0.78);
  gap: ${rem(12)};
`

const SectionHeading = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(9)};
  min-width: 0;
`

const SectionIcon = styled.i`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${rem(26)};
  height: ${rem(26)};
  border: 1px solid rgba(212, 86, 74, 0.2);
  border-radius: ${rem(7)};
  background: ${workspacePalette.accentSoft};
  color: ${workspacePalette.accent};
  font-size: ${rem(14)};
  flex: 0 0 auto;
`

const SectionTitle = styled.h2`
  font-size: ${rem(13)};
  font-weight: 700;
  line-height: 1.35;
  margin: 0;
  color: ${workspacePalette.text};
`

const SectionMeta = styled.span`
  min-height: ${rem(24)};
  display: inline-flex;
  align-items: center;
  padding: 0 ${rem(8)};
  border: 1px solid ${workspacePalette.line};
  border-radius: ${rem(999)};
  background: rgba(27, 27, 31, 0.64);
  font-size: ${rem(11)};
  color: ${workspacePalette.textFaint};
  white-space: nowrap;
`

const WorkspaceList = styled.div`
  display: flex;
  flex-direction: column;
`

const WorkspaceRow = styled(Link)`
  display: grid;
  grid-template-columns: ${rem(38)} minmax(0, 1fr) auto ${rem(32)};
  align-items: center;
  gap: ${rem(14)};
  min-height: ${rem(72)};
  padding: ${rem(14)} ${rem(18)};
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid ${workspacePalette.line};
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;

  &:last-child {
    border-bottom: 0;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: rgba(27, 27, 31, 0.9);
    }
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: -2px;
  }

  @media (max-width: 720px) {
    grid-template-columns: ${rem(38)} minmax(0, 1fr) ${rem(32)};
    gap: ${rem(10)};
    padding: ${rem(13)} ${rem(14)};
  }
`

const WorkspaceIcon = styled.div<{ $variant: 'demo' | 'local' | 'github' }>`
  width: ${rem(38)};
  height: ${rem(38)};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => (props.$variant === 'github' ? '#0f1012' : workspacePalette.accentSoft)};
  border: 1px solid
    ${(props) =>
      props.$variant === 'github' ? 'rgba(232, 230, 227, 0.14)' : 'rgba(212, 86, 74, 0.28)'};
  border-radius: ${rem(10)};
  color: ${(props) =>
    props.$variant === 'github' ? workspacePalette.text : workspacePalette.accent};
  font-size: ${rem(18)};
  flex-shrink: 0;
`

const WorkspaceMain = styled.div`
  min-width: 0;
`

const WorkspaceName = styled.div`
  font-size: ${rem(14)};
  font-weight: 700;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const WorkspacePath = styled.div`
  margin-top: ${rem(2)};
  color: ${workspacePalette.textMuted};
  font-size: ${rem(13)};
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const WorkspaceTags = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${rem(6)};
  min-width: 0;

  @media (max-width: 720px) {
    display: none;
  }
`

const WorkspaceTag = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: ${rem(24)};
  padding: 0 ${rem(8)};
  background: rgba(13, 13, 15, 0.72);
  border: 1px solid ${workspacePalette.line};
  color: ${workspacePalette.textMuted};
  font-size: ${rem(12)};
  font-weight: 600;
  border-radius: ${rem(999)};
  white-space: nowrap;
`

const EmptyPanel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  min-height: ${rem(72)};
  padding: ${rem(16)};
  border: 1px dashed ${workspacePalette.lineStrong};
  border-radius: ${rem(8)};
  background: ${workspacePalette.surfaceMuted};
  color: ${workspacePalette.textMuted};

  i {
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${rem(36)};
    height: ${rem(36)};
    border: 1px solid ${workspacePalette.line};
    border-radius: ${rem(8)};
    color: ${workspacePalette.textFaint};
    font-size: ${rem(18)};
    flex: 0 0 auto;
  }
`

const EmptyCopy = styled.div`
  min-width: 0;
`

const EmptyTitle = styled.div`
  color: ${workspacePalette.text};
  font-size: ${rem(14)};
  font-weight: 700;
  line-height: 1.35;
`

const EmptyTextLine = styled.div`
  margin-top: ${rem(2)};
  color: ${workspacePalette.textMuted};
  font-size: ${rem(13)};
  line-height: 1.45;
`

const OpenIndicator = styled.i`
  color: ${workspacePalette.textFaint};
  font-size: ${rem(20)};
  justify-self: center;
`

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(30)};
  height: ${rem(30)};
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${rem(7)};
  color: ${workspacePalette.textFaint};
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
  justify-self: center;

  &:hover {
    background: rgba(255, 107, 100, 0.1);
    border-color: rgba(255, 107, 100, 0.28);
    color: ${workspacePalette.danger};
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.danger};
    outline-offset: 2px;
  }
`

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: ${rem(18)};
  backdrop-filter: blur(${rem(10)});
`

const ModalContent = styled.div`
  background: ${workspacePalette.surface};
  border: 1px solid ${workspacePalette.lineStrong};
  border-radius: ${rem(8)};
  width: 100%;
  max-width: ${rem(700)};
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 ${rem(24)} ${rem(70)} rgba(0, 0, 0, 0.42);
`

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: ${rem(54)};
  padding: 0 ${rem(18)};
  border-bottom: 1px solid ${workspacePalette.line};
  background: ${workspacePalette.surfaceMuted};
`

const ModalTitle = styled.h3`
  font-size: ${rem(16)};
  font-weight: 700;
  margin: 0;
`

const ModalClose = styled.button`
  background: transparent;
  border: 1px solid transparent;
  width: ${rem(30)};
  height: ${rem(30)};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${rem(7)};
  font-size: ${rem(18)};
  color: ${workspacePalette.textMuted};
  cursor: pointer;
  line-height: 1;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    background: ${workspacePalette.surfaceRaised};
    border-color: ${workspacePalette.line};
    color: ${workspacePalette.text};
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }
`

const ModalBody = styled.div`
  padding: ${rem(18)};
  overflow-y: auto;
  flex: 1;
`

const ImportForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(14)};
`

const ImportField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(7)};
`

const FieldLabel = styled.label`
  font-size: ${rem(12)};
  font-weight: 700;
  color: ${workspacePalette.textMuted};
`

const RepoSelect = styled.select`
  width: 100%;
  min-height: ${rem(38)};
  padding: 0 ${rem(12)};
  background: ${workspacePalette.surfaceMuted};
  border: 1px solid ${workspacePalette.lineStrong};
  border-radius: ${rem(7)};
  color: ${workspacePalette.text};
  font-size: ${rem(14)};
  outline: none;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;

  &:focus {
    border-color: ${workspacePalette.accent};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const SelectedRepoPanel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(12)} ${rem(14)};
  background: ${workspacePalette.surfaceMuted};
  border: 1px solid ${workspacePalette.line};
  border-radius: ${rem(8)};
  gap: ${rem(12)};
`

const RepoInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const RepoName = styled.div`
  font-size: ${rem(14)};
  font-weight: 700;
  margin-bottom: ${rem(4)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RepoDesc = styled.div`
  font-size: ${rem(13)};
  color: ${workspacePalette.textMuted};
  margin-bottom: ${rem(6)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RepoMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  min-width: 0;
`

const RepoTag = styled.span<{ $private: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: ${rem(22)};
  padding: 0 ${rem(8)};
  background: ${(props) =>
    props.$private ? 'rgba(255, 107, 100, 0.11)' : 'rgba(115, 201, 145, 0.11)'};
  border: 1px solid
    ${(props) => (props.$private ? 'rgba(255, 107, 100, 0.24)' : 'rgba(115, 201, 145, 0.24)')};
  color: ${(props) => (props.$private ? workspacePalette.danger : workspacePalette.success)};
  font-size: ${rem(12)};
  font-weight: 700;
  border-radius: ${rem(6)};
`

const RepoUpdated = styled.span`
  font-size: ${rem(12)};
  color: ${workspacePalette.textFaint};
  white-space: nowrap;
`

const ModalActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${rem(8)};
`

const ImportRepoButton = styled.button`
  min-height: ${rem(36)};
  padding: 0 ${rem(15)};
  background: ${workspacePalette.accent};
  border: 1px solid ${workspacePalette.accent};
  border-radius: ${rem(7)};
  font-size: ${rem(14)};
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    opacity 0.16s ease;

  &:hover:not(:disabled) {
    background: ${workspacePalette.accentHover};
    border-color: ${workspacePalette.accentHover};
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.58;
    cursor: not-allowed;
  }
`

const SetupPanel = styled.div`
  display: grid;
  grid-template-columns: ${rem(38)} minmax(0, 1fr) auto;
  align-items: center;
  gap: ${rem(13)};
  padding: ${rem(14)};
  background: ${workspacePalette.surfaceMuted};
  border: 1px solid ${workspacePalette.line};
  border-radius: ${rem(8)};

  @media (max-width: 640px) {
    grid-template-columns: ${rem(38)} minmax(0, 1fr);
  }
`

const SetupIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(38)};
  height: ${rem(38)};
  background: #0f1012;
  border: 1px solid ${workspacePalette.lineStrong};
  border-radius: ${rem(8)};
  color: ${workspacePalette.text};
  font-size: ${rem(19)};
`

const SetupCopy = styled.div`
  min-width: 0;
`

const SetupTitle = styled.div`
  font-size: ${rem(14)};
  font-weight: 700;
  line-height: 1.35;
`

const SetupText = styled.div`
  margin-top: ${rem(3)};
  font-size: ${rem(13)};
  color: ${workspacePalette.textMuted};
  line-height: 1.5;
`

const SetupLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(6)};
  min-height: ${rem(34)};
  padding: 0 ${rem(13)};
  background: ${workspacePalette.accent};
  border: 1px solid ${workspacePalette.accent};
  border-radius: ${rem(7)};
  color: #ffffff;
  font-size: ${rem(14)};
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: ${workspacePalette.accentHover};
    border-color: ${workspacePalette.accentHover};
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    grid-column: 1 / -1;
  }
`

const ErrorPanel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  min-height: ${rem(38)};
  padding: ${rem(9)} ${rem(11)};
  background: rgba(255, 107, 100, 0.1);
  border: 1px solid rgba(255, 107, 100, 0.24);
  border-radius: ${rem(8)};
  color: ${workspacePalette.danger};
  font-size: ${rem(14)};
`

const NoticePanel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  min-height: ${rem(38)};
  padding: ${rem(9)} ${rem(11)};
  background: rgba(115, 201, 145, 0.1);
  border: 1px solid rgba(115, 201, 145, 0.24);
  border-radius: ${rem(8)};
  color: ${workspacePalette.success};
  font-size: ${rem(14)};
`

const ExistingWorkspaceLink = styled(Link)`
  margin-left: auto;
  color: inherit;
  font-weight: 700;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const LoadingText = styled.div`
  font-size: ${rem(14)};
  color: ${workspacePalette.textMuted};
  text-align: center;
  padding: ${rem(18)} 0;
`
