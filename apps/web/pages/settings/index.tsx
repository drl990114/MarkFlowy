import { GitHubSettingsPanel } from 'components/settings/GitHubSettingsPanel'
import { useAuth } from 'hooks/useAuth'
import Link from 'next/link'
import { useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'

function formatDate(value?: string) {
  if (!value) return 'Not available'

  return new Date(value).toLocaleString()
}

function getInitials(value: string) {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function PersonalSettingsPage() {
  const { loading: authLoading, isAuthenticated, logout, user } = useAuth(true)
  const [logoutState, setLogoutState] = useState<'idle' | 'confirming' | 'logging-out'>('idle')
  const isLoggingOut = logoutState === 'logging-out'

  const handleLogoutConfirm = async () => {
    if (isLoggingOut) return

    setLogoutState('logging-out')
    await logout()
  }

  if (authLoading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
      </LoadingContainer>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const displayName = user.displayName || user.email || 'User'
  const initials = getInitials(displayName) || 'U'

  return (
    <Container>
      <Header>
        <BackLink href='/workspace'>
          <i className='ri-arrow-left-line' />
          Workspaces
        </BackLink>
        <HeaderMain>
          <HeaderIcon>
            <i className='ri-user-settings-line' />
          </HeaderIcon>
          <HeaderCopy>
            <Title>Personal Settings</Title>
            <Subtitle>Manage basic information and connected services.</Subtitle>
          </HeaderCopy>
        </HeaderMain>
      </Header>

      <Shell>
        <Sidebar aria-label='Settings navigation'>
          <SidebarLink href='#basic'>
            <i className='ri-user-line' />
            Basic Info
          </SidebarLink>
          <SidebarLink href='#github'>
            <i className='ri-github-fill' />
            GitHub
          </SidebarLink>
          <SidebarLink href='#session'>
            <i className='ri-logout-box-r-line' />
            Session
          </SidebarLink>
        </Sidebar>

        <Main>
          <ProfilePanel id='basic'>
            <PanelHeader>
              <PanelKicker>
                <i className='ri-user-line' />
                Account
              </PanelKicker>
              <PanelTitle>Basic Information</PanelTitle>
              <PanelDesc>Your MarkFlowy account profile for the web workspace.</PanelDesc>
            </PanelHeader>

            <PanelBody>
              <ProfileSummary>
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={displayName} />
                ) : (
                  <AvatarFallback>{initials}</AvatarFallback>
                )}
                <ProfileCopy>
                  <ProfileName>{displayName}</ProfileName>
                  <ProfileEmail>{user.email}</ProfileEmail>
                </ProfileCopy>
              </ProfileSummary>

              <InfoGrid>
                <InfoItem>
                  <InfoLabel>Display name</InfoLabel>
                  <InfoValue>{user.displayName || 'Not set'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Email</InfoLabel>
                  <InfoValue>{user.email}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>User ID</InfoLabel>
                  <InfoValue>{user.id}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Created</InfoLabel>
                  <InfoValue>{formatDate(user.createdAt)}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Updated</InfoLabel>
                  <InfoValue>{formatDate(user.updatedAt)}</InfoValue>
                </InfoItem>
              </InfoGrid>
            </PanelBody>
          </ProfilePanel>

          <GitHubSettingsPanel isAuthenticated={isAuthenticated} authLoading={authLoading} />

          <ProfilePanel id='session'>
            <PanelHeader>
              <PanelKicker>
                <i className='ri-shield-user-line' />
                Session
              </PanelKicker>
              <PanelTitle>Sign out</PanelTitle>
              <PanelDesc>End this browser session without changing your account data.</PanelDesc>
            </PanelHeader>

            <PanelBody>
              <SessionAction>
                <SessionCopy>
                  <SessionTitle>Signed in as {user.email}</SessionTitle>
                  <SessionDescription>
                    You will need to sign in again to access remote workspaces and connected
                    services.
                  </SessionDescription>
                </SessionCopy>
                {logoutState === 'idle' ? (
                  <SignOutButton type='button' onClick={() => setLogoutState('confirming')}>
                    <i className='ri-logout-box-r-line' aria-hidden='true' />
                    Sign out
                  </SignOutButton>
                ) : (
                  <LogoutConfirmation role='group' aria-label='Confirm sign out'>
                    <LogoutConfirmText>Are you sure you want to sign out?</LogoutConfirmText>
                    <LogoutConfirmActions>
                      <CancelLogoutButton
                        type='button'
                        onClick={() => setLogoutState('idle')}
                        disabled={isLoggingOut}
                        autoFocus
                      >
                        Cancel
                      </CancelLogoutButton>
                      <SignOutButton
                        type='button'
                        onClick={handleLogoutConfirm}
                        disabled={isLoggingOut}
                        aria-busy={isLoggingOut}
                      >
                        <i
                          className={isLoggingOut ? 'ri-loader-4-line' : 'ri-logout-box-r-line'}
                          aria-hidden='true'
                        />
                        {isLoggingOut ? 'Signing out…' : 'Confirm sign out'}
                      </SignOutButton>
                    </LogoutConfirmActions>
                  </LogoutConfirmation>
                )}
              </SessionAction>
            </PanelBody>
          </ProfilePanel>
        </Main>
      </Shell>
    </Container>
  )
}

const Container = styled.div`
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  font-family: ${(props) => props.theme.fontFamily};
`

const Header = styled.header`
  padding: ${rem(24)} ${rem(28)} ${rem(20)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.bgColorSecondary};

  @media (max-width: 720px) {
    padding: ${rem(18)} ${rem(14)} ${rem(16)};
  }
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${rem(6)};
  min-height: ${rem(28)};
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  text-decoration: none;
  margin-bottom: ${rem(14)};

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const HeaderMain = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
`

const HeaderIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(40)};
  height: ${rem(40)};
  background: ${(props) => props.theme.buttonBgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
  color: ${(props) => props.theme.accentColor};
  font-size: ${rem(20)};
  flex: 0 0 auto;
`

const HeaderCopy = styled.div`
  min-width: 0;
`

const Title = styled.h1`
  font-size: ${rem(26)};
  line-height: 1.25;
  font-weight: 700;
  margin: 0;
`

const Subtitle = styled.p`
  margin: ${rem(4)} 0 0;
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};
`

const Shell = styled.div`
  display: grid;
  grid-template-columns: ${rem(180)} minmax(0, ${rem(860)});
  gap: ${rem(24)};
  align-items: start;
  padding: ${rem(24)} ${rem(28)} ${rem(32)};

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }

  @media (max-width: 720px) {
    padding: ${rem(16)} ${rem(12)} ${rem(24)};
  }
