import type { IFile } from '@markflowy/interface'
import {
  type RemoteWorkspaceDescriptor,
  type RemoteWorkspaceRef,
  type WorkspaceCapabilities,
  remoteWorkspaceService,
} from 'features/workspace/services/remoteWorkspaceService'
import {
  type WorkspaceMetadata,
  workspaceService,
} from 'features/workspace/services/workspaceService'
import { loadDemoWorkspaceFile, saveDemoWorkspaceFile } from './demoWorkspaceStorage'

interface WorkspaceAdapterBase {
  type: 'local' | 'remote'
  title: string
  provider: string
  requiresAuth: boolean
  capabilities: WorkspaceCapabilities
  loadTree: (ref?: string | null) => Promise<IFile[]>
  loadFileContent: (
    file: IFile,
    ref?: string | null,
  ) => Promise<{ content: string; version?: string }>
  saveFileContent?: (
    file: IFile,
    content: string,
    options?: { message?: string; version?: string; ref?: string | null },
  ) => Promise<{ version?: string }>
  saveFiles?: (
    files: { file: IFile; content: string; version?: string }[],
    options?: { message?: string; ref?: string | null },
  ) => Promise<{
    files: { path: string; version?: string }[]
    commitVersion?: string
  }>
  loadSubdirectory?: (path: string, ref?: string | null) => Promise<IFile[]>
}

export interface LocalWorkspaceAdapter extends WorkspaceAdapterBase {
  type: 'local'
}

export interface RemoteWorkspaceAdapter extends WorkspaceAdapterBase {
  type: 'remote'
  workspaceId: string
  descriptor: RemoteWorkspaceDescriptor
  defaultRef: string | null
  getRefs: () => Promise<RemoteWorkspaceRef[]>
}

export type WorkspaceAdapter = LocalWorkspaceAdapter | RemoteWorkspaceAdapter

export interface LocalWorkspaceBackend {
  title: string
  provider?: string
  requiresAuth?: boolean
  capabilities: WorkspaceCapabilities
  loadTree: () => Promise<IFile[]>
  loadFileContent: (file: IFile) => Promise<{ content: string; version?: string }>
  saveFileContent?: WorkspaceAdapterBase['saveFileContent']
  saveFiles?: WorkspaceAdapterBase['saveFiles']
  loadSubdirectory?: (path: string) => Promise<IFile[]>
}

export interface WorkspaceAdapterFactoryOptions {
  resolveLocalBackend?: (
    workspace: WorkspaceMetadata,
  ) => LocalWorkspaceBackend | null | Promise<LocalWorkspaceBackend | null>
}

const DEMO_FILE_ID = 'demo-file'

const demoFolderData: IFile[] = [
  {
    id: DEMO_FILE_ID,
    name: 'demo.md',
    kind: 'file',
    path: '/demo.md',
    ext: 'md',
  },
]

const defaultContents: Record<string, string> = {
  [DEMO_FILE_ID]: `# MarkFlowy Demo

Edit this file and click Save.

Your changes stay in this browser's IndexedDB after refresh.
`,
}

export function getDefaultContent(fileId: string): string {
  return defaultContents[fileId] || '# New File\n\nStart writing here...'
}

const demoLocalWorkspaceBackend: LocalWorkspaceBackend = {
  title: 'Demo Workspace',
  provider: 'local',
  requiresAuth: false,
  capabilities: {
    refs: false,
    write: true,
    delete: false,
  },
  async loadTree() {
    return demoFolderData
  },
  async loadFileContent(file: IFile) {
    const storedFile = await loadDemoWorkspaceFile(file.id)
    return storedFile
      ? { content: storedFile.content, version: storedFile.version }
      : { content: getDefaultContent(file.id) }
  },
  async saveFileContent(file, content) {
    if (file.id !== DEMO_FILE_ID) {
      throw new Error(`Unknown demo workspace file: ${file.id}`)
    }

    return { version: await saveDemoWorkspaceFile(file.id, content) }
  },
}

