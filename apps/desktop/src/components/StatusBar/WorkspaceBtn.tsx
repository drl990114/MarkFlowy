import { getFileNameFromPath, readDirectory } from '@/helper/filesys'
import { gitRevlistWithCurrentWorkspace } from '@/services/git'
import { checkIsGitRepoBySyncMode, getWorkspace, WorkSpace } from '@/services/workspace'
import { useCommandStore, useEditorStore } from '@/stores'
import { listen } from '@tauri-apps/api/event'
import { Command } from '@tauri-apps/plugin-shell'
import { debounce } from 'lodash'
import { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { Loading, toast, Tooltip } from 'zens'
import { fileTreeHandler } from '../FileTree/FileTree'

const Container = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 6px;
  max-width: 200px;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }
`

const GitStatusBtn = () => {
  const [status, setStatus] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const { folderData } = useEditorStore()

  const rootPath = folderData?.[0]?.path

  const debounceCheckGitStatus = useMemo(
    () =>
      debounce(async () => {
        try {
          const res = await gitRevlistWithCurrentWorkspace()
          if (!res) {
            return setStatus(null)
          }
          const [ahead, behind] = res.stdout.trim().split('\t')
          const noChange = (ahead === '0' && behind === '0') || !ahead || !behind
          if (noChange) {
            return setStatus('No changes')
          }
          setStatus(`${ahead}↓ ${behind}↑`)
        } catch (error) {
          setStatus(null)
        }
      }, 1000),
    [],
  )

  useEffect(() => {
    debounceCheckGitStatus()

    const unsubscribe = listen('file_watcher_event', async () => {
      debounceCheckGitStatus()
    })

    return () => {
      unsubscribe.then((f) => f())
    }
  }, [rootPath])

  const handleGitSync = async () => {
    const rootPath = useEditorStore.getState().getRootPath()
    if (!rootPath) {
      toast.error('No workspace found')
      return
    }

    setSyncing(true)
    try {
      // 1. 先执行 fetch 获取远程仓库的最新状态
      const fetchOutput = await Command.create('run-git-fetch', ['fetch', '--prune'], {
        cwd: useEditorStore.getState().getRootPath(),
      }).execute()
      console.log('Git fetch output:', fetchOutput)

      // 2. 执行 pull 合并远程更改到本地
      const pullOutput = await Command.create('run-git-pull', ['pull', '--ff-only'], {
        cwd: useEditorStore.getState().getRootPath(),
      }).execute()
      console.log('Git pull output:', pullOutput)

      // 检查是否有冲突
      if (pullOutput.stderr) {
        toast.error(`Git pull failed: ${pullOutput.stderr}`)
        return
      }

      await readDirectory(rootPath).then((res) => {
        fileTreeHandler.updateTreeView?.({
          data: res,
        })
      })

      // 3. 执行 push 推送本地更改到远程
      const pushOutput = await Command.create('run-git-push', ['push'], {
        cwd: useEditorStore.getState().getRootPath(),
      }).execute()
      console.log('Git push output:', pushOutput)

      // 4. 更新状态显示
      debounceCheckGitStatus()
      toast.success('Git sync completed')
    } catch (error) {
      toast.error(`Git sync failed: ${error}`)
      console.error('Git sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Tooltip title='fetch & pull & push'>
      <Container onClick={handleGitSync}>
        {status}
        {syncing ? (
          <div style={{ marginLeft: '4px' }}>
            <Loading size={12} />
          </div>
        ) : null}
      </Container>
    </Tooltip>
  )
}

export const WorkspaceBtn = () => {
  const { folderData } = useEditorStore()
  const [workspace, setWorkspace] = useState<WorkSpace | null>(null)

  useEffect(() => {
    getWorkspace().then((workspace) => {
      setWorkspace(workspace)
    })
  }, [folderData])

  return workspace ? (
    <>
      <Container
        onClick={() => {
          useCommandStore.getState().execute('open_workspace_dialog')
        }}
      >
        {getFileNameFromPath(workspace.rootPath || '')}
      </Container>
      {checkIsGitRepoBySyncMode(workspace?.syncMode) ? <GitStatusBtn /> : null}
    </>
  ) : null
}
