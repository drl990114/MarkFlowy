import { githubService } from 'features/githubWorkspace/services/githubService'
import { useAuth } from 'hooks/useAuth'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { apiClient } from 'utils/apiClient'
import rem from 'utils/rem'

interface GitHubRepo {
  id: number
  full_name: string
  name: string
  owner: { login: string }
  description: string | null
  private: boolean
  updated_at: string
}

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

export default function WorkspaceListPage() {
  const { loading: authLoading, isAuthenticated } = useAuth(true)

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)

  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)

  const [showImportModal, setShowImportModal] = useState(false)
  const [importingRepo, setImportingRepo] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    loadWorkspaces()
    loadRepos()
  }, [isAuthenticated, authLoading])

  const loadWorkspaces = async () => {
    setLoadingWorkspaces(true)
    try {
      const data = await apiClient.get<Workspace[]>('/workspaces')
      setWorkspaces(data)
    } catch {
      // ignore
    } finally {
      setLoadingWorkspaces(false)
    }
  }

  const loadRepos = async () => {
    setLoadingRepos(true)
    try {
      const data = await githubService.listRepos(1, 100)
      setRepos(data)
    } catch {
      // ignore
    } finally {
      setLoadingRepos(false)
    }
  }

  const handleImportRepo = async (repo: GitHubRepo) => {
    setImportingRepo(repo.full_name)
    try {
      await apiClient.post('/workspaces', {
        name: repo.name,
        type: 'GITHUB',
        sourceUrl: `https://github.com/${repo.owner.login}/${repo.name}`,
      })
      await loadWorkspaces()
      setShowImportModal(false)
    } catch (err: any) {
      alert(err?.message || 'Failed to import repository')
    } finally {
      setImportingRepo(null)
    }
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

  if (authLoading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
      </LoadingContainer>
    )
  }

  const myWorkspaces = workspaces.filter((w) => w.type !== 'GITHUB')
  const githubWorkspaces = workspaces.filter((w) => w.type === 'GITHUB')

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>Workspaces</Title>
          <Subtitle>Manage your workspaces</Subtitle>
        </HeaderLeft>
        <HeaderRight>
          {isAuthenticated && (
            <>
              <SettingsLink href='/workspace/settings/github'>
                <SettingsIcon />
                GitHub Settings
              </SettingsLink>
              <ImportButton onClick={() => setShowImportModal(true)}>
                <PlusIcon />
                Import GitHub Repo
              </ImportButton>
            </>
          )}
        </HeaderRight>
      </Header>

      <Content>
        <SectionTitle>Demo Workspace</SectionTitle>
        <TempWorkspaceGrid>
          <TempWorkspaceCard href='/workspace/demo-workspace'>
            <TempWorkspaceHeader>
              <TempWorkspaceIcon>
                <WorkspaceIcon />
              </TempWorkspaceIcon>
              <TempWorkspaceBadge>Demo</TempWorkspaceBadge>
            </TempWorkspaceHeader>
            <TempWorkspaceName>Demo Workspace</TempWorkspaceName>
            <TempWorkspaceDesc>
              Try out the new workspace detail page with file tree, editor, and outline panels.
            </TempWorkspaceDesc>
            <TempWorkspaceMeta>
              <TempWorkspaceTag>File Tree</TempWorkspaceTag>
              <TempWorkspaceTag>Outline</TempWorkspaceTag>
              <TempWorkspaceTag>Resizable</TempWorkspaceTag>
            </TempWorkspaceMeta>
          </TempWorkspaceCard>
        </TempWorkspaceGrid>

        {isAuthenticated && myWorkspaces.length > 0 && (
          <>
            <SectionDivider />
            <SectionTitle>My Workspaces</SectionTitle>
            <TempWorkspaceGrid>
              {myWorkspaces.map((workspace) => (
                <WorkspaceCard key={workspace.id} href={getWorkspaceHref(workspace)}>
                  <TempWorkspaceHeader>
                    <TempWorkspaceIcon>
                      <WorkspaceIcon />
                    </TempWorkspaceIcon>
                    <DeleteButton
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteWorkspace(workspace.id)
                      }}
                    >
                      <TrashIcon />
                    </DeleteButton>
                  </TempWorkspaceHeader>
                  <TempWorkspaceName>{workspace.name}</TempWorkspaceName>
                  <TempWorkspaceDesc>
                    {workspace.sourceUrl || workspace.slug}
                  </TempWorkspaceDesc>
                  <TempWorkspaceMeta>
                    <TempWorkspaceTag>{getWorkspaceTypeLabel(workspace.type)}</TempWorkspaceTag>
                  </TempWorkspaceMeta>
                </WorkspaceCard>
              ))}
            </TempWorkspaceGrid>
          </>
        )}

        {isAuthenticated && githubWorkspaces.length > 0 && (
          <>
            <SectionDivider />
            <SectionTitle>GitHub Workspaces</SectionTitle>
            <TempWorkspaceGrid>
              {githubWorkspaces.map((workspace) => (
                <GitHubWorkspaceCard key={workspace.id} href={getWorkspaceHref(workspace)}>
                  <TempWorkspaceHeader>
                    <TempWorkspaceIcon>
                      <GitHubIcon />
                    </TempWorkspaceIcon>
                    <DeleteButton
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteWorkspace(workspace.id)
                      }}
                    >
                      <TrashIcon />
                    </DeleteButton>
                  </TempWorkspaceHeader>
                  <TempWorkspaceName>{workspace.name}</TempWorkspaceName>
                  <TempWorkspaceDesc>
                    {workspace.sourceUrl || workspace.slug}
                  </TempWorkspaceDesc>
                  <TempWorkspaceMeta>
                    <TempWorkspaceTag>GitHub</TempWorkspaceTag>
                  </TempWorkspaceMeta>
                </GitHubWorkspaceCard>
              ))}
            </TempWorkspaceGrid>
          </>
        )}

        {isAuthenticated && !loadingWorkspaces && workspaces.length === 0 && (
          <>
            <SectionDivider />
            <EmptyText>No workspaces yet. Import a GitHub repository to get started.</EmptyText>
          </>
        )}
      </Content>

      {showImportModal && (
        <ModalOverlay onClick={() => setShowImportModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Import GitHub Repository</ModalTitle>
              <ModalClose onClick={() => setShowImportModal(false)}>×</ModalClose>
            </ModalHeader>
            <ModalBody>
              {loadingRepos && <LoadingText>Loading repositories...</LoadingText>}
              {!loadingRepos && repos.length === 0 && (
                <EmptyText>
                  No GitHub repositories found.{' '}
                  <Link href='/workspace/settings/github'>Configure GitHub token</Link>
                </EmptyText>
              )}
              <RepoList>
                {repos.map((repo) => {
                  const alreadyImported = workspaces.some(
                    (w) => w.type === 'GITHUB' && w.sourceUrl?.includes(repo.full_name),
                  )
                  return (
                    <RepoItem key={repo.id}>
                      <RepoInfo>
                        <RepoName>{repo.full_name}</RepoName>
                        {repo.description && <RepoDesc>{repo.description}</RepoDesc>}
                        <RepoMeta>
                          <RepoTag $private={repo.private}>
                            {repo.private ? 'Private' : 'Public'}
                          </RepoTag>
                        </RepoMeta>
                      </RepoInfo>
                      <RepoActions>
                        {alreadyImported ? (
                          <ImportedBadge>Imported</ImportedBadge>
                        ) : (
                          <ImportRepoButton
                            onClick={() => handleImportRepo(repo)}
                            disabled={!!importingRepo}
                          >
                            {importingRepo === repo.full_name ? 'Importing...' : 'Import'}
                          </ImportRepoButton>
                        )}
                      </RepoActions>
                    </RepoItem>
                  )
                })}
              </RepoList>
            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  )
}

const PlusIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <line x1='12' y1='5' x2='12' y2='19'></line>
    <line x1='5' y1='12' x2='19' y2='12'></line>
  </svg>
)

const TrashIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <polyline points='3 6 5 6 21 6'></polyline>
    <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'></path>
  </svg>
)

const Container = styled.div`
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
`

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${rem(32)} ${rem(40)} ${rem(24)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.bgColorSecondary};
`

const HeaderLeft = styled.div``

const Title = styled.h1`
  font-size: ${rem(32)};
  font-weight: 700;
  margin: 0 0 ${rem(8)};
  letter-spacing: -0.02em;
`

const Subtitle = styled.p`
  font-size: ${rem(15)};
  color: ${(props) => props.theme.disabledFontColor};
  margin: 0;
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
`

const SettingsLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${rem(8)};
  padding: ${rem(8)} ${rem(16)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  font-size: ${rem(14)};
  font-weight: 500;
  color: ${(props) => props.theme.primaryFontColor};
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${(props) => props.theme.disabledFontColor};
    background: ${(props) => props.theme.bgColorSecondary};
  }
`

const ImportButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${rem(8)};
  padding: ${rem(8)} ${rem(16)};
  background: #da936a;
  border: none;
  border-radius: ${rem(8)};
  font-size: ${rem(14)};
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #c47a4f;
  }
`

const SettingsIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <circle cx='12' cy='12' r='3'></circle>
    <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'></path>
  </svg>
)

const Content = styled.div`
  padding: ${rem(32)} ${rem(40)};
  max-width: ${rem(1400)};
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

const SectionTitle = styled.h2`
  font-size: ${rem(20)};
  font-weight: 600;
  margin: 0 0 ${rem(20)};
  color: ${(props) => props.theme.primaryFontColor};
`

const SectionDivider = styled.div`
  height: 1px;
  background: ${(props) => props.theme.borderColor};
  margin: ${rem(32)} 0;
`

const TempWorkspaceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${rem(320)}, 1fr));
  gap: ${rem(20)};
  margin-bottom: ${rem(32)};
`

const TempWorkspaceCard = styled(Link)`
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, ${(props) => props.theme.bgColorSecondary} 0%, rgba(218, 147, 106, 0.05) 100%);
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(12)};
  padding: ${rem(20)};
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;

  &:hover {
    border-color: #da936a;
    box-shadow: 0 4px 12px rgba(218, 147, 106, 0.15);
    transform: translateY(-2px);
  }
`

const WorkspaceCard = styled(Link)`
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, ${(props) => props.theme.bgColorSecondary} 0%, rgba(218, 147, 106, 0.05) 100%);
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(12)};
  padding: ${rem(20)};
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;

  &:hover {
    border-color: #da936a;
    box-shadow: 0 4px 12px rgba(218, 147, 106, 0.15);
    transform: translateY(-2px);
  }
`

const GitHubWorkspaceCard = styled(Link)`
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, ${(props) => props.theme.bgColorSecondary} 0%, rgba(36, 41, 46, 0.05) 100%);
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(12)};
  padding: ${rem(20)};
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;

  &:hover {
    border-color: #24292e;
    box-shadow: 0 4px 12px rgba(36, 41, 46, 0.15);
    transform: translateY(-2px);
  }
`

const TempWorkspaceHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${rem(16)};
`

const TempWorkspaceIcon = styled.div`
  width: ${rem(48)};
  height: ${rem(48)};
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #da936a 0%, #c47a4f 100%);
  border-radius: ${rem(12)};
  color: #ffffff;
`

const WorkspaceIcon = () => (
  <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M3 7v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7'></path>
    <path d='M17 21v-8'></path>
    <path d='M7 21v-8'></path>
    <path d='M7 3v5h10V3'></path>
    <path d='M9 3h6'></path>
  </svg>
)

const GitHubIcon = () => (
  <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
    <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
  </svg>
)

const TempWorkspaceBadge = styled.span`
  padding: ${rem(4)} ${rem(10)};
  background: linear-gradient(135deg, #da936a 0%, #c47a4f 100%);
  color: #ffffff;
  font-size: ${rem(11)};
  font-weight: 600;
  border-radius: ${rem(20)};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const TempWorkspaceName = styled.div`
  font-size: ${rem(18)};
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: ${rem(8)};
`

const TempWorkspaceDesc = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.unselectedFontColor};
  line-height: 1.6;
  margin-bottom: ${rem(16)};
  flex: 1;
`

const TempWorkspaceMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${rem(8)};
`

const TempWorkspaceTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: ${rem(4)} ${rem(10)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${rem(11)};
  border-radius: ${rem(4)};
`

const EmptyText = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(20)} 0;
`

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(32)};
  height: ${rem(32)};
  background: transparent;
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  color: ${(props) => props.theme.disabledFontColor};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 77, 79, 0.1);
    border-color: rgba(255, 77, 79, 0.3);
    color: #ff4d4f;
  }
`

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`

const ModalContent = styled.div`
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(12)};
  width: 100%;
  max-width: ${rem(600)};
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(20)} ${rem(24)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
`

const ModalTitle = styled.h3`
  font-size: ${rem(18)};
  font-weight: 600;
  margin: 0;
`

const ModalClose = styled.button`
  background: none;
  border: none;
  font-size: ${rem(24)};
  color: ${(props) => props.theme.disabledFontColor};
  cursor: pointer;
  line-height: 1;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const ModalBody = styled.div`
  padding: ${rem(16)} ${rem(24)};
  overflow-y: auto;
  flex: 1;
`

const RepoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
`

const RepoItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(12)} ${rem(16)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
`

const RepoInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const RepoName = styled.div`
  font-size: ${rem(14)};
  font-weight: 600;
  margin-bottom: ${rem(4)};
`

const RepoDesc = styled.div`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  margin-bottom: ${rem(4)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RepoMeta = styled.div`
  display: flex;
  gap: ${rem(8)};
`

const RepoTag = styled.span<{ $private: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: ${rem(2)} ${rem(8)};
  background: ${(props) => (props.$private ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)')};
  border: 1px solid ${(props) => (props.$private ? 'rgba(255, 77, 79, 0.2)' : 'rgba(82, 196, 26, 0.2)')};
  color: ${(props) => (props.$private ? '#ff4d4f' : '#52c41a')};
  font-size: ${rem(11)};
  border-radius: ${rem(4)};
`

const RepoActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
`

const ImportRepoButton = styled.button`
  padding: ${rem(6)} ${rem(14)};
  background: #da936a;
  border: none;
  border-radius: ${rem(6)};
  font-size: ${rem(13)};
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: #c47a4f;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const ImportedBadge = styled.span`
  padding: ${rem(6)} ${rem(14)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
`

const LoadingText = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(16)} 0;
`
