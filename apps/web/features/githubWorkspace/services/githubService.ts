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

export interface GitHubBranch {
  name: string
  commit: { sha: string; url: string }
}

export interface GitHubContent {
  type: 'file' | 'dir'
  name: string
  path: string
  sha: string
  size: number
  content?: string
  encoding?: 'base64'
  html_url?: string
}

export interface GitHubTreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
  url: string
}

export interface GitHubTree {
  sha: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

export const githubService = {
  listRepos(page = 1, perPage = 30) {
    return apiClient.get<GitHubRepo[]>(
      `/github/repos?page=${page}&per_page=${perPage}`,
    )
  },

  listBranches(owner: string, repo: string) {
    return apiClient.get<GitHubBranch[]>(`/github/repos/${owner}/${repo}/branches`)
  },

  getBranch(owner: string, repo: string, branch: string) {
    return apiClient.get<GitHubBranch>(`/github/repos/${owner}/${repo}/branches/${branch}`)
  },

  getContents(owner: string, repo: string, path: string, ref?: string) {
    const qs = ref ? `?ref=${encodeURIComponent(ref)}` : ''
    const encodedPath = path ? `/${encodeURIComponent(path).replace(/%2F/g, '/')}` : ''
    return apiClient.get<GitHubContent | GitHubContent[]>(
      `/github/repos/${owner}/${repo}/contents${encodedPath}${qs}`,
    )
  },

  getTree(owner: string, repo: string, sha: string, recursive = true) {
    return apiClient.get<GitHubTree>(
      `/github/repos/${owner}/${repo}/git/trees/${sha}?recursive=${recursive ? 1 : 0}`,
    )
  },

  createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    data: { message: string; content: string; sha?: string; branch?: string },
  ) {
    const encodedPath = path ? `/${encodeURIComponent(path).replace(/%2F/g, '/')}` : ''
    return apiClient.put<{
      content: GitHubContent
      commit: { sha: string; message: string }
    }>(`/github/repos/${owner}/${repo}/contents${encodedPath}`, data)
  },
}
