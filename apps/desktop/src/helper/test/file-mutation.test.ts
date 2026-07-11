import { describe, expect, it, vi } from 'vitest'
import {
  FILE_MUTATION_QUEUE_KEY,
  SavePathCoordinator,
} from '../../components/EditorArea/savePathCoordinator'
import {
  captureFileMutationTarget,
  getCurrentFileMutationNode,
  getCurrentFileMutationNodes,
} from '../../../../../packages/interface/src/components/FileTree/file-mutation'
import { SimpleTree } from '../../../../../packages/interface/src/components/FileTree/types'
import type { IFile } from '../../../../../packages/interface/src/types/file'

const ROOT: IFile = {
  id: 'root',
  kind: 'dir',
  name: 'workspace',
  path: '/workspace',
  children: [
    {
      id: 'target',
      kind: 'file',
      name: 'target.md',
      path: '/workspace/target.md',
    },
  ],
}

describe('queued explorer mutation validation', () => {
  it.each(['rename', 'delete'])('skips a stale %s after Save As replaces its id', async () => {
    const coordinator = new SavePathCoordinator()
    const folderData = [structuredClone(ROOT)]
    const files = new Map<string, IFile>()
    files.set('root', folderData[0])
    files.set('target', folderData[0].children![0])
    const capturedTarget = captureFileMutationTarget(files.get('target')!)!
    const backendMutation = vi.fn()
    let finishSaveAs: (() => void) | undefined

    const saveAs = coordinator.runExclusive(FILE_MUTATION_QUEUE_KEY, 'save-source', async () => {
      await new Promise<void>((resolve) => {
        finishSaveAs = resolve
      })
      files.delete(capturedTarget.id)
      folderData[0].children = []
    })
    const explorerMutation = coordinator.runFileMutation(async () => {
      const currentTree = new SimpleTree(folderData)
      const currentNode = getCurrentFileMutationNode(
        currentTree,
        (id) => files.get(id),
        capturedTarget,
      )
      if (!currentNode) return
      backendMutation()
    })

    await vi.waitFor(() => expect(finishSaveAs).toBeTypeOf('function'))
    finishSaveAs?.()
    await Promise.all([saveAs, explorerMutation])

    expect(backendMutation).not.toHaveBeenCalled()
  })

  it('rejects a multi-drag when any captured source became stale', () => {
    const folderData = [structuredClone(ROOT)]
    folderData[0].children!.push({
      id: 'second',
      kind: 'file',
      name: 'second.md',
      path: '/workspace/second.md',
    })
    const tree = new SimpleTree(folderData)
    const files = new Map<string, IFile>([
      ['target', folderData[0].children![0]],
      ['second', folderData[0].children![1]],
    ])
    const targets = folderData[0].children!.map((file) => captureFileMutationTarget(file)!)

    files.delete('second')

    expect(getCurrentFileMutationNodes(tree, (id) => files.get(id), targets)).toBeUndefined()
  })
})
