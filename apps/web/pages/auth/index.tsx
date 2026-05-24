import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import styled, { css } from 'styled-components'
import SeoHead from '../../components/SeoHead'
import { apiClient } from '../../utils/apiClient'
import { mobile } from '../../utils/media'
import rem from '../../utils/rem'

enum AuthMode {
  LOGIN = 'login',
  REGISTER = 'register',
}

enum Step {
  EMAIL = 'email',
  CODE = 'code',
}

const COUNTDOWN_STORAGE_KEY = 'markflowy:emailCodeCountdown'

const getCountdownEndTime = (email: string) => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(`${COUNTDOWN_STORAGE_KEY}:${email}`)
  return raw ? parseInt(raw, 10) : null
}

const setCountdownEndTime = (email: string, endTime: number) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${COUNTDOWN_STORAGE_KEY}:${email}`, String(endTime))
}

const clearCountdownEndTime = (email: string) => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`${COUNTDOWN_STORAGE_KEY}:${email}`)
}

export default function AuthPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>(AuthMode.LOGIN)
  const [step, setStep] = useState<Step>(Step.EMAIL)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  const isRegister = mode === AuthMode.REGISTER

  useEffect(() => {
    if (!email) {
      setCountdown(0)
      return
    }
    const endTime = getCountdownEndTime(email)
    if (endTime) {
      const remaining = Math.ceil((endTime - Date.now()) / 1000)
      if (remaining > 0) {
        setCountdown(remaining)
      } else {
        clearCountdownEndTime(email)
        setCountdown(0)
      }
    } else {
      setCountdown(0)
    }
  }, [email])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      const endTime = getCountdownEndTime(email)
      if (!endTime) {
        clearInterval(timer)
        setCountdown(0)
        return
      }
      const remaining = Math.ceil((endTime - Date.now()) / 1000)
      if (remaining <= 0) {
        clearInterval(timer)
        setCountdown(0)
        clearCountdownEndTime(email)
      } else {
        setCountdown(remaining)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown, email])

  const startCountdown = (targetEmail: string) => {
    const endTime = Date.now() + 60 * 1000
    setCountdownEndTime(targetEmail, endTime)
    setCountdown(60)
  }

  const handleSendCode = async () => {
    if (!email || loading || countdown > 0) return
    setLoading(true)
    setError('')

    try {
      await apiClient.post('/auth/email/send-code', {
        email,
        purpose: isRegister ? 'register' : 'login',
        ...(isRegister && displayName ? { displayName } : {}),
      }, { skipAuth: true })

      setStep(Step.CODE)
      startCountdown(email)
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!code || loading) return
    setLoading(true)
    setError('')

    try {
      const data = await apiClient.post('/auth/email/verify-code', {
        email,
        code,
        ...(isRegister && displayName ? { displayName } : {}),
      }, { skipAuth: true })

      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))

      clearCountdownEndTime(email)
      router.push('/workspace')
    } catch (err: any) {
      setError(err.message || 'Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = () => {
    if (countdown > 0) return
    handleSendCode()
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setStep(Step.EMAIL)
    setEmail('')
    setCode('')
    setDisplayName('')
    setError('')
    setCountdown(0)
  }

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
            <TabContainer>
              <Tab
                $active={mode === AuthMode.LOGIN}
                onClick={() => switchMode(AuthMode.LOGIN)}
              >
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

                  {!isRegister && (
                    <HintMessage>{t('auth.autoRegisterHint')}</HintMessage>
                  )}

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
                      <ResendButton onClick={handleResendCode}>
                        {t('auth.resend')}
                      </ResendButton>
                    )}
                  </ResendSection>
                </>
              )}
            </FormSection>

            <Divider>
              <DividerLine />
              <DividerText>or</DividerText>
              <DividerLine />
            </Divider>

            <GithubButtonContainer>
              <GithubButton
                onClick={() => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200'
                  window.location.href = `${apiUrl}/auth/github`
                }}
              >
                <GithubIcon />
                Continue with GitHub
              </GithubButton>
            </GithubButtonContainer>
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
    color: ${(props) => props.theme.disabledFontColor}
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

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
  padding: 0 ${rem(20)} ${rem(16)};
`

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${(props) => props.theme.borderColor};
`

const DividerText = styled.span`
  font-size: ${rem(12)};
  color: ${(props) => props.theme.disabledFontColor};
`

const GithubButtonContainer = styled.div`
  padding: 0 ${rem(20)} ${rem(20)};
`

const GithubButton = styled.button`
  width: 100%;
  padding: ${rem(10)} ${rem(16)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  font-size: ${rem(14)};
  font-weight: 500;
  color: ${(props) => props.theme.primaryFontColor};
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(8)};

  &:hover {
    background: ${(props) => props.theme.bgColorSecondary};
    border-color: ${(props) => props.theme.disabledFontColor};
  }
`

const GithubIcon = () => (
  <svg width='18' height='18' viewBox='0 0 98 96' xmlns='http://www.w3.org/2000/svg'>
    <path
      fillRule='evenodd'
      clipRule='evenodd'
      d='M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z'
      fill='#ffffff'
    />
  </svg>
)

export const getStaticProps = async ({ locale }: { locale: string }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