`

const Sidebar = styled.nav`
  position: sticky;
  top: ${rem(16)};
  display: flex;
  flex-direction: column;
  gap: ${rem(6)};

  @media (max-width: 860px) {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }
`

const SidebarLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${rem(8)};
  min-height: ${rem(34)};
  padding: 0 ${rem(10)};
  background: ${(props) => props.theme.buttonBgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: ${(props) => props.theme.hoverColor};
    border-color: ${(props) => props.theme.borderColorFocused};
  }
`

const Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${rem(18)};
`

const ProfilePanel = styled.section`
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
`

const PanelBody = styled.div`
  padding: ${rem(20)};
`

const ProfileSummary = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  margin-bottom: ${rem(18)};
`

const AvatarImage = styled.img`
  width: ${rem(52)};
  height: ${rem(52)};
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid ${(props) => props.theme.borderColor};
`

const AvatarFallback = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(52)};
  height: ${rem(52)};
  border-radius: 50%;
  background: ${(props) => props.theme.accentColorFocused};
  border: 1px solid ${(props) => props.theme.borderColor};
  color: ${(props) => props.theme.accentColor};
  font-size: ${rem(18)};
  font-weight: 800;
`

const ProfileCopy = styled.div`
  min-width: 0;
`

const ProfileName = styled.div`
  font-size: ${rem(18)};
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
`

const ProfileEmail = styled.div`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontSm};
  overflow-wrap: anywhere;
`

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${rem(10)};

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`

const InfoItem = styled.div`
  min-height: ${rem(64)};
  padding: ${rem(10)} ${rem(12)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.midBorderRadius};
`

const InfoLabel = styled.div`
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1.4;
  margin-bottom: ${rem(6)};
`

const InfoValue = styled.div`
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
  overflow-wrap: anywhere;
`

const SessionAction = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${rem(18)};

  @media (max-width: 680px) {
    align-items: stretch;
    flex-direction: column;
  }
`

const SessionCopy = styled.div`
  min-width: 0;
`

const SessionTitle = styled.div`
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 700;
  overflow-wrap: anywhere;
`

const SessionDescription = styled.p`
  margin: ${rem(5)} 0 0;
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1.5;
`

const LogoutConfirmation = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${rem(7)};

  @media (max-width: 680px) {
    align-items: stretch;
  }
`

const LogoutConfirmText = styled.div`
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 700;
`

const LogoutConfirmActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${rem(8)};
`

const CancelLogoutButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: ${rem(34)};
  padding: 0 ${rem(14)};
  background: ${(props) => props.theme.buttonBgColor};
  color: ${(props) => props.theme.primaryFontColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 700;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${(props) => props.theme.hoverColor};
    border-color: ${(props) => props.theme.borderColorFocused};
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.borderColorFocused};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`

const SignOutButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(7)};
  min-height: ${rem(34)};
  padding: 0 ${rem(14)};
  background: transparent;
  color: ${(props) => props.theme.dangerColor};
  border: 1px solid ${(props) => props.theme.dangerColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.16s ease,
    opacity 0.16s ease;

  &:hover:not(:disabled) {
    background: ${(props) => props.theme.accentColorFocused};
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.dangerColor};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &[aria-busy='true'] i {
    animation: spin 0.8s linear infinite;
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
  border-top-color: ${(props) => props.theme.accentColor};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`
