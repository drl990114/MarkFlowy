import { apiClient } from './api-client'
import { authApi, type User, type AuthTokens } from './auth-api'
import { LazyStore } from '@tauri-apps/plugin-store'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const AUTH_STORE_PATH = 'auth-store.json'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  setUser: (user: User | null) => void
  setTokens: (tokens: AuthTokens) => void
  setLoading: (loading: boolean) => void
  login: (tokens: AuthTokens, user: User) => void
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
}

const store = new LazyStore(AUTH_STORE_PATH)

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => {
        set({ user })
      },

      setTokens: (tokens) => {
        apiClient.setToken(tokens.accessToken)
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      login: (tokens, user) => {
        apiClient.setToken(tokens.accessToken)
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      logout: () => {
        const { refreshToken } = get()
        if (refreshToken) {
          authApi.logout(refreshToken).catch(console.error)
        }
        apiClient.setToken(null)
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          return false
        }

        try {
          const response = await authApi.refreshToken(refreshToken)
          if (response.data) {
            const { accessToken, refreshToken: newRefreshToken } = response.data
            apiClient.setToken(accessToken)
            set({
              accessToken,
              refreshToken: newRefreshToken,
            })
            return true
          }
        } catch (error) {
          console.error('Failed to refresh token:', error)
          get().logout()
        }
        return false
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => {
          const value = await store.get(name)
          return value ?? null
        },
        setItem: async (name: string, value: string) => {
          await store.set(name, value)
          await store.save()
        },
        removeItem: async (name: string) => {
          await store.delete(name)
          await store.save()
        },
      })),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          apiClient.setToken(state.accessToken)
        }
      },
    },
  ),
)

export const initAuth = async () => {
  const { accessToken, refreshAccessToken, logout } = useAuthStore.getState()
  
  if (accessToken) {
    apiClient.setToken(accessToken)
    const success = await refreshAccessToken()
    if (!success) {
      logout()
    }
  }
}
