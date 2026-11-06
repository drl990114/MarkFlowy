import { beforeEach, describe, expect, it } from 'vitest'
import { createExplorerStateStore } from './useExplorerStateStore'
import { workspaceStorageKey } from './workspacePersistence'

beforeEach(() => localStorage.clear())

describe('Explorer sort preference', () => {
  it('persists direction together with expansion and isolates workspaces', () => {
    const original = createExplorerStateStore('/workspace/a')
    original.getState().setExpandedPaths(['/workspace/a', '/workspace/a/docs'])
    original.getState().setSortDirection('desc')
    expect(createExplorerStateStore('/workspace/a').getState()).toMatchObject({
      sortDirection: 'desc',
      expandedPaths: ['/workspace/a', '/workspace/a/docs'],
    })
    expect(createExplorerStateStore('/workspace/b').getState().sortDirection).toBe('asc')
    expect(JSON.parse(localStorage.getItem(workspaceStorageKey('explorer', '/workspace/a'))!).state)
      .toEqual({ expandedPaths: ['/workspace/a', '/workspace/a/docs'], sortDirection: 'desc' })
  })

  it('shares the saved direction between aliases of the same Windows workspace', () => {
    createExplorerStateStore('C:\\Work').getState().setSortDirection('desc')
    expect(createExplorerStateStore('c:/work').getState().sortDirection).toBe('desc')
  })

  it.each([undefined, 'invalid', null, 123])('defaults legacy or corrupt direction %s to ascending', (sortDirection) => {
    localStorage.setItem(workspaceStorageKey('explorer', '/workspace'), JSON.stringify({
      version: 1,
      state: { expandedPaths: [], sortDirection },
    }))
    expect(createExplorerStateStore('/workspace').getState()).toMatchObject({
      sortDirection: 'asc',
      expandedPaths: [],
    })
  })
})
