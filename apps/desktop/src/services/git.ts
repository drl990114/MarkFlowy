import { getRelativePathWithCurWorkspace, IFile } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import { ChildProcess, Command } from '@tauri-apps/plugin-shell'

const wrapGitCommand = async (commandPromise: Promise<ChildProcess<any>>, errorMessage: string) => {
  try {
    const res = await commandPromise
    if (res.stderr) {
      throw new Error(`${errorMessage}: ${res.stderr}`)
    }
    return res
  } catch (error) {
    throw new Error(`${errorMessage}: ${error}`)
  }
}

export const gitAddFileWithCurrentWorkspace = async (file: IFile) => {
  const rootPath = useEditorStore.getState().getRootPath()
  if (!rootPath) {
    console.error('No root path available')
    return
  }

  if (file.path === undefined) {
    console.error('File path is undefined')
    return
  }

  const relativePath = getRelativePathWithCurWorkspace(file.path)

  return await wrapGitCommand(
    Command.create('run-git-add', ['add', relativePath], {
      cwd: rootPath,
    }).execute(),
    'Failed to add file to git',
  )
}

export const gitCommitWithCurrentWorkspace = async (message: string) => {
  const rootPath = useEditorStore.getState().getRootPath()
  if (!rootPath) {
    console.error('No root path available')
    return
  }
  return await wrapGitCommand(
    Command.create('run-git-commit', ['commit', '-m', message], {
      cwd: rootPath,
    }).execute(),
    'Failed to commit changes',
  )
}

export const gitPushWithCurrentWorkspace = async () => {
  const rootPath = useEditorStore.getState().getRootPath()
  if (!rootPath) {
    console.error('No root path available')
    return
  }

  return await wrapGitCommand(
    Command.create('run-git-push', ['push'], {
      cwd: rootPath,
    }).execute(),
    'Failed to push changes',
  )
}
