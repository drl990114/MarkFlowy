import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { apiClient } from 'utils/apiClient'
import type { GitHubConfig } from '@markflowy/types'
import { useGitHubWorkspaceImport } from 'features/githubWorkspace/hooks/useGitHubWorkspaceImport'
import type { GitHubRepo } from 'features/githubWorkspace/services/githubService'

export function useGitHubSettings(isAuthenticated: boolean, authLoading: boolean) {
  const router = useRouter()
  const [config, setConfig] = useState<GitHubConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [success, setSuccess] = useState('')
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoError, setRepoError] = useState('')
  const { importingRepo, importError, importRepository } = useGitHubWorkspaceImport()

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
      setSettingsError(err?.message || 'Failed to load GitHub configuration')
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
      setSettingsError('Please enter a valid GitHub token')
      return
    }

    setSaving(true)
    setSettingsError('')
    setSuccess('')

    try {
      await apiClient.post('/github/config', { token: token.trim() })
      setSuccess('GitHub token saved successfully!')
      setToken('')
      await loadConfig()
    } catch (err: any) {
      setSettingsError(err?.message || 'Failed to save GitHub token')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove your GitHub token?')) {
      return
    }

    setSaving(true)
    setSettingsError('')
    setSuccess('')

    try {
      await apiClient.delete('/github/config')
      setSuccess('GitHub token removed successfully!')
      setConfig({ hasToken: false })
      setRepos([])
    } catch (err: any) {
      setSettingsError(err?.message || 'Failed to remove GitHub token')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenWorkspace = async (repo: GitHubRepo) => {
    const workspace = await importRepository(repo)
    if (workspace) {
      router.push(`/workspace/${encodeURIComponent(workspace.id)}`)
    }
  }

  return {
    config,
    loading,
    token,
    setToken,
    saving,
    error: settingsError || importError,
    success,
    repos,
    loadingRepos,
    repoError,
    importingRepo,
    handleSave,
    handleDelete,
    handleOpenWorkspace,
  }
}