export function createLocalAdapter(backend: LocalWorkspaceBackend): LocalWorkspaceAdapter {
  const adapter: LocalWorkspaceAdapter = {
    type: 'local',
    title: backend.title,
    provider: backend.provider || 'local',
    requiresAuth: backend.requiresAuth ?? false,
    capabilities: backend.capabilities,
    loadTree() {
      return backend.loadTree()
    },
    loadFileContent(file) {
      return backend.loadFileContent(file)
    },
  }

  const loadSubdirectory = backend.loadSubdirectory
  if (loadSubdirectory) {
    adapter.loadSubdirectory = (path) => loadSubdirectory(path)
  }

  const saveFileContent = backend.saveFileContent
  if (backend.capabilities.write && saveFileContent) {
    adapter.saveFileContent = (file, content, options) => saveFileContent(file, content, options)
  }

  const saveFiles = backend.saveFiles
  if (backend.capabilities.write && saveFiles) {
    adapter.saveFiles = (files, options) => saveFiles(files, options)
  } else if (backend.capabilities.write && saveFileContent) {
    adapter.saveFiles = async (files, options) => {
      const savedFiles = []

      for (const file of files) {
        const result = await saveFileContent(file.file, file.content, {
          message: options?.message,
          version: file.version,
          ref: options?.ref,
        })
        savedFiles.push({
          path: file.file.path || file.file.id,
          version: result.version,
        })
      }

      return { files: savedFiles }
    }
  }

  return adapter
}

export function createRemoteAdapter(
  workspaceId: string,
  descriptor: RemoteWorkspaceDescriptor,
): RemoteWorkspaceAdapter {
  const title = descriptor.label || descriptor.name
  const adapter: RemoteWorkspaceAdapter = {
    type: 'remote',
    workspaceId,
    descriptor,
    defaultRef: descriptor.defaultRef,
    title,
    provider: descriptor.provider,
    requiresAuth: true,
    capabilities: descriptor.capabilities,
    async loadTree(ref = descriptor.defaultRef) {
      const files = await remoteWorkspaceService.loadTree(workspaceId, ref)
      return [
        {
          id: `remote-workspace-${workspaceId}-root`,
          name: title,
          kind: 'dir',
          path: '',
          children: files,
        },
      ]
    },
    async loadFileContent(file: IFile, ref = descriptor.defaultRef) {
      if (!file.path) throw new Error('File path is required')
      return remoteWorkspaceService.loadFileContent(workspaceId, file.path, ref)
    },
    getRefs() {
      return remoteWorkspaceService.getRefs(workspaceId)
    },
    async loadSubdirectory(path: string, ref = descriptor.defaultRef) {
      return remoteWorkspaceService.loadSubdirectory(workspaceId, path, ref)
    },
  }

  if (descriptor.capabilities.write) {
    adapter.saveFileContent = async (file, content, options) => {
      if (!file.path) throw new Error('File path is required')
      return remoteWorkspaceService.saveFileContent(workspaceId, file.path, {
        message: options?.message || 'Update via MarkFlowy',
        content,
        version: options?.version,
        ref: options?.ref ?? descriptor.defaultRef,
      })
    }

    adapter.saveFiles = async (files, options) => {
      return remoteWorkspaceService.saveFileContents(workspaceId, {
        message: options?.message || 'Update via MarkFlowy',
        files: files.map(({ file, content, version }) => {
          if (!file.path) throw new Error('File path is required')

          return {
            path: file.path,
            content,
            version,
          }
        }),
        ref: options?.ref ?? descriptor.defaultRef,
      })
    }
  }

  return adapter
}

export async function createRemoteWorkspaceAdapter(
  workspaceId: string,
): Promise<RemoteWorkspaceAdapter> {
  const descriptor = await remoteWorkspaceService.getDescriptor(workspaceId)
  return createRemoteAdapter(workspaceId, descriptor)
}

const isLocalWorkspaceId = (id: string) => id === 'demo-workspace'

export function workspaceRequiresAuthentication(id: string) {
  return !isLocalWorkspaceId(id)
}

async function createRegisteredWorkspaceAdapter(
  workspace: WorkspaceMetadata,
  options: WorkspaceAdapterFactoryOptions,
): Promise<WorkspaceAdapter> {
  if (workspace.type === 'LOCAL') {
    const backend = await options.resolveLocalBackend?.(workspace)
    if (backend) {
      return createLocalAdapter(backend)
    }

    throw new Error(
      `Local workspace "${workspace.name}" is not bound to a browser local-file backend yet.`,
    )
  }

  return createRemoteWorkspaceAdapter(workspace.id)
}

export async function createWorkspaceAdapter(
  id: string,
  options: WorkspaceAdapterFactoryOptions = {},
): Promise<WorkspaceAdapter> {
  if (isLocalWorkspaceId(id)) {
    return createLocalAdapter(demoLocalWorkspaceBackend)
  }

  const workspace = await workspaceService.getMetadata(id)
  return createRegisteredWorkspaceAdapter(workspace, options)
}
