import type { IFile } from '@markflowy/interface'
import {
  type GitHubWorkspaceMetadata,
  workspaceGitHubService,
} from 'features/githubWorkspace/services/workspaceGitHubService'
import { apiClient } from '../utils/apiClient'

export interface WorkspaceAdapter {
  type: string
  title: string
  requiresAuth?: boolean
  loadTree: () => Promise<IFile[]>
  loadTreeWithBranches?: () => Promise<{ files: IFile[]; branches: string[]; branch: string }>
  loadFileContent: (file: IFile) => Promise<{ content: string; sha?: string }>
  saveFileContent?: (file: IFile, content: string, options?: Record<string, any>) => Promise<any>
  getBranches?: () => Promise<string[]>
  setBranch?: (branch: string) => void
  getCurrentBranch?: () => string
  loadSubdirectory?: (path: string) => Promise<IFile[]>
}

export interface LocalWorkspaceAdapter extends WorkspaceAdapter {
  type: 'local'
}

export interface GitHubWorkspaceAdapter extends WorkspaceAdapter {
  type: 'github'
  workspaceId: string
  defaultBranch: string
}

const mockFolderData: IFile[] = [
  {
    id: 'workspace-root',
    name: 'Workspace',
    kind: 'dir',
    path: '/workspace',
    children: [
      {
        id: 'file-readme',
        name: 'README.md',
        kind: 'file',
        path: '/workspace/README.md',
        ext: 'md',
      },
      {
        id: 'folder-docs',
        name: 'docs',
        kind: 'dir',
        path: '/workspace/docs',
        children: [
          {
            id: 'file-intro',
            name: 'intro.md',
            kind: 'file',
            path: '/workspace/docs/intro.md',
            ext: 'md',
          },
          {
            id: 'file-guide',
            name: 'guide.md',
            kind: 'file',
            path: '/workspace/docs/guide.md',
            ext: 'md',
          },
        ],
      },
      {
        id: 'folder-src',
        name: 'src',
        kind: 'dir',
        path: '/workspace/src',
        children: [],
      },
    ],
  },
]

const defaultContents: Record<string, string> = {
  'file-readme': `# Welcome to Workspace

This is a **workspace** for managing your markdown files.

## Features

- 📁 File tree with lazy loading
- 📝 Full markdown editor
- 📑 Outline navigation
- 🎨 Resizable panels

## Getting Started

1. Select a file from the file tree on the left
2. Edit the content in the editor
3. Use the outline panel on the right to navigate

## File Structure

\`\`\`
workspace/
├── README.md
├── docs/
│   ├── intro.md
│   └── guide.md
└── src/
\`\`\`

---

*Happy writing! ✍️*
`,
  'file-intro': `# Introduction

Welcome to the introduction file.

## Overview

This is an overview section.

## Details

More details here...
`,
  'file-guide': `# Guide

This is a guide file.

## Step 1

First step...

## Step 2

Second step...
`,
}

export function getDefaultContent(fileId: string): string {
  return defaultContents[fileId] || '# New File\n\nStart writing here...'
}

export function createLocalAdapter(): WorkspaceAdapter {
  return {
    type: 'local',
    title: 'Demo Workspace',
    requiresAuth: false,
    async loadTree() {
      return mockFolderData
    },
    async loadFileContent(file: IFile) {
      return { content: getDefaultContent(file.id) }
    },
  }
}

export function createGitHubAdapter(
  workspaceId: string,
  metadata: GitHubWorkspaceMetadata,
): GitHubWorkspaceAdapter {
  let currentBranch = metadata.defaultBranch
  const title = `${metadata.owner} / ${metadata.repo}`
  const loadTreeWithBranches = async () => {
    const { branches, files } = await workspaceGitHubService.loadTreeWithBranches(
      workspaceId,
      currentBranch,
      currentBranch === metadata.defaultBranch,
    )

    const branchNames = branches.map((branch) => branch.name)
    if (!branchNames.includes(currentBranch)) {
      branchNames.push(currentBranch)
    }

    return {
      branches: branchNames,
      branch: currentBranch,
      files: [
        {
          id: `github-workspace-${workspaceId}-root`,
          name: title,
          kind: 'dir' as const,
          path: '',
          children: files,
        },
      ],
    }
  }

  return {
    type: 'github',
    workspaceId,
    defaultBranch: metadata.defaultBranch,
    title,
    requiresAuth: true,
    loadTreeWithBranches,
    async loadTree() {
      const { files } = await loadTreeWithBranches()
      return files
    },
    async loadFileContent(file: IFile) {
      if (!file.path) throw new Error('File path is required')
      return workspaceGitHubService.loadFileContent(workspaceId, file.path, currentBranch)
    },
    async saveFileContent(
      file: IFile,
      content: string,
      options?: { message?: string; sha?: string },
    ) {
      if (!file.path) throw new Error('File path is required')
      return workspaceGitHubService.createOrUpdateFile(workspaceId, file.path, {
        message: options?.message || 'Update via MarkFlowy',
        content,
        sha: options?.sha,
        branch: currentBranch,
      })
    },
    async getBranches() {
      const branches = await workspaceGitHubService.getBranches(workspaceId)
      return branches.map((b) => b.name)
    },
    setBranch(branch: string) {
      currentBranch = branch
    },
    getCurrentBranch() {
      return currentBranch
    },
    async loadSubdirectory(path: string) {
      return workspaceGitHubService.loadSubdirectory(workspaceId, path, currentBranch)
    },
  }
}

export async function createServerWorkspaceAdapter(workspaceId: string): Promise<WorkspaceAdapter> {
  const workspace = await apiClient.get<{
    id: string
    name: string
    slug: string
    type: 'LOCAL' | 'SYNCED' | 'SHARED' | 'GITHUB'
    sourceUrl: string | null
  }>(`/workspaces/${workspaceId}`)

  if (workspace.type === 'GITHUB') {
    const metadata = await workspaceGitHubService.getMetadata(workspaceId)
    return createGitHubAdapter(workspaceId, metadata)
  }

  throw new Error(`Workspace type "${workspace.type}" is not available in the web editor yet.`)
}

export function createAdapterFromId(id: string): WorkspaceAdapter {
  if (id === 'demo-workspace') {
    return createLocalAdapter()
  }

  throw new Error('Workspace must be opened from the workspace list.')
}
