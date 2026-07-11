import { useGitHubSettings } from 'hooks/useGitHubSettings'
import styled from 'styled-components'
import rem from 'utils/rem'

interface GitHubSettingsPanelProps {
  isAuthenticated: boolean
  authLoading: boolean
}

export function GitHubSettingsPanel({ isAuthenticated, authLoading }: GitHubSettingsPanelProps) {
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
    importingRepo,
    handleSave,
    handleDelete,
    handleOpenWorkspace,
  } = useGitHubSettings(isAuthenticated, authLoading)

  return (
    <Panel id='github'>
      <PanelHeader>
        <PanelKicker>
          <i className='ri-github-fill' />
          GitHub
        </PanelKicker>
        <PanelTitle>GitHub Integration</PanelTitle>
        <PanelDesc>
          Connect a Personal Access Token so MarkFlowy can list repositories and import them as
          workspaces.
        </PanelDesc>
      </PanelHeader>

      <PanelBody>
        {loading && <LoadingText>Loading GitHub configuration...</LoadingText>}

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {success && <SuccessBanner>{success}</SuccessBanner>}

        {!loading && config && (
          <>
            <StatusGrid>
              <StatusItem>
                <StatusLabel>Status</StatusLabel>
                <StatusValue $connected={config.hasToken}>
                  <StatusDot $connected={config.hasToken} />
                  {config.hasToken ? 'Connected' : 'Not connected'}
                </StatusValue>
              </StatusItem>

              {config.hasToken && config.username && (
                <StatusItem>
                  <StatusLabel>Connected account</StatusLabel>
                  <StatusText>@{config.username}</StatusText>
                </StatusItem>
              )}

              {config.hasToken && config.createdAt && (
                <StatusItem>
                  <StatusLabel>Connected at</StatusLabel>
                  <StatusText>{new Date(config.createdAt).toLocaleString()}</StatusText>
                </StatusItem>
              )}
            </StatusGrid>

            <TokenSection>
              <TokenLabel htmlFor='github-token'>
                {config.hasToken ? 'Update token' : 'Add token'}
              </TokenLabel>
              <TokenInput
                id='github-token'
                type='password'
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder='ghp_xxxxxxxxxxxxxxxxxxxx'
                disabled={saving}
              />
              <TokenHint>
                Create a token in{' '}
                <TokenHintLink
                  href='https://github.com/settings/tokens/new'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  GitHub Settings
                </TokenHintLink>
                . Prefer a fine-grained token with <code>Metadata: Read</code> and{' '}
                <code>Contents: Read and write</code>. Editing workflow files also requires{' '}
                <code>Workflows: Read and write</code>.
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
      </PanelBody>

      {config?.hasToken && (
        <RepositoryBody>
          <RepositoryHeader>
            <RepositoryTitle>Your Repositories</RepositoryTitle>
            <RepositoryDesc>Select a repository to open or create a workspace.</RepositoryDesc>
          </RepositoryHeader>

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
                    <RepoTag $private={repo.private}>{repo.private ? 'Private' : 'Public'}</RepoTag>
                    <RepoUpdated>
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </RepoUpdated>
                  </RepoMeta>
                </RepoInfo>
                <OpenButton
                  onClick={() => handleOpenWorkspace(repo)}
                  disabled={Boolean(importingRepo)}
                >
                  <i className='ri-folder-open-line' />
                  {importingRepo === repo.full_name ? 'Opening...' : 'Open'}
                </OpenButton>
              </RepoItem>
            ))}
          </RepoList>
        </RepositoryBody>
      )}

      <HelpBody>
        <HelpTitle>Token setup</HelpTitle>
        <HelpGrid>
          <HelpItem>
            <HelpNumber>1</HelpNumber>
            <HelpText>
              Open{' '}
              <HelpLink href='https://github.com/settings/tokens' target='_blank'>
                GitHub Personal access tokens
              </HelpLink>
              .
            </HelpText>
          </HelpItem>
          <HelpItem>
            <HelpNumber>2</HelpNumber>
            <HelpText>
              Generate a fine-grained token with Metadata read and Contents read/write access.
            </HelpText>
          </HelpItem>
          <HelpItem>
            <HelpNumber>3</HelpNumber>
            <HelpText>
              Paste the token above, then return to Workspaces to import a repository.
            </HelpText>
          </HelpItem>
        </HelpGrid>
      </HelpBody>
    </Panel>
  )
}

const Panel = styled.section`
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
  overflow: hidden;
`

const PanelHeader = styled.div`
  padding: ${rem(20)} ${rem(20)} ${rem(16)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.sideBarHeaderBgColor};
`

const PanelKicker = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${rem(6)};
  color: ${(props) => props.theme.accentColor};
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: ${rem(8)};
`

const PanelTitle = styled.h2`
  font-size: ${rem(20)};
  line-height: 1.3;
  font-weight: 700;
  margin: 0;
`

const PanelDesc = styled.p`
  margin: ${rem(6)} 0 0;
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};
  line-height: 1.6;
  max-width: ${rem(640)};
`

const PanelBody = styled.div`
  padding: ${rem(20)};
`

const LoadingText = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.disabledFontColor};
  padding: ${rem(12)} 0;
`

const ErrorBanner = styled.div`
  padding: ${rem(10)} ${rem(12)};
  background: rgba(255, 77, 79, 0.1);
  border: 1px solid rgba(255, 77, 79, 0.24);
  border-radius: ${(props) => props.theme.midBorderRadius};
  color: #ff7875;
  font-size: ${(props) => props.theme.fontSm};
  margin-bottom: ${rem(14)};
`

