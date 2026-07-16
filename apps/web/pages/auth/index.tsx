import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import Link from 'next/link'
import styled, { css } from 'styled-components'
import SeoHead from '../../components/SeoHead'
import { AuthMode, Step, useAuthForm } from '../../hooks/useAuthForm'
import { useGitHubLogin } from '../../hooks/useGitHubLogin'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'

export default function AuthPage() {
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
                      <Input
                        type='text'
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t('auth.displayNamePlaceholder') || t('auth.displayName')}
                      />
                    </InputGroup>
                  )}

                  <InputGroup>
                    <Input
                      type='email'
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
                    <CodeInput
                      type='text'
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

const AuthLayout = styled.div`
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${rem(24)};

  ${mobile(css`
    padding: ${rem(16)};
  `)}
`

const AuthContainer = styled.div`
  width: 100%;
  max-width: ${rem(360)};
  display: flex;
  flex-direction: column;
  gap: ${rem(24)};
`

const LogoSection = styled.div`
  display: flex;
  justify-content: center;
`

const LogoLink = styled.a`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  text-decoration: none;
`

const LogoImage = styled.img`
  width: ${rem(28)};
  height: ${rem(28)};
`

const LogoText = styled.span`
  font-size: ${rem(18)};
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.02em;
`

const AuthCard = styled.div`
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  overflow: hidden;
`

const SocialAuthSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};
  padding: ${rem(20)} ${rem(20)} 0;

  ${mobile(css`
    padding: ${rem(16)} ${rem(16)} 0;
  `)}
`

const GitHubButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(8)};
  width: 100%;
  min-height: ${rem(40)};
  padding: 0 ${rem(16)};
  background: ${(props) => props.theme.primaryFontColor};
  border: 1px solid ${(props) => props.theme.primaryFontColor};
  border-radius: ${rem(6)};
  color: ${(props) => props.theme.bgColor};
  font-size: ${rem(14)};
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;

  i {
    font-size: ${rem(18)};
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:focus-visible {
    outline: 2px solid #d4564a;
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`

const AuthDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  color: ${(props) => props.theme.disabledFontColor};
  font-size: ${rem(12)};

  &::before,
  &::after {
    content: '';
    height: 1px;
    flex: 1;
    background: ${(props) => props.theme.borderColor};
  }
`

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
`

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: ${rem(12)} ${rem(16)};
  background: transparent;
  border: none;
  font-size: ${rem(14)};
  font-weight: 500;
  color: ${(props) => (props.$active ? '#ffffff' : props.theme.unselectedFontColor)};
  cursor: pointer;
  transition: color 0.15s ease;
  position: relative;

  ${(props) =>
    props.$active &&
    css`
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1.5px;
        background: #d4564a;
      }
    `}

  &:hover {
    color: #ffffff;
  }
`

const FormSection = styled.div`
  padding: ${rem(20)};
  display: flex;
  flex-direction: column;
  gap: ${rem(12)};

  ${mobile(css`
    padding: ${rem(16)};
  `)}
`

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
`

const Input = styled.input`
  width: 100%;
  padding: ${rem(10)} ${rem(14)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  font-size: ${rem(14)};
  color: ${(props) => props.theme.primaryFontColor};
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: #d4564a;
  }

  &::placeholder {
    color: ${(props) => props.theme.disabledFontColor};
  }
`

const CodeInput = styled(Input)`
  font-size: ${rem(16)};
  letter-spacing: ${rem(4)};
  text-align: center;
`

const EmailDisplay = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(10)} ${rem(14)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  font-size: ${rem(14)};
  color: ${(props) => props.theme.primaryFontColor};
`

const ChangeEmail = styled.button`
  background: transparent;
  border: none;
  font-size: ${rem(12)};
  color: #d4564a;
  cursor: pointer;
  padding: 0;
  margin-left: ${rem(8)};

  &:hover {
    text-decoration: underline;
  }
`

const HintMessage = styled.div`
  font-size: ${rem(12)};
  color: ${(props) => props.theme.disabledFontColor};
  line-height: 1.5;
`

const ErrorMessage = styled.div`
  padding: ${rem(10)} ${rem(12)};
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: ${rem(6)};
  font-size: ${rem(13)};
  color: #dc2626;
`

const SubmitButton = styled.button`
  width: 100%;
  padding: ${rem(10)} ${rem(16)};
  background: #d4564a;
  border: none;
  border-radius: ${rem(6)};
  font-size: ${rem(14)};
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(8)};
  margin-top: ${rem(4)};

  &:hover:not(:disabled) {
    background: #c9845b;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const LoadingSpinner = styled.div`
  width: ${rem(16)};
  height: ${rem(16)};
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

const ResendSection = styled.div`
  text-align: center;
  margin-top: ${rem(4)};
`

const ResendText = styled.span`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
`

const ResendButton = styled.button`
  background: transparent;
  border: none;
  font-size: ${rem(13)};
  color: #d4564a;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`

const BackLink = styled.div`
  text-align: center;
`

const StyledLink = styled.a`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.unselectedFontColor};
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover {
    color: #ffffff;
  }
`

export const getStaticProps = async ({ locale }: { locale: string }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
