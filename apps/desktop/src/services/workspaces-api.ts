import { apiClient } from './api-client'
import type {
  GitHubTreeItem,
  GitHubFileContent,
  GitHubBranch,
  CreateOrUpdateFileParams,
  DeleteFileParams,
} from '@markflowy/github-api'

export type { GitHubTreeItem, GitHubFileContent, GitHubBranch, CreateOrUpdateFileParams, DeleteFileParams } from '@markflowy/github-api'

export enum WorkspaceType {
  LOCAL = 'LOCAL',
  SYNCED = 'SYNCED',
  SHARED = 'SHARED',
  GITHUB = 'GITHUB',
}

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  createdAt: string
}

export interface WorkspaceSettings {
  workspaceId: string
  version: number
  settingsJson: Record<string, any>
  updatedAt: string
}

export interface Workspace {
  id: string
  ownerId: string
  name: string
  slug: string
  type: WorkspaceType
  folderFingerprint: string | null
  sourceUrl: string | null
  lastAccessedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  members?: WorkspaceMember[]
  settings?: WorkspaceSettings
}

export interface CreateWorkspaceParams {
  name: string
  slug?: string
  type?: WorkspaceType
  folderFingerprint?: string
  sourceUrl?: string
}

export interface UpdateWorkspaceParams {
  name?: string
  slug?: string
  type?: WorkspaceType
  folderFingerprint?: string
  sourceUrl?: string
  lastAccessedAt?: Date
}

export interface UpsertWorkspaceMemberParams {
  userId: string
  role: WorkspaceRole
}

export interface GetContentsParams {
  ref?: string
}

export const workspacesApi = {
  create: async (params: CreateWorkspaceParams) => {
    return apiClient.post<Workspace>('/workspaces', params)
  },

  list: async () => {
    return apiClient.get<Workspace[]>('/workspaces')
  },

  get: async (id: string) => {
    return apiClient.get<Workspace>(`/workspaces/${id}`)
  },

  update: async (id: string, params: UpdateWorkspaceParams) => {
    return apiClient.patch<Workspace>(`/workspaces/${id}`, params)
  },

  remove: async (id: string) => {
    return apiClient.delete<Workspace>(`/workspaces/${id}`)
  },

  upsertMember: async (workspaceId: string, params: UpsertWorkspaceMemberParams) => {
    return apiClient.post<WorkspaceMember>(`/workspaces/${workspaceId}/members`, params)
  },

  removeMember: async (workspaceId: string, userId: string) => {
    return apiClient.delete<{ success: boolean }>(`/workspaces/${workspaceId}/members/${userId}`)
  },

  recordAccess: async (id: string) => {
    return apiClient.post<{ success: boolean }>(`/workspaces/${id}/access`)
  },

  getTree: async (id: string, sha?: string, recursive = true) => {
    return apiClient.get<{ tree: GitHubTreeItem[] }>(`/workspaces/${id}/tree`, {
      params: { sha, recursive: recursive ? '1' : '0' },
    })
  },

  listBranches: async (id: string) => {
    return apiClient.get<GitHubBranch[]>(`/workspaces/${id}/branches`)
  },

  getBranch: async (id: string, branch: string) => {
    return apiClient.get<GitHubBranch>(`/workspaces/${id}/branches/${branch}`)
  },

  getContents: async (id: string, path: string, params?: GetContentsParams) => {
    return apiClient.post<GitHubFileContent | GitHubFileContent[]>(
      `/workspaces/${id}/contents`,
      {
        path: path || undefined,
        ref: params?.ref || undefined,
      },
    )
  },

  createOrUpdateFile: async (id: string, path: string, params: CreateOrUpdateFileParams) => {
    return apiClient.put<{ content: GitHubFileContent; commit: any }>(
      `/workspaces/${id}/contents/${path}`,
      params,
    )
  },

  deleteFile: async (id: string, path: string, params: DeleteFileParams) => {
    const queryParams: Record<string, string> = {
      sha: params.sha,
      message: params.message,
    }
    if (params.branch) {
      queryParams.branch = params.branch
    }
    return apiClient.delete<{ content: any; commit: any }>(
      `/workspaces/${id}/contents/${path}`,
      { params: queryParams },
    )
  },
}
