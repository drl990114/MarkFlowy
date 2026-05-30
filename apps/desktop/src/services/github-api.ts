import { apiClient } from './api-client'
import type {
  GitHubTreeItem,
  GitHubFileContent,
  GitHubBranch,
  GitHubRepository,
  GitHubPullRequest,
} from '@markflowy/github-api'
import type { GitHubConfig } from '@markflowy/types'

export type { GitHubConfig } from '@markflowy/types'
export type { GitHubRepository, GitHubPullRequest } from '@markflowy/github-api'

export interface SaveGithubConfigParams {
  token: string
}

export interface ListReposParams {
  page?: string
  per_page?: string
  sort?: string
  direction?: string
}

export interface CreatePullRequestParams {
  title: string
  head: string
  base: string
  body: string
}

export const githubApi = {
  getGithubConfig: async () => {
    return apiClient.get<GitHubConfig>('/github/config')
  },

  saveGithubConfig: async (params: SaveGithubConfigParams) => {
    return apiClient.post<GitHubConfig>('/github/config', params)
  },

  deleteGithubConfig: async () => {
    return apiClient.delete<{ success: boolean }>('/github/config')
  },

  listRepos: async (params?: ListReposParams) => {
    return apiClient.get<GitHubRepository[]>('/github/repos', { params })
  },

  listBranches: async (owner: string, repo: string) => {
    return apiClient.get<GitHubBranch[]>(`/github/repos/${owner}/${repo}/branches`)
  },

  getBranch: async (owner: string, repo: string, branch: string) => {
    return apiClient.get<GitHubBranch>(`/github/repos/${owner}/${repo}/branches/${branch}`)
  },

  getContents: async (owner: string, repo: string, path: string, ref?: string) => {
    return apiClient.get<GitHubFileContent | GitHubFileContent[]>(
      `/github/repos/${owner}/${repo}/contents/${path}`,
      { params: { ref } },
    )
  },

  getTree: async (owner: string, repo: string, sha: string, recursive = true) => {
    return apiClient.get<{ tree: GitHubTreeItem[] }>(
      `/github/repos/${owner}/${repo}/git/trees/${sha}`,
      { params: { recursive: recursive ? '1' : '0' } },
    )
  },

  createOrUpdateFile: async (
    owner: string,
    repo: string,
    path: string,
    params: import('@markflowy/github-api').CreateOrUpdateFileParams,
  ) => {
    return apiClient.put<{ content: GitHubFileContent; commit: any }>(
      `/github/repos/${owner}/${repo}/contents/${path}`,
      params,
    )
  },

  deleteFile: async (owner: string, repo: string, path: string, params: import('@markflowy/github-api').DeleteFileParams) => {
    const queryParams: Record<string, string> = {
      sha: params.sha,
      message: params.message,
    }
    if (params.branch) {
      queryParams.branch = params.branch
    }
    return apiClient.delete<{ content: any; commit: any }>(
      `/github/repos/${owner}/${repo}/contents/${path}`,
      { params: queryParams },
    )
  },

  createPullRequest: async (
    owner: string,
    repo: string,
    params: CreatePullRequestParams,
  ) => {
    return apiClient.post<GitHubPullRequest>(
      `/github/repos/${owner}/${repo}/pulls`,
      params,
    )
  },
}
