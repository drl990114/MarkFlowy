import type { IFile } from '@markflowy/interface'
import { apiClient, ApiClientError } from 'utils/apiClient'

export interface WorkspaceCapabilities {
  refs: boolean
  write: boolean
  delete: boolean
}

export interface RemoteWorkspaceDescriptor {
  id: string
  name: string
  type: string
  provider: string
  label: string
  defaultRef: string | null
  capabilities: WorkspaceCapabilities
  providerMetadata?: Record<string, unknown>
}

export interface RemoteWorkspaceRef {
  name: string
  version?: string
}

export interface RemoteWorkspaceEntry {
  path: string
  name: string
  kind: 'file' | 'directory'
  version?: string
  size?: number
}

export interface RemoteWorkspaceTree {
  version?: string
  ref?: string
  truncated: boolean
  entries: RemoteWorkspaceEntry[]
}

export interface RemoteWorkspaceDirectoryContent {
  kind: 'directory'
  path: string
  entries: RemoteWorkspaceEntry[]
}

export interface RemoteWorkspaceFileContent {
  kind: 'file'
  path: string
  name: string
  content: string
  encoding: 'utf-8' | 'base64'
  version?: string
  size?: number
  ref?: string
}

export type RemoteWorkspaceContent = RemoteWorkspaceDirectoryContent | RemoteWorkspaceFileContent

export interface RemoteWorkspaceSaveResult {
  path: string
  version?: string
  ref?: string
  commitVersion?: string
}

const toWorkspacePath = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}`

const toRemoteWorkspacePath = (workspaceId: string) => `${toWorkspacePath(workspaceId)}/remote`

const toFileId = (workspaceId: string, path: string) =>
  `remote-workspace-${workspaceId}-${path || 'root'}`

const convertEntriesToIFile = (entries: RemoteWorkspaceEntry[], workspaceId: string): IFile[] => {
  const sortedEntries = [...entries].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
    return left.path.localeCompare(right.path)
  })

  return sortedEntries.map((entry) => {
    const isDirectory = entry.kind === 'directory'

    return {
      id: toFileId(workspaceId, entry.path),
      name: entry.name,
      kind: isDirectory ? 'dir' : 'file',
      path: entry.path,
      ext: isDirectory ? undefined : entry.name.split('.').pop(),
      children: isDirectory ? [] : undefined,
    }
  })
}

export function getRemoteWorkspaceErrorMessage(error: unknown, fallback: string) {
  const status = error instanceof ApiClientError ? error.status : undefined

  if (status === 403) {
    return 'You do not have permission to access or update this remote workspace.'
  }

  if (status === 409) {
    if (error instanceof ApiClientError && error.message.includes('repository identity changed')) {
      return error.message
    }

    return 'This file changed in the remote workspace. Reload it before retrying your save.'
  }

  if (status === 404) {
    return 'The remote workspace, ref, or file could not be found.'
  }

  return error instanceof Error && error.message ? error.message : fallback
}

export const remoteWorkspaceService = {
  getDescriptor(workspaceId: string) {
    return apiClient.get<RemoteWorkspaceDescriptor>(
      `${toRemoteWorkspacePath(workspaceId)}/descriptor`,
    )
  },

  getRefs(workspaceId: string) {
    return apiClient.get<RemoteWorkspaceRef[]>(`${toRemoteWorkspacePath(workspaceId)}/refs`)
  },

  getTree(workspaceId: string, ref?: string | null) {
    const query = new URLSearchParams()
    if (ref) query.set('ref', ref)
    query.set('recursive', '0')

    return apiClient.get<RemoteWorkspaceTree>(
      `${toRemoteWorkspacePath(workspaceId)}/tree?${query.toString()}`,
    )
  },

  getContents(workspaceId: string, path: string, ref?: string | null) {
    return apiClient.post<RemoteWorkspaceContent>(
      `${toRemoteWorkspacePath(workspaceId)}/contents`,
      {
        path,
        ...(ref ? { ref } : {}),
      },
    )
  },

  saveFileContent(
    workspaceId: string,
    path: string,
    data: { message: string; content: string; version?: string; ref?: string | null },
  ) {
    const { ref, ...content } = data

    return apiClient.put<RemoteWorkspaceSaveResult>(
      `${toRemoteWorkspacePath(workspaceId)}/contents`,
      {
        path,
        ...content,
        ...(ref ? { ref } : {}),
      },
    )
  },

  async loadTree(workspaceId: string, ref?: string | null): Promise<IFile[]> {
    const tree = await this.getTree(workspaceId, ref)
    return convertEntriesToIFile(tree.entries, workspaceId)
  },

  async loadSubdirectory(workspaceId: string, path: string, ref?: string | null): Promise<IFile[]> {
    const contents = await this.getContents(workspaceId, path, ref)

    if (contents.kind !== 'directory') {
      throw new Error(`"${path}" is a file, not a directory.`)
    }

    return convertEntriesToIFile(contents.entries, workspaceId)
  },

  async loadFileContent(workspaceId: string, path: string, ref?: string | null) {
    const contents = await this.getContents(workspaceId, path, ref)

    if (contents.kind !== 'file') {
      throw new Error(`"${path}" is a directory, not a file. Please select a file to open.`)
    }

    if (contents.encoding !== 'utf-8') {
      throw new Error('This file is not UTF-8 text and cannot be edited in the workspace.')
    }

    return {
      content: contents.content,
      version: contents.version,
    }
  },
}
