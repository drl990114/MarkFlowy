import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import Link from 'next/link'
import styled, { css } from 'styled-components'
import SeoHead from '../../components/SeoHead'
import { useRedirectIfAuthenticated } from '../../hooks/useAuth'
import { AuthMode, Step, useAuthForm } from '../../hooks/useAuthForm'
import { useGitHubLogin } from '../../hooks/useGitHubLogin'
import { mobile } from '../../utils/media'

export default function AuthPage() {
  const checkingAuth = useRedirectIfAuthenticated()

  if (checkingAuth) {
    return (
      <>
        <SeoHead title='Sign In - MarkFlowy' />
        <AuthLayout aria-busy='true'>
          <LoadingSpinner role='status' aria-label='Checking login status' />
        </AuthLayout>
      </>
    )
  }

  return <AuthForm />
}

function AuthForm() {
  const { t } = useTranslation('common')
  const {
    loading: githubLoading,
    error: githubError,
    startLogin: startGitHubLogin,
  } = useGitHubLogin(t('auth.githubLoginError'), t('auth.githubAccountLinkRequired'))
  const {
    mode,
    step,
    email,
    setEmail,
    code,
    setCode,
    displayName,
    setDisplayName,
    loading,
    error,
    countdown,
    isRegister,
    handleSendCode,
    handleVerifyCode,
    handleResendCode,
    switchMode,
    setStep,
  } = useAuthForm()

  return (
    <>
      <SeoHead title={isRegister ? 'Sign Up - MarkFlowy' : 'Sign In - MarkFlowy'} />

      <AuthLayout>
        <AuthContainer>
          <LogoSection>
            <Link href='/' passHref legacyBehavior>
              <LogoLink>
                <LogoImage src='/logo.svg' alt='MarkFlowy' />
                <LogoText>MarkFlowy</LogoText>
              </LogoLink>
            </Link>
          </LogoSection>

          <AuthCard>
            <AuthHeading>
              <h1>{isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}</h1>
              <p>{t('auth.welcomeDescription')}</p>
            </AuthHeading>
            <SocialAuthSection>
              <GitHubButton type='button' onClick={startGitHubLogin} disabled={githubLoading}>
                <i className='ri-github-fill' aria-hidden='true' />
                {githubLoading ? t('auth.githubRedirecting') : t('auth.continueWithGitHub')}
              </GitHubButton>
              {githubError && <ErrorMessage>{githubError}</ErrorMessage>}
              <AuthDivider>
                <span>{t('auth.orContinueWithEmail')}</span>
              </AuthDivider>
            </SocialAuthSection>

            <TabContainer>
              <Tab $active={mode === AuthMode.LOGIN} onClick={() => switchMode(AuthMode.LOGIN)}>
                {t('auth.login')}
              </Tab>
              <Tab
                $active={mode === AuthMode.REGISTER}
                onClick={() => switchMode(AuthMode.REGISTER)}
              >
                {t('auth.register')}
              </Tab>
            </TabContainer>

            <FormSection>
              {step === Step.EMAIL ? (
                <>
                  {isRegister && (
                    <InputGroup>
                      <FieldLabel htmlFor='auth-name'>{t('auth.displayName')}</FieldLabel>
                      <Input
                        id='auth-name'
                        type='text'
                        autoComplete='name'
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t('auth.displayNamePlaceholder') || t('auth.displayName')}
                      />
                    </InputGroup>
                  )}

                  <InputGroup>
                    <FieldLabel htmlFor='auth-email'>{t('auth.email')}</FieldLabel>
                    <Input
                      id='auth-email'
                      type='email'
                      autoComplete='email'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.emailPlaceholder') || t('auth.email')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendCode()
                      }}
                    />
                  </InputGroup>

                  {!isRegister && <HintMessage>{t('auth.autoRegisterHint')}</HintMessage>}

                  {error && <ErrorMessage>{error}</ErrorMessage>}

                  <SubmitButton
                    onClick={handleSendCode}
                    disabled={!email || loading || countdown > 0}
                  >
                    {loading ? (
                      <LoadingSpinner />
                    ) : countdown > 0 ? (
                      t('auth.resendCode', { seconds: countdown })
                    ) : (
                      t('auth.sendCode')
                    )}
                  </SubmitButton>
                </>
              ) : (
                <>
                  <EmailDisplay>
                    {email}
                    <ChangeEmail onClick={() => setStep(Step.EMAIL)}>
                      {t('auth.changeEmail')}
                    </ChangeEmail>
                  </EmailDisplay>

                  <InputGroup>
                    <FieldLabel htmlFor='auth-code'>{t('auth.verificationCode')}</FieldLabel>
                    <CodeInput
                      id='auth-code'
                      type='text'
                      autoComplete='one-time-code'
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={t('auth.codePlaceholder') || t('auth.verificationCode')}
                      maxLength={8}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleVerifyCode()
                      }}
                    />
                  </InputGroup>

                  {error && <ErrorMessage>{error}</ErrorMessage>}

                  <SubmitButton
                    onClick={handleVerifyCode}
                    disabled={!code || code.length < 8 || loading}
                  >
                    {loading ? (
                      <LoadingSpinner />
                    ) : isRegister ? (
                      t('auth.createAccount')
                    ) : (
                      t('auth.signIn')
                    )}
                  </SubmitButton>

                  <ResendSection>
                    {countdown > 0 ? (
                      <ResendText>{t('auth.resendCode', { seconds: countdown })}</ResendText>
                    ) : (
                      <ResendButton onClick={handleResendCode}>{t('auth.resend')}</ResendButton>
                    )}
                  </ResendSection>
                </>
              )}
            </FormSection>
          </AuthCard>

          <BackLink>
            <Link href='/' passHref legacyBehavior>
              <StyledLink>← {t('auth.backToHome')}</StyledLink>
            </Link>
          </BackLink>
        </AuthContainer>
      </AuthLayout>
    </>
  )
}

