import type { IFile } from '@markflowy/interface'
import { apiClient, ApiClientError } from 'utils/apiClient'
import type {
  GitHubBranch,
  GitHubContent,
  GitHubRepo,
  GitHubTree,
  GitHubTreeItem,
} from './githubService'

export type { GitHubRepo }

export interface GitHubWorkspaceMetadata {
  owner: string
  repo: string
  defaultBranch: string
}

export interface ImportedGitHubWorkspace {
  id: string
  name: string
  type: 'GITHUB'
  sourceUrl?: string | null
}

export interface GitHubFileSaveResult {
  content: GitHubContent
  commit: { sha: string; message: string }
}

const toWorkspacePath = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}`

const encodeContentPath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

const toFileId = (workspaceId: string, path: string) =>
  `github-workspace-${workspaceId}-${path || 'root'}`

const decodeBase64Utf8 = (base64: string) => {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  if (bytes.includes(0)) {
    throw new Error('This file appears to be binary and cannot be edited in the workspace.')
  }

  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

const convertTreeToIFile = (
  treeItems: GitHubTreeItem[],
  workspaceId: string,
  recursive = true,
): IFile[] => {
  const root: IFile[] = []
  const map = new Map<string, IFile>()
  const sorted = [...treeItems].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'tree' ? -1 : 1
    return left.path.localeCompare(right.path)
  })

  for (const item of sorted) {
    if (item.type === 'commit' || (item.type !== 'blob' && item.type !== 'tree')) continue

    const parts = item.path.split('/')
    const isDir = item.type === 'tree'
    const file: IFile = {
      id: toFileId(workspaceId, item.path),
      name: parts[parts.length - 1],
      kind: isDir ? 'dir' : 'file',
      path: item.path,
      ext: isDir ? undefined : parts[parts.length - 1].split('.').pop(),
      children: isDir ? [] : undefined,
    }

    if (!recursive) {
      if (parts.length === 1) root.push(file)
      continue
    }

    if (parts.length === 1) {
      root.push(file)
      map.set(item.path, file)
      continue
    }

    const parent = map.get(parts.slice(0, -1).join('/'))
    if (!parent) continue

    parent.children = parent.children || []
    parent.children.push(file)
    map.set(item.path, file)
  }

  return root
}

const convertContentsToIFile = (contents: GitHubContent[], workspaceId: string): IFile[] =>
  contents.map((item) => {
    const isDir = item.type === 'dir'

    return {
      id: toFileId(workspaceId, item.path),
      name: item.name,
      kind: isDir ? 'dir' : 'file',
      path: item.path,
      ext: isDir ? undefined : item.name.split('.').pop(),
      children: isDir ? [] : undefined,
    }
  })

export function getGitHubWorkspaceErrorMessage(error: unknown, fallback: string) {
  const status = error instanceof ApiClientError ? error.status : undefined

  if (status === 403) {
    return 'You do not have permission to access or update this GitHub workspace.'
  }

  if (status === 409) {
    return 'This file changed on GitHub. Reload it before retrying your save.'
  }

  if (status === 404) {
    return 'The GitHub repository, branch, or workspace could not be found.'
  }

  return error instanceof Error && error.message ? error.message : fallback
}

export const workspaceGitHubService = {
  importRepository(owner: string, repo: string) {
    return apiClient.post<ImportedGitHubWorkspace>('/workspaces/import/github', { owner, repo })
  },

  getMetadata(workspaceId: string) {
    return apiClient.get<GitHubWorkspaceMetadata>(`${toWorkspacePath(workspaceId)}/github`)
  },

  getBranches(workspaceId: string) {
    return apiClient.get<GitHubBranch[]>(`${toWorkspacePath(workspaceId)}/branches`)
  },

  getTree(workspaceId: string, sha?: string, recursive = false) {
    const query = new URLSearchParams()
    if (sha) query.set('sha', sha)
    if (!recursive) query.set('recursive', '0')

    return apiClient.get<GitHubTree>(`${toWorkspacePath(workspaceId)}/tree?${query.toString()}`)
  },

  getContents(workspaceId: string, path: string, ref?: string) {
    return apiClient.post<GitHubContent | GitHubContent[]>(
      `${toWorkspacePath(workspaceId)}/contents`,
      {
        path,
        ...(ref ? { ref } : {}),
      },
    )
  },

  createOrUpdateFile(
    workspaceId: string,
    path: string,
    data: { message: string; content: string; sha?: string; branch?: string },
  ) {
    return apiClient.put<GitHubFileSaveResult>(
      `${toWorkspacePath(workspaceId)}/contents/${encodeContentPath(path)}`,
      data,
    )
  },

  async loadTreeWithBranches(
    workspaceId: string,
    branch: string,
    allowWorkspaceDefaultFallback = false,
  ) {
    const branches = await this.getBranches(workspaceId)
    const branchInfo = branches.find((candidate) => candidate.name === branch)

    if (!branchInfo && !allowWorkspaceDefaultFallback) {
      throw new Error(`Branch "${branch}" was not found in this repository.`)
    }

    const tree = await this.getTree(workspaceId, branchInfo?.commit.sha, false)

    return {
      branches,
      files: convertTreeToIFile(tree.tree, workspaceId, false),
    }
  },

  async loadSubdirectory(workspaceId: string, path: string, branch: string): Promise<IFile[]> {
    const contents = await this.getContents(workspaceId, path, branch)

    return Array.isArray(contents) ? convertContentsToIFile(contents, workspaceId) : []
  },

  async loadFileContent(workspaceId: string, path: string, branch: string) {
    const data = await this.getContents(workspaceId, path, branch)

    if (Array.isArray(data)) {
      throw new Error(`"${path}" is a directory, not a file. Please select a file to open.`)
    }

    if (data.type !== 'file' || !data.content || data.encoding !== 'base64') {
      throw new Error(`"${path}" cannot be opened as an editable text file.`)
    }

    return {
      content: decodeBase64Utf8(data.content),
      sha: data.sha,
    }
  },
}
