import { SideBarHeader, TableOfContents } from '@markflowy/interface'
import type { IHeadingData } from '@markflowy/interface'
import { SaveableEditor, type SaveableEditorRef } from 'features/githubWorkspace/components/SaveableEditor'
import {
  githubService,
  type GitHubBranch,
  type GitHubContent,
  type GitHubTreeItem,
} from 'features/githubWorkspace/services/githubService'
import { base64ToUtf8, utf8ToBase64 } from 'features/githubWorkspace/utils/base64'
import { useAuth } from 'hooks/useAuth'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'

interface TreeNode {
  name: string
  path: string
  type: 'blob' | 'tree'
  children?: TreeNode[]
}

function buildTree(items: GitHubTreeItem[]): TreeNode[] {
  const root: TreeNode[] = []
  const map = new Map<string, TreeNode>()

  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  for (const item of sorted) {
    if (item.type !== 'blob' && item.type !== 'tree') continue
    const parts = item.path.split('/')
    const name = parts[parts.length - 1]
    const node: TreeNode = { name, path: item.path, type: item.type }

    if (parts.length === 1) {
      root.push(node)
      map.set(item.path, node)
    } else {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = map.get(parentPath)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
        map.set(item.path, node)
      }
    }
  }

  return root
}

function TreeItem({
  node,
  owner,
  repo,
  branch,
  selectedPath,
  onSelect,
}: {
  node: TreeNode
  owner: string
  repo: string
  branch: string
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const isDir = node.type === 'tree'
  const isSelected = selectedPath === node.path

  if (isDir) {
    return (
      <TreeNodeContainer>
        <TreeLabel $selected={false}>
          <FolderIcon />
          {node.name}
        </TreeLabel>
        {node.children && (
          <Children>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                owner={owner}
                repo={repo}
                branch={branch}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </Children>
        )}
      </TreeNodeContainer>
    )
  }

  return (
    <TreeNodeContainer>
      <TreeLabel $selected={isSelected} onClick={() => onSelect(node.path)}>
        <FileIcon />
        {node.name}
      </TreeLabel>
    </TreeNodeContainer>
  )
}

export default function WorkspaceDetailPage() {
  const { loading: authLoading, isAuthenticated } = useAuth(true)
  const router = useRouter()
  const { owner, repo } = router.query as { owner: string; repo: string }
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [branch, setBranch] = useState('')
  const [tree, setTree] = useState<GitHubTreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileSha, setFileSha] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [commitMessage, setCommitMessage] = useState('Update via MarkFlowy')
  const [headingsData, setHeadingsData] = useState<IHeadingData[]>([])
  const editorRef = useRef<SaveableEditorRef>(null)

  // Extract headings from content
  useEffect(() => {
    if (fileContent) {
      const extractedHeadings = extractHeadings(fileContent)
      setHeadingsData(extractedHeadings)
    }
  }, [fileContent])

  useEffect(() => {
    if (!owner || !repo || !isAuthenticated || authLoading) return

    githubService
      .listBranches(owner, repo)
      .then((b) => {
        setBranches(b)
        const defaultBranch =
          b.find((x) => x.name === 'main') || b.find((x) => x.name === 'master') || b[0]
        if (defaultBranch) {
          setBranch(defaultBranch.name)
        }
      })
      .catch((err: any) => setError(err?.message || 'Failed to load branches'))
  }, [owner, repo, isAuthenticated, authLoading])

  useEffect(() => {
    if (!branch || !owner || !repo || !isAuthenticated || authLoading) return
    setLoading(true)

    githubService
      .getBranch(owner, repo, branch)
      .then((b) => githubService.getTree(owner, repo, b.commit.sha, true))
      .then((t) => {
        setTree(t.tree)
        setLoading(false)
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load tree')
        setLoading(false)
      })
  }, [branch, owner, repo, isAuthenticated, authLoading])

  const handleFileSelect = async (path: string) => {
    setSelectedPath(path)
    setLoadingFile(true)
    setError('')

    try {
      const data = await githubService.getContents(owner, repo, path, branch)
      const file = data as GitHubContent
      if (file.type !== 'file' || !file.content) {
        setError('Not a file or content is empty')
        setLoadingFile(false)
        return
      }
      setFileSha(file.sha)
      setFileContent(base64ToUtf8(file.content.replace(/\s/g, '')))
    } catch (err: any) {
      setError(err?.message || 'Failed to load file')
    } finally {
      setLoadingFile(false)
    }
  }

  const handleSave = async () => {
    if (!editorRef.current || !fileSha || !selectedPath || !branch) return
    const newContent = editorRef.current.getContent()
    if (newContent === undefined) {
      setError('Unable to read editor content')
      return
    }

    setSaving(true)
    setError('')

    try {
      await githubService.createOrUpdateFile(owner, repo, selectedPath, {
        message: commitMessage || 'Update via MarkFlowy',
        content: utf8ToBase64(newContent),
        sha: fileSha,
        branch,
      })
      const updated = await githubService.getContents(owner, repo, selectedPath, branch)
      setFileSha((updated as GitHubContent).sha)
      alert('Saved successfully')
    } catch (err: any) {
      setError(err?.message || 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
      </LoadingContainer>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const treeNodes = useMemo(() => buildTree(tree), [tree])

  return (
    <Container>
      <Toolbar>
        <ToolbarLeft>
          <WorkspaceName>
            {owner} / {repo}
          </WorkspaceName>
          <BranchSelect value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </BranchSelect>
        </ToolbarLeft>
        {selectedPath && (
          <ToolbarRight>
            <FilePath>{selectedPath}</FilePath>
            <CommitInput
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder='Commit message'
            />
            <SaveButton onClick={handleSave} disabled={saving || loadingFile}>
              {saving ? 'Saving...' : 'Save'}
            </SaveButton>
          </ToolbarRight>
        )}
      </Toolbar>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <MainContent>
        <Sidebar>
          <SideBarHeader name='Files' />
          <SidebarContent>
            {loading && <LoadingText>Loading...</LoadingText>}
            {!loading && (
              <TreeContainer>
                {treeNodes.map((node) => (
                  <TreeItem
                    key={node.path}
                    node={node}
                    owner={owner}
                    repo={repo}
                    branch={branch}
                    selectedPath={selectedPath}
                    onSelect={handleFileSelect}
                  />
                ))}
              </TreeContainer>
            )}
          </SidebarContent>
        </Sidebar>

        <EditorPanel>
          {loadingFile && (
            <EditorLoading>
              <LoadingText>Loading file...</LoadingText>
            </EditorLoading>
          )}
          {!loadingFile && !selectedPath && (
            <EditorEmpty>
              <EmptyIcon>📄</EmptyIcon>
              <EmptyText>Select a file to edit</EmptyText>
            </EditorEmpty>
          )}
          {!loadingFile && selectedPath && fileContent !== null && (
            <SaveableEditor
              ref={editorRef}
              initialContent={fileContent}
              viewType='wysiwyg'
            />
          )}
        </EditorPanel>

        <OutlinePanel>
          <SideBarHeader name='Outline' />
          <TocContainer>
            <TableOfContents
              headingsData={headingsData}
              variant='sidebar'
              compact={false}
              pinned
            />
          </TocContainer>
        </OutlinePanel>
      </MainContent>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(12)} ${rem(20)};
  background: ${(props) => props.theme.bgColorSecondary};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  gap: ${rem(16)};
  flex-shrink: 0;
`

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(16)};
`

const WorkspaceName = styled.div`
  font-size: ${rem(16)};
  font-weight: 600;
`

const BranchSelect = styled.select`
  padding: ${rem(6)} ${rem(10)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${rem(13)};
`

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(12)};
`

const FilePath = styled.div`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  max-width: ${rem(200)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CommitInput = styled.input`
  width: ${rem(200)};
  padding: ${rem(6)} ${rem(10)};
  background: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${rem(13)};

  &:focus {
    outline: none;
    border-color: #da936a;
  }
`

const SaveButton = styled.button`
  padding: ${rem(6)} ${rem(14)};
  background: #da936a;
  border: none;
  border-radius: ${rem(6)};
  font-size: ${rem(13)};
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: #c9845b;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ErrorBanner = styled.div`
  padding: ${rem(10)} ${rem(20)};
  background: rgba(220, 38, 38, 0.08);
  border-bottom: 1px solid rgba(220, 38, 38, 0.2);
  font-size: ${rem(13)};
  color: #dc2626;
  flex-shrink: 0;
`

const MainContent = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`

const Sidebar = styled.div`
  width: ${rem(280)};
  display: flex;
  flex-direction: column;
  background: ${(props) => props.theme.bgColorSecondary};
  border-right: 1px solid ${(props) => props.theme.borderColor};
  flex-shrink: 0;
`

const SidebarHeader = styled.div`
  padding: ${rem(12)} ${rem(16)};
  font-size: ${rem(12)};
  font-weight: 600;
  color: ${(props) => props.theme.disabledFontColor};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
`

const SidebarContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${rem(8)};
`

const LoadingText = styled.div`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  text-align: center;
  padding: ${rem(20)} 0;
`

const TreeContainer = styled.div``

const TreeNodeContainer = styled.div`
  margin: ${rem(2)} 0;
`

const TreeLabel = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  padding: ${rem(6)} ${rem(8)};
  font-size: ${rem(13)};
  border-radius: ${rem(4)};
  cursor: pointer;
  background: ${(props) => (props.$selected ? 'rgba(218, 147, 106, 0.1)' : 'transparent')};
  color: ${(props) =>
    props.$selected ? '#da936a' : props.theme.primaryFontColor};
  transition: background 0.15s ease;

  &:hover {
    background: ${(props) =>
      props.$selected ? 'rgba(218, 147, 106, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
  }
`

const Children = styled.div`
  padding-left: ${rem(16)};
`

const FolderIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'></path>
  </svg>
)

const FileIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path>
    <polyline points='14 2 14 8 20 8'></polyline>
  </svg>
)

const EditorPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`

const EditorLoading = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`

const EditorEmpty = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${rem(12)};
`

const EmptyIcon = styled.div`
  font-size: ${rem(48)};
  opacity: 0.5;
`

const EmptyText = styled.div`
  font-size: ${rem(15)};
  color: ${(props) => props.theme.disabledFontColor};
`

const OutlinePanel = styled.div`
  width: ${rem(260)};
  flex-shrink: 0;
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
`

const LoadingSpinner = styled.div`
  width: ${rem(40)};
  height: ${rem(40)};
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #da936a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

// Extract headings from markdown content
function extractHeadings(content: string): IHeadingData[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: IHeadingData[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const depth = match[1].length
    const value = match[2].trim()
    const id = `heading-${headings.length}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

    headings.push({
      depth,
      value,
      id,
      htmlNode: null,
      onClick: (headingItem) => {
        const element = document.getElementById(headingItem.id)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      },
    })
  }

  return headings
}

const TocContainer = styled.div`
  flex: 1;
  overflow: hidden;
`
