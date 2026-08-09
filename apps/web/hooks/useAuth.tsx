import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { apiClient } from '../utils/apiClient'
import { clearAuthSession } from '../utils/authSession'
import type { User } from '@markflowy/types'

interface AuthState {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
}

export function useAuth(requireAuth = false) {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  })

  useEffect(() => {
    let cancelled = false

    const checkAuth = async () => {
      try {
        const sessionRestored = await apiClient.restoreSession()
        if (!sessionRestored) {
          clearAuthSession()

          if (!cancelled) {
            setAuthState({
              user: null,
              loading: false,
              isAuthenticated: false,
            })

            if (requireAuth) {
              await router.push('/auth')
            }
          }
          return
        }

        const user = await apiClient.get<User>('/me')
        if (cancelled) return

        localStorage.setItem('user', JSON.stringify(user))

        setAuthState({
          user,
          loading: false,
          isAuthenticated: true,
        })
      } catch (error) {
        console.error('Auth check failed:', error)

        clearAuthSession()

        if (!cancelled) {
          setAuthState({
            user: null,
            loading: false,
            isAuthenticated: false,
          })

          if (requireAuth) {
            await router.push('/auth')
          }
        }
      }
    }

    void checkAuth()

    return () => {
      cancelled = true
    }
  }, [requireAuth, router])

  const logout = async () => {
    try {
      await apiClient.logoutSession()
    } catch (error) {
      console.error('Logout request failed:', error)
    }

    clearAuthSession()

    setAuthState({
      user: null,
      loading: false,
      isAuthenticated: false,
    })

    router.push('/auth')
  }

  return {
    ...authState,
    logout,
  }
}

export function useRedirectIfAuthenticated() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    const checkAuth = async () => {
      try {
        if (await apiClient.restoreSession()) {
          if (!cancelled) {
            await router.replace('/workspace')
          }
          return
        }
      } finally {
        if (!cancelled) {
          setChecking(false)
        }
      }
    }

    void checkAuth()

    return () => {
      cancelled = true
    }
  }, [router])

  return checking
}
