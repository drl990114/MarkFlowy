import { useGitHubSettings } from 'hooks/useGitHubSettings'
import styled from 'styled-components'
import rem from 'utils/rem'

interface GitHubSettingsPanelProps {
  isAuthenticated: boolean
  authLoading: boolean
}

export function GitHubSettingsPanel({ isAuthenticated, authLoading }: GitHubSettingsPanelProps) {
  const {
    connection,
    loading,
    startingAction,
    disconnecting,
    deletingInstallationId,
    error,
    success,
    repos,
    loadingRepos,
    repoError,
    importingRepo,
    handleStartConnection,
    handleStartInstallation,
    handleDeleteConnection,
    handleDeleteInstallation,
    handleOpenWorkspace,
  } = useGitHubSettings(isAuthenticated, authLoading)
  const linked = connection?.linked === true
  const hasInstallations = Boolean(connection?.installations.length)
  const busy = Boolean(startingAction || disconnecting || deletingInstallationId)

  return (
    <Panel id='github'>
      <PanelHeader>
        <PanelKicker>
          <i className='ri-github-fill' />
          GitHub
        </PanelKicker>
        <PanelTitle>GitHub Integration</PanelTitle>
        <PanelDesc>
          Link your GitHub identity, then authorize the GitHub App for the repositories you want to
          use in MarkFlowy. Personal access tokens are not required.
        </PanelDesc>
      </PanelHeader>

      <PanelBody>
        {loading && <LoadingText>Loading GitHub configuration...</LoadingText>}

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {success && <SuccessBanner>{success}</SuccessBanner>}

        {!loading && connection && (
          <>
            <StatusGrid>
              <StatusItem>
                <StatusLabel>GitHub identity</StatusLabel>
                <StatusValue $connected={linked}>
                  <StatusDot $connected={linked} />
                  {linked ? 'Linked' : 'Not linked'}
                </StatusValue>
              </StatusItem>

              {linked && connection.login && (
                <StatusItem>
                  <StatusLabel>Linked account</StatusLabel>
                  <AccountSummary>
                    {connection.avatarUrl && (
                      <AccountAvatar src={connection.avatarUrl} alt='' aria-hidden='true' />
                    )}
                    <StatusText>@{connection.login}</StatusText>
                  </AccountSummary>
                </StatusItem>
              )}

              {linked && (
                <StatusItem>
                  <StatusLabel>Repository authorizations</StatusLabel>
                  <StatusText>{connection.installations.length}</StatusText>
                </StatusItem>
              )}

              {linked && connection.linkedAt && (
                <StatusItem>
                  <StatusLabel>Linked at</StatusLabel>
                  <StatusText>{new Date(connection.linkedAt).toLocaleString()}</StatusText>
                </StatusItem>
              )}
            </StatusGrid>

            <Actions>
              {!linked ? (
                <SaveButton type='button' onClick={handleStartConnection} disabled={busy}>
                  {startingAction === 'connection' ? 'Opening GitHub...' : 'Link GitHub Account'}
                </SaveButton>
              ) : (
                <DeleteButton type='button' onClick={handleDeleteConnection} disabled={busy}>
                  {disconnecting ? 'Unlinking...' : 'Unlink GitHub Account'}
                </DeleteButton>
              )}
            </Actions>
          </>
        )}
      </PanelBody>

      {linked && connection && (
        <InstallationBody>
          <RepositoryHeader>
            <RepositoryTitle>Repository Access</RepositoryTitle>
            <RepositoryDesc>
              Install the MarkFlowy GitHub App for a personal account or organization, and choose
              which repositories it can access.
            </RepositoryDesc>
          </RepositoryHeader>

          {connection.installations.length === 0 ? (
            <EmptyText>No GitHub App repository access has been authorized yet.</EmptyText>
          ) : (
            <InstallationList>
              {connection.installations.map((installation) => (
                <InstallationItem key={installation.installationId}>
                  <InstallationInfo>
                    <RepoName>{installation.accountLogin}</RepoName>
                    <RepoMeta>
                      <AccessTag>{installation.accountType}</AccessTag>
                      <RepoUpdated>
                        {installation.repositorySelection === 'all'
                          ? 'All repositories'
                          : 'Selected repositories'}
                      </RepoUpdated>
                    </RepoMeta>
                  </InstallationInfo>
                  <DeleteButton
                    type='button'
                    onClick={() => handleDeleteInstallation(installation.installationId)}
                    disabled={busy}
                  >
                    {deletingInstallationId === installation.installationId
                      ? 'Removing from MarkFlowy...'
                      : 'Remove from MarkFlowy'}
                  </DeleteButton>
                </InstallationItem>
              ))}
            </InstallationList>
          )}

          <Actions>
            <SaveButton type='button' onClick={handleStartInstallation} disabled={busy}>
              {startingAction === 'installation'
                ? 'Opening GitHub...'
                : hasInstallations
                  ? 'Add or Update Repository Access'
                  : 'Authorize Repositories'}
            </SaveButton>
          </Actions>
        </InstallationBody>
      )}

      {linked && (
        <RepositoryBody>
          <RepositoryHeader>
            <RepositoryTitle>Authorized Repositories</RepositoryTitle>
            <RepositoryDesc>Select a repository to open or create a workspace.</RepositoryDesc>
          </RepositoryHeader>

          {loadingRepos && <LoadingText>Loading repositories...</LoadingText>}
          {repoError && <ErrorBanner>{repoError}</ErrorBanner>}
          {!loadingRepos && repos.length === 0 && !repoError && (
            <EmptyText>No repositories found.</EmptyText>
          )}

          <RepoList
            role='region'
            aria-label='Authorized repositories'
            tabIndex={repos.length > 0 ? 0 : undefined}
          >
            {repos.map((repo) => (
              <RepoItem key={`${repo.installationId}:${repo.id}`}>
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
                  type='button'
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
        <HelpTitle>How GitHub access works</HelpTitle>
        <HelpGrid>
          <HelpItem>
            <HelpNumber>1</HelpNumber>
            <HelpText>Link your GitHub identity to your MarkFlowy account.</HelpText>
          </HelpItem>
          <HelpItem>
            <HelpNumber>2</HelpNumber>
            <HelpText>Install the MarkFlowy GitHub App and select repository access.</HelpText>
          </HelpItem>
          <HelpItem>
            <HelpNumber>3</HelpNumber>
            <HelpText>
              Import an authorized repository as a workspace. Tokens stay server-side.
            </HelpText>
          </HelpItem>
        </HelpGrid>
        <HelpNote>
          To revoke or change access on GitHub, manage or uninstall the app in{' '}
          <HelpLink
            href='https://github.com/settings/installations'
            target='_blank'
            rel='noopener noreferrer'
          >
            GitHub Settings
          </HelpLink>
          .
        </HelpNote>
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

const AccountSummary = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(7)};
  min-width: 0;
`

const AccountAvatar = styled.img`
  width: ${rem(22)};
  height: ${rem(22)};
  border-radius: 50%;
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

const InstallationBody = styled.div`
  padding: ${rem(20)};
  border-top: 1px solid ${(props) => props.theme.borderColor};
`

const InstallationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(8)};
`

const InstallationItem = styled.div`
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

const InstallationInfo = styled.div`
  min-width: 0;
`

const AccessTag = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: ${rem(20)};
  padding: 0 ${rem(7)};
  background: rgba(82, 196, 26, 0.1);
  border: 1px solid rgba(82, 196, 26, 0.2);
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: #73d13d;
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 600;
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
  max-height: min(50vh, ${rem(360)});
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: ${rem(4)};
  scrollbar-color: ${(props) => props.theme.scrollbarThumbColor}
    ${(props) => props.theme.scrollbarTrackColor};
  scrollbar-width: thin;

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.borderColorFocused};
    outline-offset: ${rem(2)};
  }

  @media (max-width: 640px) {
    max-height: min(52vh, ${rem(320)});
  }
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

const HelpNote = styled.p`
  margin: ${rem(14)} 0 0;
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

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }
`
