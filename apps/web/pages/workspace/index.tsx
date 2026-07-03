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
              <SettingsLink href='/workspace/settings/github'>
                <i className='ri-github-fill' />
                GitHub
              </SettingsLink>
              <ImportButton onClick={() => setShowImportModal(true)}>
                <i className='ri-add-line' />
                Import Repo
              </ImportButton>
            </>
          )}
        </HeaderRight>
      </Header>

      <Content>
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
                    <WorkspaceTag>
                      {new Date(workspace.updatedAt).toLocaleDateString()}
                    </WorkspaceTag>
                  </WorkspaceTags>
                  <DeleteButton
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDeleteWorkspace(workspace.id)
                    }}
                    aria-label={`Delete ${workspace.name}`}
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
                    <WorkspaceTag>
                      {new Date(workspace.updatedAt).toLocaleDateString()}
                    </WorkspaceTag>
                  </WorkspaceTags>
                  <DeleteButton
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDeleteWorkspace(workspace.id)
                    }}
                    aria-label={`Delete ${workspace.name}`}
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
            <span>No synced workspaces yet.</span>
          </EmptyPanel>
        )}
      </Content>

      {showImportModal && (
        <ModalOverlay onClick={() => setShowImportModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Import GitHub Repository</ModalTitle>
              <ModalClose onClick={() => setShowImportModal(false)} aria-label='Close'>
                <i className='ri-close-line' />
              </ModalClose>
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

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  font-family: ${(props) => props.theme.fontFamily};
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: ${rem(52)};
  padding: 0 ${rem(16)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  border-top: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.titleBarBgColor};
  flex-shrink: 0;
  gap: ${rem(16)};
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  min-width: 0;
`

const ProductMark = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(28)};
  height: ${rem(28)};
  color: ${(props) => props.theme.accentColor};
  background: ${(props) => props.theme.buttonBgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  flex: 0 0 auto;
`

const HeaderCopy = styled.div`
  min-width: 0;
`

const Title = styled.h1`
  font-size: ${(props) => props.theme.fontBase};
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
`

const Subtitle = styled.p`
  font-size: ${(props) => props.theme.fontXs};
  color: ${(props) => props.theme.disabledFontColor};
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  flex-shrink: 0;
`

const SettingsLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(6)};
  height: ${rem(28)};
  padding: 0 ${rem(10)};
  background: ${(props) => props.theme.buttonBgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 500;
  color: ${(props) => props.theme.primaryFontColor};
  text-decoration: none;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
  white-space: nowrap;

  &:hover {
    color: ${(props) => props.theme.accentColor};
    background: ${(props) => props.theme.hoverColor};
    border-color: ${(props) => props.theme.borderColorFocused};
  }
`

const ImportButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(6)};
  height: ${rem(28)};
  padding: 0 ${rem(10)};
  background: ${(props) => props.theme.accentColor};
  border: 1px solid ${(props) => props.theme.accentColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
  white-space: nowrap;

  &:hover {
    opacity: 0.9;
  }
`

const Content = styled.div`
  width: 100%;
  max-width: ${rem(1080)};
  padding: ${rem(20)} ${rem(24)} ${rem(28)};
  overflow: auto;

  @media (max-width: 720px) {
    padding: ${rem(16)} ${rem(12)} ${rem(24)};
  }
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

const Section = styled.section`
  border: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.bgColorSecondary};
  border-radius: ${(props) => props.theme.midBorderRadius};
  overflow: hidden;
  margin-bottom: ${rem(16)};
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: ${rem(36)};
  padding: 0 ${rem(12)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.sideBarHeaderBgColor};
  gap: ${rem(10)};
`

const SectionTitle = styled.h2`
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  margin: 0;
  color: ${(props) => props.theme.primaryFontColor};
`

const SectionMeta = styled.span`
  font-size: ${(props) => props.theme.fontXs};
  color: ${(props) => props.theme.disabledFontColor};
  white-space: nowrap;
`

const WorkspaceList = styled.div`
  display: flex;
  flex-direction: column;
`

const WorkspaceRow = styled(Link)`
  display: grid;
  grid-template-columns: ${rem(32)} minmax(0, 1fr) auto ${rem(24)};
  align-items: center;
  gap: ${rem(10)};
  min-height: ${rem(56)};
  padding: ${rem(8)} ${rem(10)};
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: ${(props) => props.theme.hoverColor};
  }

  @media (max-width: 720px) {
    grid-template-columns: ${rem(32)} minmax(0, 1fr) ${rem(24)};
  }
`

const WorkspaceIcon = styled.div<{ $variant: 'demo' | 'local' | 'github' }>`
  width: ${rem(32)};
  height: ${rem(32)};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.$variant === 'github' ? props.theme.buttonBgColor : props.theme.accentColorFocused};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) =>
    props.$variant === 'github' ? props.theme.primaryFontColor : props.theme.accentColor};
  font-size: ${rem(16)};
  flex-shrink: 0;
`

const WorkspaceMain = styled.div`
  min-width: 0;
`

const WorkspaceName = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const WorkspacePath = styled.div`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
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
  min-height: ${rem(22)};
  padding: 0 ${rem(8)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  white-space: nowrap;
`

const EmptyText = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(20)} 0;
`

const EmptyPanel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  min-height: ${rem(44)};
  padding: 0 ${rem(12)};
  border: 1px dashed ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};

  i {
    font-size: ${rem(16)};
  }
`

const OpenIndicator = styled.i`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${rem(18)};
  justify-self: center;
`

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(24)};
  height: ${rem(24)};
  background: transparent;
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => props.theme.disabledFontColor};
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
  justify-self: center;

  &:hover {
    background: rgba(255, 77, 79, 0.1);
    border-color: rgba(255, 77, 79, 0.3);
    color: #ff4d4f;
  }
`

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${(props) => props.theme.dialogBackdropColor};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: ${rem(16)};
`

const ModalContent = styled.div`
  background: ${(props) => props.theme.dialogBgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
  width: 100%;
  max-width: ${rem(680)};
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: ${rem(40)};
  padding: 0 ${rem(12)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.sideBarHeaderBgColor};
`

const ModalTitle = styled.h3`
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  margin: 0;
`

const ModalClose = styled.button`
  background: none;
  border: none;
  width: ${rem(24)};
  height: ${rem(24)};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${rem(16)};
  color: ${(props) => props.theme.disabledFontColor};
  cursor: pointer;
  line-height: 1;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const ModalBody = styled.div`
  padding: ${rem(12)};
  overflow-y: auto;
  flex: 1;
`

const RepoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(8)};
`

const RepoItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(10)} ${rem(12)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  gap: ${rem(12)};
`

const RepoInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const RepoName = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  margin-bottom: ${rem(4)};
`

const RepoDesc = styled.div`
  font-size: ${(props) => props.theme.fontXs};
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
  border: 1px solid
    ${(props) => (props.$private ? 'rgba(255, 77, 79, 0.2)' : 'rgba(82, 196, 26, 0.2)')};
  color: ${(props) => (props.$private ? '#ff4d4f' : '#52c41a')};
  font-size: ${(props) => props.theme.fontXs};
  border-radius: ${(props) => props.theme.smallBorderRadius};
`

const RepoActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
`

const ImportRepoButton = styled.button`
  min-height: ${rem(26)};
  padding: 0 ${rem(12)};
  background: ${(props) => props.theme.accentColor};
  border: 1px solid ${(props) => props.theme.accentColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: #b8453c;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const ImportedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: ${rem(26)};
  padding: 0 ${rem(12)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.disabledFontColor};
`

const LoadingText = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(16)} 0;
`
