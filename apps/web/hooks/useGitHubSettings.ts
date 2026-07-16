import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { GitHubConnectionStatus } from '@markflowy/types'
import { useGitHubWorkspaceImport } from 'features/githubWorkspace/hooks/useGitHubWorkspaceImport'
import { githubService, type GitHubRepo } from 'features/githubWorkspace/services/githubService'
import { redirectToGitHub } from 'utils/githubAuthorization'

type StartingAction = 'connection' | 'installation' | null

const disconnectedStatus: GitHubConnectionStatus = {
  linked: false,
  installations: [],
}

export function useGitHubSettings(isAuthenticated: boolean, authLoading: boolean) {
  const router = useRouter()
  const [connection, setConnection] = useState<GitHubConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingAction, setStartingAction] = useState<StartingAction>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [deletingInstallationId, setDeletingInstallationId] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState('')
  const [success, setSuccess] = useState('')
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoError, setRepoError] = useState('')
  const { importingRepo, importError, importRepository } = useGitHubWorkspaceImport()

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true)
    setRepoError('')

    try {
      const data = await githubService.listRepos(1, 100)
      setRepos(data)
    } catch (caughtError) {
      setRepoError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Failed to load repositories',
      )
    } finally {
      setLoadingRepos(false)
    }
  }, [])

  const loadConnection = useCallback(async () => {
    setLoading(true)
    setSettingsError('')

    try {
      const data = await githubService.getConnection()
      setConnection(data)

      if (data.linked && data.installations.length > 0) {
        void loadRepos()
      } else {
        setRepos([])
        setRepoError('')
      }
    } catch (caughtError) {
      setSettingsError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Failed to load GitHub connection',
      )
    } finally {
      setLoading(false)
    }
  }, [loadRepos])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    void loadConnection()
  }, [authLoading, isAuthenticated, loadConnection])

  useEffect(() => {
    if (!router.isReady) return

    if (router.query.github === 'linked') {
      setSuccess('GitHub account linked successfully.')
    } else if (router.query.github === 'installed') {
      setSuccess('GitHub repository access authorized successfully.')
    } else if (typeof router.query.github_error === 'string') {
      setSettingsError('GitHub authorization was not completed. Please try again.')
    }
  }, [router.isReady, router.query.github, router.query.github_error])

  const startAuthorization = async (action: Exclude<StartingAction, null>) => {
    if (startingAction) return

    setStartingAction(action)
    setSettingsError('')
    setSuccess('')

    try {
      const { authorizeUrl } =
        action === 'connection'
          ? await githubService.startConnection()
          : await githubService.startInstallation()
      redirectToGitHub(authorizeUrl)
    } catch (caughtError) {
      setSettingsError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Failed to start GitHub authorization',
      )
      setStartingAction(null)
    }
  }

  const handleDeleteConnection = async () => {
    if (!confirm('Unlink this GitHub account from MarkFlowy?')) return

    setDisconnecting(true)
    setSettingsError('')
    setSuccess('')

    try {
      await githubService.deleteConnection()
      setConnection(disconnectedStatus)
      setRepos([])
      setSuccess('GitHub account unlinked successfully.')
    } catch (caughtError) {
      setSettingsError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Failed to unlink GitHub account',
      )
    } finally {
      setDisconnecting(false)
    }
  }

  const handleDeleteInstallation = async (installationId: string) => {
    if (
      !confirm(
        'Remove this authorization record from your MarkFlowy account? This does not uninstall the GitHub App or change access on GitHub.',
      )
    )
      return

    setDeletingInstallationId(installationId)
    setSettingsError('')
    setSuccess('')

    try {
      await githubService.deleteInstallation(installationId)
      setSuccess(
        'GitHub repository authorization removed from this MarkFlowy account. The GitHub App remains installed.',
      )
      await loadConnection()
    } catch (caughtError) {
      setSettingsError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Failed to remove the GitHub authorization from MarkFlowy',
      )
    } finally {
      setDeletingInstallationId(null)
    }
  }

  const handleOpenWorkspace = async (repo: GitHubRepo) => {
    const workspace = await importRepository(repo)
    if (workspace) {
      await router.push(`/workspace/${encodeURIComponent(workspace.id)}`)
    }
  }

  return {
    connection,
    loading,
    startingAction,
    disconnecting,
    deletingInstallationId,
    error: settingsError || importError,
    success,
    repos,
    loadingRepos,
    repoError,
    importingRepo,
    handleStartConnection: () => startAuthorization('connection'),
    handleStartInstallation: () => startAuthorization('installation'),
    handleDeleteConnection,
    handleDeleteInstallation,
    handleOpenWorkspace,
  }
}
