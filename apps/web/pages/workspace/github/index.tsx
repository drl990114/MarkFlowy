import { useEffect, useState } from 'react'
import Link from 'next/link'
import styled from 'styled-components'
import { githubService, type GitHubRepo } from 'features/githubWorkspace/services/githubService'
import { useAuth } from 'hooks/useAuth'
import rem from 'utils/rem'

export default function GitHubReposPage() {
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

  if (!isAuthenticated) {
    return null
  }

  return (
    <Container>
      <Header>
        <Title>GitHub Repositories</Title>
      </Header>
      <Content>
        {loading && <Message>Loading repositories...</Message>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {!loading && !error && (
          <RepoGrid>
            {repos.map((repo) => (
              <RepoCard key={repo.id} href={`/workspace/github/${repo.owner.login}/${repo.name}`}>
                <RepoName>{repo.name}</RepoName>
                <RepoMeta>
                  {repo.owner.login} · {repo.private ? 'Private' : 'Public'}
                </RepoMeta>
                {repo.description && <RepoDesc>{repo.description}</RepoDesc>}
              </RepoCard>
            ))}
          </RepoGrid>
        )}
      </Content>
    </Container>
  )
}

const Container = styled.div`
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  padding: ${rem(24)};
`

const Header = styled.div`
  margin-bottom: ${rem(24)};
`

const Title = styled.h1`
  font-size: ${rem(24)};
  font-weight: 600;
  margin: 0;
`

const Content = styled.div`
  max-width: ${rem(960)};
`

const Message = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
`

const ErrorMessage = styled.div`
  font-size: ${rem(14)};
  color: #dc2626;
`

const RepoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${rem(280)}, 1fr));
  gap: ${rem(16)};
`

const RepoCard = styled(Link)`
  display: block;
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  padding: ${rem(16)};
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${(props) => props.theme.disabledFontColor};
  }
`

const RepoName = styled.div`
  font-size: ${rem(16)};
  font-weight: 600;
  margin-bottom: ${rem(4)};
`

const RepoMeta = styled.div`
  font-size: ${rem(12)};
  color: ${(props) => props.theme.disabledFontColor};
  margin-bottom: ${rem(8)};
`

const RepoDesc = styled.div`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.unselectedFontColor};
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
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
