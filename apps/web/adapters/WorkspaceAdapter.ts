import type { IFile } from '@markflowy/interface'
import { githubService } from 'features/githubWorkspace/services/githubService'
import { apiClient } from '../utils/apiClient'

export interface WorkspaceAdapter {
  type: string
  title: string
  loadTree(): Promise<IFile[]>
  loadFileContent(file: IFile): Promise<{ content: string; sha?: string }>
  saveFileContent?(file: IFile, content: string, options?: Record<string, any>): Promise<any>
  getBranches?(): Promise<string[]>
  setBranch?(branch: string): void
  loadSubdirectory?(path: string): Promise<IFile[]>
}

export interface LocalWorkspaceAdapter extends WorkspaceAdapter {
  type: 'local'
}

export interface GitHubWorkspaceAdapter extends WorkspaceAdapter {
  type: 'github'
  owner: string
  repo: string
  branch: string
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
    async loadTree() {
      return mockFolderData
    },
    async loadFileContent(file: IFile) {
      return { content: getDefaultContent(file.id) }
    },
  }
}

export function createGitHubAdapter(owner: string, repo: string, branch: string = 'main'): WorkspaceAdapter {
  let currentBranch = branch

  return {
    type: 'github',
    title: `${owner} / ${repo}`,
    async loadTree() {
      return githubService.loadRepoTree(owner, repo, currentBranch, false)
    },
    async loadFileContent(file: IFile) {
      if (!file.path) throw new Error('File path is required')
      return githubService.loadFileContent(owner, repo, file.path, currentBranch)
    },
    async saveFileContent(file: IFile, content: string, options?: { message?: string; sha?: string }) {
      if (!file.path) throw new Error('File path is required')
      return githubService.createOrUpdateFile(owner, repo, file.path, {
        message: options?.message || 'Update via MarkFlowy',
        content: btoa(unescape(encodeURIComponent(content))),
        sha: options?.sha,
        branch: currentBranch,
      })
    },
    async getBranches() {
      const branches = await githubService.listBranches(owner, repo)
      return branches.map((b) => b.name)
    },
    setBranch(branch: string) {
      currentBranch = branch
    },
    async loadSubdirectory(path: string) {
      return githubService.loadSubdirectory(owner, repo, path, currentBranch)
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

  if (workspace.type === 'GITHUB' && workspace.sourceUrl) {
    const url = new URL(workspace.sourceUrl)
    const pathParts = url.pathname.replace(/^\//, '').split('/')
    const owner = pathParts[0]
    const repo = pathParts[1]
    if (owner && repo) {
      return createGitHubAdapter(owner, repo)
    }
  }

  return createLocalAdapter()
}

export function createAdapterFromId(id: string): WorkspaceAdapter {
  if (id === 'demo-workspace') {
    return createLocalAdapter()
  }

  if (id.startsWith('github-')) {
    const parts = id.replace('github-', '').split('/')
    if (parts.length >= 2) {
      const owner = parts[0]
      const repo = parts[1]
      return createGitHubAdapter(owner, repo)
    }
  }

  return createLocalAdapter()
}
