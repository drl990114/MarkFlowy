import type { IFile } from '@/helper/filesys'
import { describe, expect, it } from 'vitest'
import { closeCleanPhysicalAliases } from './closeCleanPhysicalAliases'

describe('closeCleanPhysicalAliases', () => {
  it('closes the alias tab after refreshing cache without deleting its directory entry', () => {
    const alias: IFile = {
      id: 'hardlink',
      kind: 'file',
      name: 'hardlink.md',
      path: '/workspace/hardlink.md',
      content: 'old',
    }
    const cache = new Map([[alias.id, alias]])
    const tree = [alias]
    const opened = new Set([alias.id])

    closeCleanPhysicalAliases({
      aliasIds: [alias.id],
      closeTab: (fileId) => opened.delete(fileId),
      content: 'new',
      getFile: (fileId) => cache.get(fileId),
      updateFile: (file) => cache.set(file.id, file),
    })

    expect(opened.has(alias.id)).toBe(false)
    expect(cache.get(alias.id)).toMatchObject({ id: alias.id, content: 'new' })
    expect(tree.map((file) => file.id)).toEqual([alias.id])
  })
})
