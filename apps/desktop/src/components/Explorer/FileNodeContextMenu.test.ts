import { describe, expect, it, vi } from 'vitest'
import {
  collapseAllFileTreeFolders,
  copyFileTreePath,
  createPathCopyMenuItems,
} from '../../../../../packages/interface/src/components/FileTree/FileNode'

describe('FileTree node actions', () => {
  it('collapses the current tree and keeps the workspace root open', () => {
    const closeAll = vi.fn()
    const open = vi.fn()

    collapseAllFileTreeFolders({ closeAll }, { open })

    expect(closeAll).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledOnce()
    expect(closeAll.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0])
  })

  it('creates absolute and workspace-relative path actions', () => {
    const onCopyPath = vi.fn()
    const items = createPathCopyMenuItems('/workspace/docs/note.md', onCopyPath, {
      absolute: 'Copy path',
      relative: 'Copy relative path',
    })

    expect(items.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'Copy path', value: 'copy_path' },
      { label: 'Copy relative path', value: 'copy_relative_path' },
    ])

    items[0].handler?.()
    items[1].handler?.()

    expect(onCopyPath).toHaveBeenNthCalledWith(1, '/workspace/docs/note.md', 'absolute')
    expect(onCopyPath).toHaveBeenNthCalledWith(2, '/workspace/docs/note.md', 'relative')
  })

  it('resolves relative paths from the workspace root before copying', async () => {
    const copyText = vi.fn()
    const getRelativePath = vi.fn().mockResolvedValue('docs/note.md')

    await copyFileTreePath({
      path: '/workspace/docs/note.md',
      type: 'relative',
      rootPath: '/workspace',
      copyText,
      getRelativePath,
    })

    expect(getRelativePath).toHaveBeenCalledWith('/workspace/docs/note.md', '/workspace')
    expect(copyText).toHaveBeenCalledWith('docs/note.md')
  })

  it('copies the absolute path without invoking the relative-path adapter', async () => {
    const copyText = vi.fn()
    const getRelativePath = vi.fn()

    await copyFileTreePath({
      path: '/workspace/docs/note.md',
      type: 'absolute',
      rootPath: '/workspace',
      copyText,
      getRelativePath,
    })

    expect(getRelativePath).not.toHaveBeenCalled()
    expect(copyText).toHaveBeenCalledWith('/workspace/docs/note.md')
  })
})
