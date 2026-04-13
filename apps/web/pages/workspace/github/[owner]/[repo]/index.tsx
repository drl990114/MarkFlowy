import {
    githubService,
    type GitHubBranch,
    type GitHubTreeItem,
} from 'features/githubWorkspace/services/githubService'
import { useAuth } from 'hooks/useAuth'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
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

  // Sort so directories come before files, alphabetically
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

function TreeItem({ node, owner, repo, branch }: { node: TreeNode; owner: string; repo: string; branch: string }) {
  const isDir = node.type === 'tree'
  return (
    <TreeNodeContainer>
      {isDir ? (
        <TreeLabel>
          <FolderIcon />
          {node.name}
        </TreeLabel>
      ) : (
        <TreeLink href={`/workspace/github/${owner}/${repo}/edit?path=${encodeURIComponent(node.path)}&branch=${encodeURIComponent(branch)}`}>
          <FileIcon />
          {node.name}
        </TreeLink>
      )}
      {node.children && (
        <Children>
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} owner={owner} repo={repo} branch={branch} />
          ))}
        </Children>
      )}
    </TreeNodeContainer>
  )
}

export default function GitHubRepoPage() {
  const { loading: authLoading, isAuthenticated } = useAuth(true)
  const router = useRouter()
  const { owner, repo } = router.query as { owner: string; repo: string }
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [branch, setBranch] = useState('')
  const [tree, setTree] = useState<GitHubTreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!owner || !repo || !isAuthenticated || authLoading) return

    githubService
      .listBranches(owner, repo)
      .then((b) => {
        setBranches(b)
        const defaultBranch = b.find((x) => x.name === 'main') || b.find((x) => x.name === 'master') || b[0]
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
      <Header>
        <BackLink href='/workspace/github'>← Repositories</BackLink>
        <Title>
          {owner} / {repo}
        </Title>
        <BranchSelect value={branch} onChange={(e) => setBranch(e.target.value)}>
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </BranchSelect>
      </Header>
      <Content>
        {loading && <Message>Loading file tree...</Message>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {!loading && !error && (
          <TreeContainer>
            {treeNodes.map((node) => (
              <TreeItem key={node.path} node={node} owner={owner} repo={repo} branch={branch} />
            ))}
          </TreeContainer>
        )}
      </Content>
    </Container>
  )
}

const Container = styled.div`
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  padding: ${rem(24)};
`

const Header = styled.div`
  margin-bottom: ${rem(24)};
  display: flex;
  flex-direction: column;
  gap: ${rem(8)};
`

const BackLink = styled(Link)`
  font-size: ${rem(13)};
  color: ${(props) => props.theme.disabledFontColor};
  text-decoration: none;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const Title = styled.h1`
  font-size: ${rem(22)};
  font-weight: 600;
  margin: 0;
`

const BranchSelect = styled.select`
  align-self: flex-start;
  padding: ${rem(6)} ${rem(10)};
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(6)};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${rem(13)};
`

const Content = styled.div`
  max-width: ${rem(720)};
`

const Message = styled.div`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
`

const ErrorMessage = styled.div`
  font-size: ${rem(14)};
  color: #dc2626;
`

const TreeContainer = styled.div`
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  padding: ${rem(12)} ${rem(16)};
`

const TreeNodeContainer = styled.div`
  margin: ${rem(4)} 0;
`

const TreeLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  font-size: ${rem(14)};
  font-weight: 500;
  padding: ${rem(4)} 0;
`

const TreeLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
  font-size: ${rem(14)};
  padding: ${rem(4)} 0;
  color: ${(props) => props.theme.primaryFontColor};
  text-decoration: none;

  &:hover {
    color: #da936a;
  }
`

const Children = styled.div`
  padding-left: ${rem(20)};
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
