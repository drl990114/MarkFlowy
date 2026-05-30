export interface GitHubTreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
  url: string
}

export interface GitHubFileContent {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  content?: string
  encoding?: string
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
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
