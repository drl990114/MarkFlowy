import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { apiClient } from '../utils/apiClient'

export interface User {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
}

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
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken')

        if (!token) {
          setAuthState({
            user: null,
            loading: false,
            isAuthenticated: false,
          })
          
          if (requireAuth) {
            router.push('/auth')
          }
          return
        }

        try {
          const user = await apiClient.get<User>('/me')
          localStorage.setItem('user', JSON.stringify(user))
          
          setAuthState({
            user,
            loading: false,
            isAuthenticated: true,
          })
        } catch (error) {
          console.error('Failed to fetch user:', error)
          
          const userStr = localStorage.getItem('user')
          if (userStr) {
            const user = JSON.parse(userStr) as User
            setAuthState({
              user,
              loading: false,
              isAuthenticated: true,
            })
          } else {
            setAuthState({
              user: null,
              loading: false,
              isAuthenticated: false,
            })
            
            if (requireAuth) {
              router.push('/auth')
            }
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        
        setAuthState({
          user: null,
          loading: false,
          isAuthenticated: false,
        })
        
        if (requireAuth) {
          router.push('/auth')
        }
      }
    }

    checkAuth()
  }, [requireAuth, router])

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken })
      } catch (error) {
        console.error('Logout request failed:', error)
      }
    }
    
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    
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
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken')
      const userStr = localStorage.getItem('user')

      if (token && userStr) {
        router.push('/workspace')
      } else {
        setChecking(false)
      }
    }

    checkAuth()
  }, [router])

  return checking
}
