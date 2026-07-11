import { useCallback, useState } from 'react'
import {
  getGitHubWorkspaceErrorMessage,
  type GitHubRepo,
  type ImportedGitHubWorkspace,
  workspaceGitHubService,
} from '../services/workspaceGitHubService'

export function useGitHubWorkspaceImport() {
  const [importingRepo, setImportingRepo] = useState<string | null>(null)
  const [importError, setImportError] = useState('')

  const importRepository = useCallback(
    async (repo: GitHubRepo): Promise<ImportedGitHubWorkspace | null> => {
      setImportingRepo(repo.full_name)
      setImportError('')

      try {
        return await workspaceGitHubService.importRepository(repo.owner.login, repo.name)
      } catch (error) {
        setImportError(getGitHubWorkspaceErrorMessage(error, 'Failed to import GitHub repository'))
        return null
      } finally {
        setImportingRepo(null)
      }
    },
    [],
  )

  return {
    importingRepo,
    importError,
    clearImportError: () => setImportError(''),
    importRepository,
  }
}