const SuccessBanner = styled.div`
  padding: ${rem(10)} ${rem(12)};
  background: rgba(82, 196, 26, 0.1);
  border: 1px solid rgba(82, 196, 26, 0.24);
  border-radius: ${(props) => props.theme.midBorderRadius};
  color: #73d13d;
  font-size: ${(props) => props.theme.fontSm};
  margin-bottom: ${rem(14)};
`

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${rem(10)};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`

const StatusItem = styled.div`
  min-height: ${rem(62)};
  padding: ${rem(10)} ${rem(12)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
`

const StatusLabel = styled.div`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1.4;
  margin-bottom: ${rem(6)};
`

const StatusValue = styled.div<{ $connected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${rem(6)};
  color: ${(props) => (props.$connected ? '#73d13d' : props.theme.disabledFontColor)};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
`

const StatusDot = styled.span<{ $connected: boolean }>`
  width: ${rem(8)};
  height: ${rem(8)};
  border-radius: 50%;
  background: ${(props) => (props.$connected ? '#73d13d' : props.theme.disabledFontColor)};
`

const StatusText = styled.div`
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  overflow-wrap: anywhere;
`

const TokenSection = styled.div`
  margin-top: ${rem(20)};
`

const TokenLabel = styled.label`
  display: block;
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  margin-bottom: ${rem(8)};
`

const TokenInput = styled.input`
  width: 100%;
  min-height: ${rem(36)};
  padding: 0 ${rem(12)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  outline: none;
  transition: border-color 0.16s ease;

  &:focus {
    border-color: ${(props) => props.theme.borderColorFocused};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const TokenHint = styled.p`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1.6;
  margin: ${rem(8)} 0 0;

  code {
    background: ${(props) => props.theme.bgColor};
    border: 1px solid ${(props) => props.theme.borderColor};
    border-radius: ${(props) => props.theme.smallBorderRadius};
    padding: ${rem(1)} ${rem(5)};
    font-size: ${(props) => props.theme.fontXs};
  }
`

const TokenHintLink = styled.a`
  color: ${(props) => props.theme.accentColor};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  margin-top: ${rem(16)};
  flex-wrap: wrap;
`

const SaveButton = styled.button`
  min-height: ${rem(32)};
  padding: 0 ${rem(14)};
  background: ${(props) => props.theme.accentColor};
  color: #ffffff;
  border: 1px solid ${(props) => props.theme.accentColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.16s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`

const DeleteButton = styled.button`
  min-height: ${rem(32)};
  padding: 0 ${rem(14)};
  background: transparent;
  color: #ff7875;
  border: 1px solid rgba(255, 77, 79, 0.3);
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    opacity 0.16s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 77, 79, 0.1);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`

const RepositoryBody = styled.div`
  padding: ${rem(20)};
  border-top: 1px solid ${(props) => props.theme.borderColor};
`

const RepositoryHeader = styled.div`
  margin-bottom: ${rem(12)};
`

const RepositoryTitle = styled.h3`
  font-size: ${(props) => props.theme.fontBase};
  font-weight: 700;
  margin: 0;
`

const RepositoryDesc = styled.p`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};
  margin: ${rem(4)} 0 0;
`

const EmptyText = styled.div`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};
  padding: ${rem(12)} 0;
`

const RepoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(8)};
`

const RepoItem = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: ${rem(12)};
  padding: ${rem(10)} ${rem(12)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const RepoInfo = styled.div`
  min-width: 0;
`

const RepoName = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RepoDesc = styled.div`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1.5;
  margin-top: ${rem(2)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RepoMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  margin-top: ${rem(6)};
`

const RepoTag = styled.span<{ $private: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: ${rem(20)};
  padding: 0 ${rem(7)};
  background: ${(props) => (props.$private ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)')};
  border: 1px solid
    ${(props) => (props.$private ? 'rgba(255, 77, 79, 0.2)' : 'rgba(82, 196, 26, 0.2)')};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => (props.$private ? '#ff7875' : '#73d13d')};
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 600;
`

const RepoUpdated = styled.span`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
`

const OpenButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(6)};
  min-height: ${rem(30)};
  padding: 0 ${rem(12)};
  background: ${(props) => props.theme.buttonBgColor};
  color: ${(props) => props.theme.primaryFontColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;

  &:hover:not(:disabled) {
    background: ${(props) => props.theme.hoverColor};
    border-color: ${(props) => props.theme.borderColorFocused};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`

const HelpBody = styled.div`
  padding: ${rem(20)};
  border-top: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.bgColor};
`

const HelpTitle = styled.h3`
  font-size: ${(props) => props.theme.fontBase};
  font-weight: 700;
  margin: 0 0 ${rem(12)};
`

const HelpGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${rem(10)};

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`

const HelpItem = styled.div`
  display: grid;
  grid-template-columns: ${rem(24)} minmax(0, 1fr);
  gap: ${rem(8)};
  align-items: flex-start;
`

const HelpNumber = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(24)};
  height: ${rem(24)};
  background: ${(props) => props.theme.accentColor};
  border-radius: 50%;
  color: #ffffff;
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 700;
`

const HelpText = styled.span`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};
  line-height: 1.55;
`

const HelpLink = styled.a`
  color: ${(props) => props.theme.accentColor};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`
