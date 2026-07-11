import { describe, expect, it, vi } from 'vitest'
import { getSaveAsCollisionIds, hasDirtySaveAsCollision } from './saveAsCollision'

describe('Save As collision preflight', () => {
  it('merges cache and tree ids while excluding the source id', () => {
    expect(
      getSaveAsCollisionIds({
        cachedTargetId: 'cached',
        pathTargetIds: ['cached', 'source', 'stale-alias'],
        sourceId: 'source',
        treeTargetId: 'tree',
      }),
    ).toEqual(['cached', 'tree', 'stale-alias'])
  })

  it('blocks before mutation when any conflicting id is dirty', () => {
    const isDirty = vi.fn((id: string) => id === 'dirty-target')

    expect(hasDirtySaveAsCollision(['saved-target', 'dirty-target'], isDirty)).toBe(true)
    expect(isDirty).toHaveBeenCalledWith('dirty-target')
  })
})
