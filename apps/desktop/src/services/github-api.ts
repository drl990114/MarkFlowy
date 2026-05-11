import { apiClient } from './api-client'
import type { GitHubTreeItem, GitHubFileContent, GitHubBranch } from './workspaces-api'

export interface GitHubConfig {
  hasToken: boolean
  username?: string
  createdAt?: string
}

export interface SaveGithubConfigParams {
  token: string
}

export interface ListReposParams {
  page?: string
  per_page?: string
  sort?: string
  direction?: string
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  private: boolean
  owner: {
    login: string
    id: number
    avatar_url: string
  }
  description: string | null
  html_url: string
  clone_url: string
  ssh_url: string
  default_branch: string
  created_at: string
  updated_at: string
  pushed_at: string
}

export interface CreateOrUpdateFileParams {
  message: string
  content: string
  sha?: string
  branch?: string
}

export interface DeleteFileParams {
  message: string
  sha: string
  branch?: string
}

export interface CreatePullRequestParams {
  title: string
  head: string
  base: string
  body: string
}

export interface GitHubPullRequest {
  id: number
  number: number
  html_url: string
  title: string
  body: string
  state: string
  created_at: string
  updated_at: string
  head: {
    ref: string
    sha: string
  }
  base: {
    ref: string
    sha: string
  }
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
    params: CreateOrUpdateFileParams,
  ) => {
    return apiClient.put<{ content: GitHubFileContent; commit: any }>(
      `/github/repos/${owner}/${repo}/contents/${path}`,
      params,
    )
  },

  deleteFile: async (owner: string, repo: string, path: string, params: DeleteFileParams) => {
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
