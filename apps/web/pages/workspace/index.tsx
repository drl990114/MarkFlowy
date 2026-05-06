import { Empty, List, type ListDataItem } from '@markflowy/interface'
import { githubService, type GitHubRepo } from 'features/githubWorkspace/services/githubService'
import { useAuth } from 'hooks/useAuth'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'

export default function WorkspaceListPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth(true)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    githubService
      .listRepos(1, 100)
      .then((data) => {
        setRepos(data)
        setLoading(false)
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load repositories')
        setLoading(false)
      })
  }, [isAuthenticated, authLoading])

  if (authLoading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
      </LoadingContainer>
    )
  }

  // Convert repos to ListDataItem format
  const repoListData: ListDataItem[] = repos.map((repo) => ({
    key: repo.id.toString(),
    title: repo.name,
    tooltip: repo.description || repo.name,
    iconCls: 'ri-github-fill',
  }))

  const handleRepoClick = (item: ListDataItem) => {
    const repo = repos.find((r) => r.id.toString() === item.key)
    if (repo) {
      window.location.href = `/workspace/github/${repo.owner.login}/${repo.name}/detail`
    }
  }

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>Workspaces</Title>
          <Subtitle>Manage your GitHub repositories</Subtitle>
        </HeaderLeft>
        <HeaderRight>
          <SettingsLink href='/workspace/settings/github'>
            <SettingsIcon />
            GitHub Settings
          </SettingsLink>
        </HeaderRight>
      </Header>

      <SourceSection>
        <SourceHeader>
          <SourceIcon>
            <GitHubIcon />
          </SourceIcon>
          <SourceInfo>
            <SourceName>GitHub</SourceName>
            <SourceDesc>Access your GitHub repositories directly</SourceDesc>
          </SourceInfo>
        </SourceHeader>
      </SourceSection>

      <Content>
        {/* Temporary Workspace Card - Always visible */}
        <SectionTitle>Temporary Workspace</SectionTitle>
        <TempWorkspaceGrid>
          <TempWorkspaceCard href='/workspace/temp'>
            <TempWorkspaceHeader>
              <TempWorkspaceIcon>
                <EditIcon />
              </TempWorkspaceIcon>
              <TempWorkspaceBadge>Quick Start</TempWorkspaceBadge>
            </TempWorkspaceHeader>
            <TempWorkspaceName>Quick Edit</TempWorkspaceName>
            <TempWorkspaceDesc>
              Start editing immediately without signing in. Your content is stored temporarily in the browser.
            </TempWorkspaceDesc>
            <TempWorkspaceMeta>
              <TempWorkspaceTag>No login required</TempWorkspaceTag>
              <TempWorkspaceTag>Auto-save to local</TempWorkspaceTag>
            </TempWorkspaceMeta>
          </TempWorkspaceCard>
        </TempWorkspaceGrid>

        {isAuthenticated && (
          <>
            <SectionDivider />

            <SectionTitle>GitHub Repositories</SectionTitle>
            {loading && <LoadingState>Loading repositories...</LoadingState>}
            {error && <ErrorState>{error}</ErrorState>}
            {!loading && !error && repos.length === 0 && (
              <EmptyContainer>
                <Empty />
              </EmptyContainer>
            )}
            {!loading && !error && repos.length > 0 && (
              <RepoListContainer>
                <List
                  title="Your Repositories"
                  data={repoListData}
                  onItemClick={handleRepoClick}
                />
              </RepoListContainer>
            )}
          </>
        )}
      </Content>
    </Container>
  )
}

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

const HeaderRight = styled.div``

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

const SettingsIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <circle cx='12' cy='12' r='3'></circle>
    <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'></path>
  </svg>
)

const SourceSection = styled.div`
  padding: ${rem(24)} ${rem(40)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
`

const SourceHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(16)};
`

const SourceIcon = styled.div`
  width: ${rem(48)};
  height: ${rem(48)};
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #24292e 0%, #1a1e22 100%);
  border-radius: ${rem(12)};
  color: #ffffff;
`

const GitHubIcon = () => (
  <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
    <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
  </svg>
)

const SourceInfo = styled.div``

const SourceName = styled.div`
  font-size: ${rem(18)};
  font-weight: 600;
  margin-bottom: ${rem(4)};
`

const SourceDesc = styled.div`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
`

const Content = styled.div`
  padding: ${rem(32)} ${rem(40)};
  max-width: ${rem(1400)};
`

const LoadingState = styled.div`
  font-size: ${rem(15)};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(60)} 0;
`

const ErrorState = styled.div`
  font-size: ${rem(15)};
  color: #dc2626;
  text-align: center;
  padding: ${rem(60)} 0;
`

const EmptyContainer = styled.div`
  height: ${rem(200)};
  display: flex;
  align-items: center;
  justify-content: center;
`

const RepoListContainer = styled.div`
  max-width: ${rem(600)};
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

// Temporary Workspace Styles
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

const EditIcon = () => (
  <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'></path>
    <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'></path>
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
