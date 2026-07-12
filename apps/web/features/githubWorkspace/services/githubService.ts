import { apiClient } from '../../../utils/apiClient'

export interface GitHubRepo {
  id: number
  full_name: string
  name: string
  owner: { login: string }
  description: string | null
  private: boolean
  updated_at: string
}

export interface ImportedGitHubWorkspace {
  id: string
  name: string
  type: 'GITHUB'
  sourceUrl?: string | null
}

export const githubService = {
  listRepos(page = 1, perPage = 30) {
    return apiClient.get<GitHubRepo[]>(`/github/repos?page=${page}&per_page=${perPage}`)
  },

  importRepository(owner: string, repo: string) {
    return apiClient.post<ImportedGitHubWorkspace>('/workspaces/import/github', { owner, repo })
  },
}
