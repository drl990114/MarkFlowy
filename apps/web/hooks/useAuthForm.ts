import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { apiClient } from '../utils/apiClient'

export enum AuthMode {
  LOGIN = 'login',
  REGISTER = 'register',
}

export enum Step {
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

export function useAuthForm() {
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

  return {
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
  }
}
