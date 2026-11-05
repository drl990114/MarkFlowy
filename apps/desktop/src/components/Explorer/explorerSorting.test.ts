import type { IFile } from '@/helper/filesys'
import { describe, expect, it } from 'vitest'
import { createExplorerComparator } from './explorerSorting'

const entry = (name: string, kind: IFile['kind'] = 'file'): IFile => ({ id: name, name, kind })

describe('Explorer name ordering', () => {
  it.each([
    ['asc', ['Folder2', 'Folder10', '文档2.md', '文档10.md']],
    ['desc', ['Folder10', 'Folder2', '文档10.md', '文档2.md']],
  ] as const)('keeps directories first and numbers natural in %s order', (direction, expected) => {
    const files = [entry('文档10.md'), entry('Folder10', 'dir'), entry('文档2.md'), entry('Folder2', 'dir')]
    expect([...files].sort(createExplorerComparator(direction)).map((file) => file.name)).toEqual(expected)
    expect(files.map((file) => file.name)).toEqual(['文档10.md', 'Folder10', '文档2.md', 'Folder2'])
  })

  it('keeps folder creation and rename drafts with directories when descending', () => {
    const files = [
      entry('z.md'),
      entry('a', 'pending_new_folder'),
      entry('b', 'pending_edit_folder'),
      entry('a.md', 'pending_edit_file'),
    ]
    expect(files.sort(createExplorerComparator('desc')).map((file) => file.name))
      .toEqual(['b', 'a', 'z.md', 'a.md'])
  })
})
