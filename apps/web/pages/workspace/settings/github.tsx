import Link from 'next/link'
import styled from 'styled-components'
import { useAuth } from 'hooks/useAuth'
import { useGitHubSettings } from 'hooks/useGitHubSettings'
import rem from 'utils/rem'

export default function GitHubSettingsPage() {
  const { loading: authLoading, isAuthenticated } = useAuth(true)
  const {
    config,
    loading,
    token,
    setToken,
    saving,
    error,
    success,
    repos,
    loadingRepos,
    repoError,
    handleSave,
    handleDelete,
    handleOpenWorkspace,
  } = useGitHubSettings(isAuthenticated, authLoading)

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
        <BackLink href='/workspace'>← Back to Workspaces</BackLink>
        <Title>GitHub Settings</Title>
        <Subtitle>Configure your GitHub integration</Subtitle>
      </Header>

      <Content>
        <Card>
          <CardHeader>
            <CardTitle>GitHub Personal Access Token</CardTitle>
            <CardDesc>
              To access your GitHub repositories, you need to provide a Personal Access Token with
              appropriate permissions.
            </CardDesc>
          </CardHeader>

          <CardBody>
            {loading && <LoadingText>Loading configuration...</LoadingText>}

            {error && <ErrorBanner>{error}</ErrorBanner>}
            {success && <SuccessBanner>{success}</SuccessBanner>}

            {!loading && config && (
              <>
                <StatusSection>
                  <StatusLabel>Status</StatusLabel>
                  <StatusValue $connected={config.hasToken}>
                    <StatusDot $connected={config.hasToken} />
                    {config.hasToken ? 'Connected' : 'Not Connected'}
                  </StatusValue>
                </StatusSection>

                {config.hasToken && config.username && (
                  <InfoSection>
                    <InfoLabel>Connected Account</InfoLabel>
                    <InfoValue>@{config.username}</InfoValue>
                  </InfoSection>
                )}

                {config.hasToken && config.createdAt && (
                  <InfoSection>
                    <InfoLabel>Connected At</InfoLabel>
                    <InfoValue>{new Date(config.createdAt).toLocaleString()}</InfoValue>
                  </InfoSection>
                )}

                <TokenSection>
                  <TokenLabel>
                    {config.hasToken ? 'Update Token' : 'Add Token'}
                  </TokenLabel>
                  <TokenInput
                    type='password'
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder='ghp_xxxxxxxxxxxxxxxxxxxx'
                    disabled={saving}
                  />
                  <TokenHint>
                    Create a token at{' '}
                    <TokenHintLink
                      href='https://github.com/settings/tokens/new'
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      GitHub Settings →
                    </TokenHintLink>
                    <br />
                    Required scopes: <code>repo</code>, <code>user</code>
                  </TokenHint>
                </TokenSection>

                <Actions>
                  <SaveButton onClick={handleSave} disabled={saving || !token.trim()}>
                    {saving ? 'Saving...' : config.hasToken ? 'Update Token' : 'Save Token'}
                  </SaveButton>
                  {config.hasToken && (
                    <DeleteButton onClick={handleDelete} disabled={saving}>
                      Remove Token
                    </DeleteButton>
                  )}
                </Actions>
              </>
            )}
          </CardBody>
        </Card>

        {config?.hasToken && (
          <Card>
            <CardHeader>
              <CardTitle>Your Repositories</CardTitle>
              <CardDesc>Select a repository to open as a workspace.</CardDesc>
            </CardHeader>
            <CardBody>
              {loadingRepos && <LoadingText>Loading repositories...</LoadingText>}
              {repoError && <ErrorBanner>{repoError}</ErrorBanner>}
              {!loadingRepos && repos.length === 0 && !repoError && (
                <EmptyText>No repositories found.</EmptyText>
              )}
              <RepoList>
                {repos.map((repo) => (
                  <RepoItem key={repo.id}>
                    <RepoInfo>
                      <RepoName>{repo.full_name}</RepoName>
                      {repo.description && <RepoDesc>{repo.description}</RepoDesc>}
                      <RepoMeta>
                        <RepoTag $private={repo.private}>
                          {repo.private ? 'Private' : 'Public'}
                        </RepoTag>
                        <RepoUpdated>
                          Updated {new Date(repo.updated_at).toLocaleDateString()}
                        </RepoUpdated>
                      </RepoMeta>
                    </RepoInfo>
                    <RepoActions>
                      <OpenButton onClick={() => handleOpenWorkspace(repo)}>
                        Open
                      </OpenButton>
                    </RepoActions>
                  </RepoItem>
                ))}
              </RepoList>
            </CardBody>
          </Card>
        )}

        <HelpCard>
          <HelpTitle>How to create a GitHub Personal Access Token</HelpTitle>
          <HelpList>
            <HelpItem>
              <HelpNumber>1</HelpNumber>
              <HelpText>
                Go to{' '}
                <HelpLink href='https://github.com/settings/tokens' target='_blank'>
                  GitHub Settings → Developer settings → Personal access tokens
                </HelpLink>
              </HelpText>
            </HelpItem>
            <HelpItem>
              <HelpNumber>2</HelpNumber>
              <HelpText>Click "Generate new token (classic)"</HelpText>
            </HelpItem>
            <HelpItem>
              <HelpNumber>3</HelpNumber>
              <HelpText>Select the following scopes: repo, user</HelpText>
            </HelpItem>
            <HelpItem>
              <HelpNumber>4</HelpNumber>
              <HelpText>Click "Generate token" and copy the token</HelpText>
            </HelpItem>
            <HelpItem>
              <HelpNumber>5</HelpNumber>
              <HelpText>Paste the token in the field above</HelpText>
            </HelpItem>
          </HelpList>
        </HelpCard>
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
  padding: ${rem(32)} ${rem(40)} ${rem(24)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.bgColorSecondary};
`

const BackLink = styled(Link)`
  display: inline-block;
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  text-decoration: none;
  margin-bottom: ${rem(16)};

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const Title = styled.h1`
  font-size: ${rem(28)};
  font-weight: 700;
  margin: 0 0 ${rem(8)};
  letter-spacing: -0.02em;
`

const Subtitle = styled.p`
  font-size: ${rem(15)};
  color: ${(props) => props.theme.disabledFontColor};
  margin: 0;
`

const Content = styled.div`
  padding: ${rem(32)} ${rem(40)};
  max-width: ${rem(800)};
`

const Card = styled.div`
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(12)};
  margin-bottom: ${rem(24)};
  overflow: hidden;
`

const CardHeader = styled.div`
  padding: ${rem(24)} ${rem(24)} ${rem(16)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
`

const CardTitle = styled.h2`
  font-size: ${rem(18)};
  font-weight: 600;
  margin: 0 0 ${rem(8)};
`

const CardDesc = styled.p`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  margin: 0;
`

const CardBody = styled.div`
  padding: ${rem(24)};
`

const LoadingText = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  padding: ${rem(16)} 0;
`

const ErrorBanner = styled.div`
  padding: ${rem(12)} ${rem(16)};
  background: rgba(255, 77, 79, 0.1);
  border: 1px solid rgba(255, 77, 79, 0.2);
  border-radius: ${rem(8)};
  color: #ff4d4f;
  font-size: ${rem(14)};
  margin-bottom: ${rem(16)};
`

const SuccessBanner = styled.div`
  padding: ${rem(12)} ${rem(16)};
  background: rgba(82, 196, 26, 0.1);
  border: 1px solid rgba(82, 196, 26, 0.2);
  border-radius: ${rem(8)};
  color: #52c41a;
  font-size: ${rem(14)};
  margin-bottom: ${rem(16)};
`

const StatusSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  margin-bottom: ${rem(16)};
`

const StatusLabel = styled.span`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
`

const StatusValue = styled.span<{ $connected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${rem(6)};
  font-size: ${rem(14)};
  font-weight: 500;
  color: ${(props) => (props.$connected ? '#52c41a' : props.theme.disabledFontColor)};
`

const StatusDot = styled.span<{ $connected: boolean }>`
  width: ${rem(8)};
  height: ${rem(8)};
  border-radius: 50%;
  background: ${(props) => (props.$connected ? '#52c41a' : props.theme.disabledFontColor)};
`

const InfoSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  margin-bottom: ${rem(12)};
`

const InfoLabel = styled.span`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
`

const InfoValue = styled.span`
  font-size: ${rem(14)};
  font-weight: 500;
`

const TokenSection = styled.div`
  margin-top: ${rem(24)};
  margin-bottom: ${rem(16)};
`

const TokenLabel = styled.label`
  display: block;
  font-size: ${rem(14)};
  font-weight: 500;
  margin-bottom: ${rem(8)};
`

const TokenInput = styled.input`
  width: 100%;
  padding: ${rem(10)} ${rem(14)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${rem(14)};
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: #d4564a;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const TokenHint = styled.p`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  margin: ${rem(8)} 0 0;

  code {
    background: ${(props) => props.theme.bgColor};
    padding: ${rem(2)} ${rem(6)};
    border-radius: ${rem(4)};
    font-size: ${rem(12)};
  }
`

const TokenHintLink = styled.a`
  color: #d4564a;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const Actions = styled.div`
  display: flex;
  gap: ${rem(12)};
`

const SaveButton = styled.button`
  padding: ${rem(10)} ${rem(20)};
  background: linear-gradient(135deg, #d4564a 0%, #b8453c 100%);
  color: #ffffff;
  border: none;
  border-radius: ${rem(8)};
  font-size: ${rem(14)};
  font-weight: 500;
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

const DeleteButton = styled.button`
  padding: ${rem(10)} ${rem(20)};
  background: transparent;
  color: #ff4d4f;
  border: 1px solid rgba(255, 77, 79, 0.3);
  border-radius: ${rem(8)};
  font-size: ${rem(14)};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 77, 79, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const EmptyText = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(20)} 0;
`

const RepoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
`

const RepoItem = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${rem(16)};
  padding: ${rem(16)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  transition: border-color 0.2s ease;

  &:hover {
    border-color: ${(props) => props.theme.disabledFontColor};
  }
`

const RepoInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const RepoName = styled.div`
  font-size: ${rem(15)};
  font-weight: 500;
  margin-bottom: ${rem(4)};
`

const RepoDesc = styled.div`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  margin-bottom: ${rem(8)};
  line-height: 1.5;
`

const RepoMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
`

const RepoTag = styled.span<{ $private: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: ${rem(2)} ${rem(8)};
  background: ${(props) => (props.$private ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)')};
  color: ${(props) => (props.$private ? '#ff4d4f' : '#52c41a')};
  font-size: ${rem(11)};
  font-weight: 500;
  border-radius: ${rem(4)};
`

const RepoUpdated = styled.span`
  font-size: ${rem(12)};
  color: ${(props) => props.theme.disabledFontColor};
`

const RepoActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  flex-shrink: 0;
`

const OpenButton = styled.button`
  padding: ${rem(6)} ${rem(14)};
  background: ${(props) => props.theme.bgColorSecondary};
  color: ${(props) => props.theme.primaryFontColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  font-size: ${rem(13)};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${(props) => props.theme.disabledFontColor};
    background: ${(props) => props.theme.bgColor};
  }
`

const HelpCard = styled.div`
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(12)};
  padding: ${rem(24)};
`

const HelpTitle = styled.h3`
  font-size: ${rem(16)};
  font-weight: 600;
  margin: 0 0 ${rem(16)};
`

const HelpList = styled.ol`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
`

const HelpItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${rem(12)};
`

const HelpNumber = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(24)};
  height: ${rem(24)};
  background: linear-gradient(135deg, #d4564a 0%, #b8453c 100%);
  color: #ffffff;
  font-size: ${rem(12)};
  font-weight: 600;
  border-radius: 50%;
  flex-shrink: 0;
`

const HelpText = styled.span`
  font-size: ${rem(14)};
  line-height: 1.6;
  padding-top: ${rem(2)};
`

const HelpLink = styled.a`
  color: #d4564a;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
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
