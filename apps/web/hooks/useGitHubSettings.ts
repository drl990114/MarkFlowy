import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { apiClient } from 'utils/apiClient'
import type { GitHubConfig } from '@markflowy/types'

export interface GitHubRepo {
  id: number
  full_name: string
  name: string
  owner: { login: string }
  description: string | null
  private: boolean
  updated_at: string
}

export function useGitHubSettings(isAuthenticated: boolean, authLoading: boolean) {
  const router = useRouter()
  const [config, setConfig] = useState<GitHubConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoError, setRepoError] = useState('')

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    loadConfig()
  }, [isAuthenticated, authLoading])

  useEffect(() => {
    if (config?.hasToken) {
      loadRepos()
    }
  }, [config?.hasToken])

  const loadConfig = async () => {
    try {
      const data = await apiClient.get<GitHubConfig>('/github/config')
      setConfig(data)
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to load GitHub configuration')
      setLoading(false)
    }
  }

  const loadRepos = async () => {
    setLoadingRepos(true)
    setRepoError('')
    try {
      const data = await apiClient.get<GitHubRepo[]>('/github/repos?per_page=100')
      setRepos(data)
    } catch (err: any) {
      setRepoError(err?.message || 'Failed to load repositories')
    } finally {
      setLoadingRepos(false)
    }
  }

  const handleSave = async () => {
    if (!token.trim()) {
      setError('Please enter a valid GitHub token')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await apiClient.post('/github/config', { token: token.trim() })
      setSuccess('GitHub token saved successfully!')
      setToken('')
      loadConfig()
    } catch (err: any) {
      setError(err?.message || 'Failed to save GitHub token')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove your GitHub token?')) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await apiClient.delete('/github/config')
      setSuccess('GitHub token removed successfully!')
      setConfig({ hasToken: false })
      setRepos([])
    } catch (err: any) {
      setError(err?.message || 'Failed to remove GitHub token')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenWorkspace = async (repo: GitHubRepo) => {
    const existing = await apiClient.get<any[]>('/workspaces')
    const found = existing.find(
      (w) => w.type === 'GITHUB' && w.sourceUrl === `https://github.com/${repo.owner.login}/${repo.name}`,
    )
    if (found) {
      router.push(`/workspace/${encodeURIComponent(found.id)}`)
      return
    }
    const created = await apiClient.post<any>('/workspaces', {
      name: repo.name,
      type: 'GITHUB',
      sourceUrl: `https://github.com/${repo.owner.login}/${repo.name}`,
    })
    router.push(`/workspace/${encodeURIComponent(created.id)}`)
  }

  return {
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
    handleSave,
    handleDelete,
    handleOpenWorkspace,
  }
}
