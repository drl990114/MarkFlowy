import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  githubService,
  type GitHubContent,
} from 'features/githubWorkspace/services/githubService'
import {
  SaveableEditor,
  type SaveableEditorRef,
} from 'features/githubWorkspace/components/SaveableEditor'
import { base64ToUtf8, utf8ToBase64 } from 'features/githubWorkspace/utils/base64'
import { useAuth } from 'hooks/useAuth'
import rem from 'utils/rem'

export default function GitHubEditPage() {
  const { loading: authLoading, isAuthenticated } = useAuth(true)
  const router = useRouter()
  const { owner, repo } = router.query as { owner: string; repo: string }
  const path = typeof router.query.path === 'string' ? router.query.path : ''
  const branch = typeof router.query.branch === 'string' ? router.query.branch : ''

  const [content, setContent] = useState<string | null>(null)
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [commitMessage, setCommitMessage] = useState('Update via MarkFlowy')
  const editorRef = useRef<SaveableEditorRef>(null)

  useEffect(() => {
    if (!owner || !repo || !path || !isAuthenticated || authLoading) return

    githubService
      .getContents(owner, repo, path, branch)
      .then((data) => {
        const file = data as GitHubContent
        if (file.type !== 'file' || !file.content) {
          setError('Not a file or content is empty')
          setLoading(false)
          return
        }
        setSha(file.sha)
        setContent(base64ToUtf8(file.content.replace(/\s/g, '')))
        setLoading(false)
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load file')
        setLoading(false)
      })
  }, [owner, repo, path, branch, isAuthenticated, authLoading])

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

  const handleSave = async () => {
    if (!editorRef.current || !sha || !path || !branch) return
    const newContent = editorRef.current.getContent()
    if (newContent === undefined) {
      setError('Unable to read editor content')
      return
    }

    setSaving(true)
    setError('')

    try {
      await githubService.createOrUpdateFile(owner, repo, path, {
        message: commitMessage || 'Update via MarkFlowy',
        content: utf8ToBase64(newContent),
        sha,
        branch,
      })
      // refresh sha
      const updated = await githubService.getContents(owner, repo, path, branch)
      setSha((updated as GitHubContent).sha)
      alert('Saved successfully')
    } catch (err: any) {
      setError(err?.message || 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container>
      <Toolbar>
        <BackLink href={`/workspace/github/${owner}/${repo}`}>← {owner}/{repo}</BackLink>
        <FilePath>{path}</FilePath>
        <Actions>
          <CommitInput
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder='Commit message'
          />
          <SaveButton onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save'}
          </SaveButton>
        </Actions>
      </Toolbar>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <EditorWrapper>
        {loading && <Message>Loading file...</Message>}
        {!loading && content !== null && (
          <SaveableEditor ref={editorRef} initialContent={content} viewType='wysiwyg' />
        )}
      </EditorWrapper>
    </Container>
  )
}

const Container = styled.div`
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  display: flex;
  flex-direction: column;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${rem(12)} ${rem(20)};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.bgColorSecondary};
  gap: ${rem(16)};
  flex-wrap: wrap;
`

const BackLink = styled(Link)`
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
  text-decoration: none;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }
`

const FilePath = styled.div`
  font-size: ${rem(14)};
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(8)};
`

const CommitInput = styled.input`
  width: ${rem(240)};
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
`

const EditorWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const Message = styled.div`
  padding: ${rem(24)};
  font-size: ${rem(14)};
  color: ${(props) => props.theme.disabledFontColor};
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