const AuthLayout = styled.main`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 100dvh;
  background: var(--paper-warm);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;

  &::before,
  &::after {
    content: '';
    position: absolute;
    z-index: -1;
    pointer-events: none;
    width: 150%;
    left: -25%;
    transform: skewY(-12deg);
  }
  &::before {
    height: 360px;
    top: -155px;
    background: linear-gradient(
      100deg,
      color-mix(in srgb, var(--seal) 12%, var(--paper)),
      color-mix(in srgb, var(--seal) 75%, var(--paper))
    );
  }
  &::after {
    top: 183px;
    height: 16px;
    background: linear-gradient(90deg, transparent 18%, var(--seal) 65%, transparent 95%);
    opacity: 0.5;
  }
  ${mobile(css`
    align-items: flex-start;
    padding: 40px 20px;
  `)}
`

const AuthContainer = styled.div`
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 28px;
`

const LogoSection = styled.div`
  display: flex;
  padding-left: 6px;
`

const LogoLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  text-decoration: none;
`

const LogoImage = styled.img`
  width: 32px;
  height: 32px;
`

const LogoText = styled.span`
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.04em;
`

const AuthCard = styled.div`
  padding: 36px 40px;
  background: var(--paper);
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  box-shadow:
    0 20px 60px -24px color-mix(in srgb, var(--ink) 30%, transparent),
    0 3px 12px color-mix(in srgb, var(--ink) 4%, transparent);

  ${mobile(css`
    padding: 28px 24px;
  `)}
`

const AuthHeading = styled.div`
  margin-bottom: 28px;
  h1 {
    margin: 0 0 10px;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.035em;
  }
  p {
    margin: 0;
    color: var(--ink-mute);
    font-size: 14px;
    line-height: 1.6;
  }
`

const SocialAuthSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
`

