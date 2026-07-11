import { githubService } from 'features/githubWorkspace/services/githubService'
import { useGitHubWorkspaceImport } from 'features/githubWorkspace/hooks/useGitHubWorkspaceImport'
import {
  getGitHubWorkspaceErrorMessage,
  type GitHubRepo,
} from 'features/githubWorkspace/services/workspaceGitHubService'
import { useAuth } from 'hooks/useAuth'
import type { GitHubConfig } from '@markflowy/types'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { apiClient } from 'utils/apiClient'
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

export default function WorkspaceListPage() {
  const { loading: authLoading, isAuthenticated } = useAuth(false)

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null)
  const [loadingGitHubConfig, setLoadingGitHubConfig] = useState(false)
  const [githubConfigError, setGitHubConfigError] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoError, setRepoError] = useState('')
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('')

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
      setWorkspaceError(getGitHubWorkspaceErrorMessage(error, 'Failed to load workspaces'))
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

  const loadGitHubConfig = async () => {
    setLoadingGitHubConfig(true)
    setGitHubConfigError('')
    try {
      const data = await apiClient.get<GitHubConfig>('/github/config')
      setGithubConfig(data)
      return data
    } catch (err: any) {
      setGithubConfig(null)
      setGitHubConfigError(err?.message || 'Failed to load GitHub configuration')
      return null
    } finally {
      setLoadingGitHubConfig(false)
    }
  }

  const handleOpenImportModal = async () => {
    setShowImportModal(true)
    setSelectedRepoFullName('')
    setRepoError('')
    clearImportError()

    const data = await loadGitHubConfig()
    if (data?.hasToken) {
      await loadRepos()
    } else {
      setRepos([])
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

  const getRepoSourceUrl = (repo: GitHubRepo) => {
    return `https://github.com/${repo.owner.login}/${repo.name}`
  }

  const getImportedWorkspace = (repo: GitHubRepo) => {
    return workspaces.find(
      (workspace) =>
        workspace.type === 'GITHUB' &&
        (workspace.sourceUrl === getRepoSourceUrl(repo) ||
          Boolean(workspace.sourceUrl?.includes(repo.full_name))),
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
  const selectedRepo = repos.find((repo) => repo.full_name === selectedRepoFullName)
  const selectedImportedWorkspace = selectedRepo ? getImportedWorkspace(selectedRepo) : undefined

  return (
    <Container>
      <Header>
        <HeaderInner>
          <HeaderLeft>
            <ProductMark>
              <i className='ri-folder-3-line' />
            </ProductMark>
            <HeaderCopy>
              <Title>Workspaces</Title>
              <Subtitle>
                {workspaces.length} synced workspace{workspaces.length === 1 ? '' : 's'}
              </Subtitle>
            </HeaderCopy>
          </HeaderLeft>
          <HeaderRight>
            {isAuthenticated && (
              <>
                <SettingsLink href='/settings'>
                  <i className='ri-user-settings-line' />
                  Settings
                </SettingsLink>
                <ImportButton onClick={handleOpenImportModal}>
                  <i className='ri-add-line' />
                  Import Workspace
                </ImportButton>
              </>
            )}
          </HeaderRight>
        </HeaderInner>
      </Header>

      <Content>
        <WorkspaceShell>
          {workspaceError && (
            <ErrorPanel>
              <i className='ri-error-warning-line' />
              <span>{workspaceError}</span>
            </ErrorPanel>
          )}
          <SectionStack>
            <Section>
              <SectionHeader>
                <SectionTitle>Recent</SectionTitle>
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

            {isAuthenticated && myWorkspaces.length > 0 && (
              <Section>
                <SectionHeader>
                  <SectionTitle>Local & Shared</SectionTitle>
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
                  <SectionTitle>GitHub</SectionTitle>
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
              {loadingGitHubConfig && <LoadingText>Checking GitHub configuration...</LoadingText>}

              {!loadingGitHubConfig && githubConfigError && (
                <ErrorPanel>
                  <i className='ri-error-warning-line' />
                  <span>{githubConfigError}</span>
                </ErrorPanel>
              )}

              {!loadingGitHubConfig && !githubConfigError && !githubConfig?.hasToken && (
                <SetupPanel>
                  <SetupIcon>
                    <i className='ri-github-fill' />
                  </SetupIcon>
                  <SetupCopy>
                    <SetupTitle>Connect GitHub first</SetupTitle>
                    <SetupText>
                      Add a GitHub Personal Access Token in personal settings before importing a
                      repository workspace.
                    </SetupText>
                  </SetupCopy>
                  <SetupLink href='/settings#github'>
                    Configure Token
                    <i className='ri-arrow-right-line' />
                  </SetupLink>
                </SetupPanel>
              )}

              {!loadingGitHubConfig && githubConfig?.hasToken && (
                <ImportForm>
                  <ImportField>
                    <FieldLabel htmlFor='github-repo-select'>GitHub repository</FieldLabel>
                    <RepoSelect
                      id='github-repo-select'
                      value={selectedRepoFullName}
                      onChange={(e) => setSelectedRepoFullName(e.target.value)}
                      disabled={loadingRepos || !!importingRepo}
                    >
                      <option value=''>
                        {loadingRepos ? 'Loading repositories...' : 'Select a repository'}
                      </option>
                      {repos.map((repo) => (
                        <option key={repo.id} value={repo.full_name}>
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
                    <EmptyText>No GitHub repositories found.</EmptyText>
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
                      disabled={!selectedRepo || !!selectedImportedWorkspace || !!importingRepo}
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
  page: '#101012',
  header: 'rgba(16, 16, 18, 0.96)',
  surface: '#151518',
  surfaceRaised: '#1a1b1f',
  surfaceMuted: '#121214',
  line: 'rgba(232, 230, 227, 0.10)',
  lineStrong: 'rgba(232, 230, 227, 0.16)',
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
  background: ${workspacePalette.page};
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
`

const HeaderInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: ${rem(1180)};
  min-height: ${rem(78)};
  margin: 0 auto;
  padding: 0 ${rem(28)};
  gap: ${rem(18)};

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
    min-height: auto;
    padding: ${rem(16)} ${rem(14)};
  }
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  min-width: 0;
`

const ProductMark = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(36)};
  height: ${rem(36)};
  color: ${workspacePalette.accent};
  background: ${workspacePalette.surfaceRaised};
  border: 1px solid ${workspacePalette.lineStrong};
  border-radius: ${rem(8)};
  flex: 0 0 auto;
  font-size: ${rem(19)};
`

const HeaderCopy = styled.div`
  min-width: 0;
`

const Title = styled.h1`
  font-size: ${rem(24)};
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0;
  margin: 0;
`

const Subtitle = styled.p`
  font-size: ${rem(13)};
  color: ${workspacePalette.textMuted};
  margin: ${rem(3)} 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  flex-shrink: 0;

  @media (max-width: 720px) {
    width: 100%;
  }
`

const SettingsLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(7)};
  min-width: ${rem(110)};
  height: ${rem(36)};
  padding: 0 ${rem(13)};
  background: ${workspacePalette.surfaceRaised};
  border: 1px solid ${workspacePalette.lineStrong};
  border-radius: ${rem(7)};
  font-size: ${rem(14)};
  font-weight: 600;
  color: ${workspacePalette.text};
  text-decoration: none;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
  white-space: nowrap;

  &:hover {
    background: #202127;
    border-color: rgba(232, 230, 227, 0.22);
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    flex: 1;
    min-width: 0;
  }
`

const ImportButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(7)};
  min-width: ${rem(164)};
  height: ${rem(36)};
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
    border-color 0.16s ease;
  white-space: nowrap;

  &:hover {
    background: ${workspacePalette.accentHover};
    border-color: ${workspacePalette.accentHover};
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    flex: 1.2;
    min-width: 0;
  }
`

const Content = styled.main`
  width: 100%;
  max-width: ${rem(1180)};
  margin: 0 auto;
  padding: ${rem(28)} ${rem(28)} ${rem(44)};

  @media (max-width: 720px) {
    padding: ${rem(18)} ${rem(14)} ${rem(28)};
  }
`

const WorkspaceShell = styled.div`
  min-width: 0;
`

const SectionStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(14)};
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
  border: 1px solid ${workspacePalette.line};
  background: ${workspacePalette.surface};
  border-radius: ${rem(8)};
  overflow: hidden;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: ${rem(46)};
  padding: 0 ${rem(16)};
  border-bottom: 1px solid ${workspacePalette.line};
  background: ${workspacePalette.surfaceMuted};
  gap: ${rem(10)};
`

const SectionTitle = styled.h2`
  font-size: ${rem(14)};
  font-weight: 700;
  line-height: 1.35;
  margin: 0;
  color: ${workspacePalette.text};
`

const SectionMeta = styled.span`
  font-size: ${rem(12)};
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
  gap: ${rem(12)};
  min-height: ${rem(66)};
  padding: ${rem(12)} ${rem(14)};
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid ${workspacePalette.line};
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: ${workspacePalette.surfaceRaised};
  }

  &:focus-visible {
    outline: 2px solid ${workspacePalette.accent};
    outline-offset: -2px;
  }

  @media (max-width: 720px) {
    grid-template-columns: ${rem(38)} minmax(0, 1fr) ${rem(32)};
    gap: ${rem(10)};
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
  border-radius: ${rem(8)};
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
  background: #101012;
  border: 1px solid ${workspacePalette.line};
  color: ${workspacePalette.textMuted};
  font-size: ${rem(12)};
  font-weight: 600;
  border-radius: ${rem(6)};
  white-space: nowrap;
`

const EmptyText = styled.div`
  font-size: ${rem(14)};
  color: ${workspacePalette.textMuted};
  text-align: center;
  padding: ${rem(22)} 0;
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
