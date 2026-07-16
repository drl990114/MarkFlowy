import { useCallback, useRef, useState } from 'react'
import { getRemoteWorkspaceErrorMessage } from '../../workspace/services/remoteWorkspaceService'
import {
  githubService,
  type GitHubRepo,
  type ImportedGitHubWorkspace,
} from '../services/githubService'

export function useGitHubWorkspaceImport() {
  const [importingRepo, setImportingRepo] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const importRequestVersionRef = useRef(0)

  const importRepository = useCallback(
    async (repo: GitHubRepo): Promise<ImportedGitHubWorkspace | null> => {
      const requestVersion = ++importRequestVersionRef.current
      setImportingRepo(repo.full_name)
      setImportError('')

      try {
        const workspace = await githubService.importRepository(repo.id, repo.installationId)
        return requestVersion === importRequestVersionRef.current ? workspace : null
      } catch (error) {
        if (requestVersion === importRequestVersionRef.current) {
          setImportError(
            getRemoteWorkspaceErrorMessage(error, 'Failed to import GitHub repository'),
          )
        }
        return null
      } finally {
        if (requestVersion === importRequestVersionRef.current) {
          setImportingRepo(null)
        }
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