const GitHubButton = styled.button.attrs({ type: 'button' })`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 16px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 4px color-mix(in srgb, var(--ink) 4%, transparent);
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
  i {
    font-size: 20px;
  }
  &:hover:not(:disabled) {
    background: var(--paper-warm);
    border-color: var(--ink-faint);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`

const AuthDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ink-faint);
  font-size: 12px;
  &::before,
  &::after {
    content: '';
    height: 1px;
    flex: 1;
    background: var(--line-soft);
  }
`

const TabContainer = styled.div`
  display: flex;
  gap: 24px;
  margin-top: 14px;
  border-bottom: 1px solid var(--line-soft);
`

const Tab = styled.button.attrs({ type: 'button' })<{ $active: boolean }>`
  padding: 12px 0;
  background: transparent;
  border: 0;
  border-bottom: 2px solid ${(props) => (props.$active ? 'var(--seal)' : 'transparent')};
  margin-bottom: -1px;
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => (props.$active ? 'var(--seal)' : 'var(--ink-mute)')};
  cursor: pointer;
  transition:
    color 160ms ease,
    border-color 160ms ease;
  &:hover {
    color: var(--seal);
  }
`

const FormSection = styled.div`
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const FieldLabel = styled.label`
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
`

const Input = styled.input`
  width: 100%;
  min-height: 44px;
  padding: 10px 13px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 15px;
  color: var(--ink);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 4%, transparent);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
  &:focus {
    border-color: var(--seal);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--seal) 12%, transparent);
  }
  &::placeholder {
    color: var(--ink-faint);
  }
  ${mobile(css`
    font-size: 16px;
  `)}
`

const CodeInput = styled(Input)`
  font-size: 18px;
  letter-spacing: 4px;
  text-align: center;
`

const EmailDisplay = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  overflow-wrap: anywhere;
  background: var(--paper-warm);
  border-radius: 6px;
  font-size: 14px;
  color: var(--ink);
`

const ChangeEmail = styled.button.attrs({ type: 'button' })`
  flex-shrink: 0;
  background: transparent;
  border: 0;
  padding: 2px;
  font-size: 12px;
  color: var(--seal);
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`

const HintMessage = styled.div`
  font-size: 12px;
  color: var(--ink-mute);
  line-height: 1.5;
`

const ErrorMessage = styled.div.attrs({ role: 'alert' })`
  padding: 10px 12px;
  background: ${(props) => `color-mix(in srgb, ${props.theme.dangerColor} 7%, var(--paper))`};
  border: 1px solid ${(props) => `color-mix(in srgb, ${props.theme.dangerColor} 25%, transparent)`};
  border-radius: 6px;
  font-size: 13px;
  color: ${(props) => props.theme.dangerColor};
`

const SubmitButton = styled.button.attrs({ type: 'button' })`
  width: 100%;
  min-height: 44px;
  padding: 10px 16px;
  background: var(--seal);
  border: 1px solid transparent;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 600;
  color: var(--paper);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 160ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--seal) 85%, var(--ink));
  }
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`

const LoadingSpinner = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: mf-auth-spin 800ms linear infinite;
  @keyframes mf-auth-spin {
    to {
      transform: rotate(360deg);
    }
  }
`

const ResendSection = styled.div`
  text-align: center;
  margin-top: 4px;
`
const ResendText = styled.span`
  font-size: 13px;
  color: var(--ink-faint);
`
const ResendButton = styled.button.attrs({ type: 'button' })`
  background: transparent;
  border: 0;
  font-size: 13px;
  color: var(--seal);
  cursor: pointer;
  padding: 0;
  &:hover {
    text-decoration: underline;
  }
`
const BackLink = styled.div`
  padding-left: 6px;
`
const StyledLink = styled.a`
  font-size: 13px;
  color: var(--ink-mute);
  text-decoration: none;
  transition: color 160ms ease;
  &:hover {
    color: var(--seal);
  }
`

export const getStaticProps = async ({ locale }: { locale: string }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
