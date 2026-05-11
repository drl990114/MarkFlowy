import type { IFile } from '@markflowy/interface'
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
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
  url: string
}

export interface GitHubTree {
  sha: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

export interface GitHubFileInfo {
  owner: string
  repo: string
  branch: string
  path: string
  sha: string
}

export const githubService = {
  listRepos(page = 1, perPage = 30) {
    return apiClient.get<GitHubRepo[]>(
      `/github/repos?page=${page}&per_page=${perPage}`,
    )
  },

  listBranches(owner: string, repo: string) {
    return apiClient.post<GitHubBranch[]>(`/github/branches`, { owner, repo })
  },

  getBranch(owner: string, repo: string, branch: string) {
    return apiClient.post<GitHubBranch>(`/github/branch`, { owner, repo, branch })
  },

  getContents(owner: string, repo: string, path: string, ref?: string) {
    return apiClient.post<GitHubContent | GitHubContent[]>(
      `/github/contents`,
      {
        owner,
        repo,
        path: path || undefined,
        ref: ref || undefined,
      },
    )
  },

  getTree(owner: string, repo: string, sha: string, recursive = true) {
    return apiClient.post<GitHubTree>(`/github/tree`, {
      owner,
      repo,
      sha,
      recursive,
    })
  },

  createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    data: { message: string; content: string; sha?: string; branch?: string },
  ) {
    return apiClient.post<{
      content: GitHubContent
      commit: { sha: string; message: string }
    }>(`/github/file`, {
      owner,
      repo,
      path,
      ...data,
    })
  },

  /**
   * 将GitHub Tree转换为IFile格式，用于FileTree组件
   */
  convertTreeToIFile(treeItems: GitHubTreeItem[], owner: string, repo: string, branch: string, recursive = true): IFile[] {
    const root: IFile[] = []
    const map = new Map<string, IFile>()

    const sorted = [...treeItems].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'tree' ? -1 : 1
      return a.path.localeCompare(b.path)
    })

    for (const item of sorted) {
      if (item.type === 'commit') continue
      if (item.type !== 'blob' && item.type !== 'tree') continue

      const parts = item.path.split('/')
      const name = parts[parts.length - 1]
      const isDir = item.type === 'tree'
      const ext = isDir ? undefined : name.split('.').pop()

      const fileNode: IFile = {
        id: `github-${owner}-${repo}-${item.path}`,
        name,
        kind: isDir ? 'dir' : 'file',
        path: item.path,
        ext,
        children: isDir ? [] : undefined,
      }

      if (!recursive) {
        if (parts.length === 1) {
          root.push(fileNode)
        }
      } else {
        if (parts.length === 1) {
          root.push(fileNode)
          map.set(item.path, fileNode)
        } else {
          const parentPath = parts.slice(0, -1).join('/')
          const parent = map.get(parentPath)
          if (parent) {
            parent.children = parent.children || []
            parent.children.push(fileNode)
            map.set(item.path, fileNode)
          }
        }
      }
    }

    return root
  },

  /**
   * 获取默认分支
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const branches = await this.listBranches(owner, repo)
    const defaultBranch = branches.find((b) => b.name === 'main')
      || branches.find((b) => b.name === 'master')
      || branches[0]
    return defaultBranch?.name || 'main'
  },

  /**
   * 加载完整的仓库文件树
   */
  async loadRepoTree(owner: string, repo: string, branch?: string, recursive = true): Promise<IFile[]> {
    const targetBranch = branch || await this.getDefaultBranch(owner, repo)
    const branchInfo = await this.getBranch(owner, repo, targetBranch)
    const tree = await this.getTree(owner, repo, branchInfo.commit.sha, recursive)
    return this.convertTreeToIFile(tree.tree, owner, repo, targetBranch, recursive)
  },

  /**
   * 加载子目录内容（用于懒加载）
   */
  async loadSubdirectory(owner: string, repo: string, path: string, branch?: string): Promise<IFile[]> {
    const targetBranch = branch || await this.getDefaultBranch(owner, repo)
    const contents = await this.getContents(owner, repo, path, targetBranch)
    
    if (!Array.isArray(contents)) {
      return []
    }

    return contents.map((item) => {
      const isDir = item.type === 'dir'
      return {
        id: `github-${owner}-${repo}-${item.path}`,
        name: item.name,
        kind: isDir ? 'dir' : 'file',
        path: item.path,
        ext: isDir ? undefined : item.name.split('.').pop(),
        children: isDir ? [] : undefined,
      }
    })
  },

  /**
   * 加载文件内容
   */
  async loadFileContent(owner: string, repo: string, path: string, branch?: string): Promise<{ content: string; sha: string }> {
    const targetBranch = branch || await this.getDefaultBranch(owner, repo)
    const data = await this.getContents(owner, repo, path, targetBranch)

    if (Array.isArray(data)) {
      throw new Error(`"${path}" is a directory, not a file. Please select a file to open.`)
    }

    if (data.type !== 'file' || !data.content) {
      throw new Error(`"${path}" is not a valid file or content is empty.`)
    }

    const base64 = data.content.replace(/\s/g, '')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const content = new TextDecoder('utf-8').decode(bytes)
    return { content, sha: data.sha }
  },
}
