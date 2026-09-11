import { beforeEach, describe, expect, it } from 'vitest'
import { createSearchStore } from '@/extensions/search/useSearchStore'
import { createExplorerStateStore } from './useExplorerStateStore'
import { createEditorResumeStore } from './editorResumeStore'
import { workspaceStorageKey } from './workspacePersistence'

beforeEach(() => localStorage.clear())

describe('workspace view persistence', () => {
  it('rehydrates submitted search criteria and path-based expansion without persisting stale file contents', () => {
    const original = createSearchStore('/work/a')
    original.getState().setSearchState({
      searchKeyword: 'hello',
      caseSensitive: true,
      hasSearched: true,
      activeIndex: 3,
      activeMatch: { path: '/work/a/note.md', line: 8, startColumn: 4 },
      expandedPaths: { '/work/a/note.md': false },
      resultList: [
        {
          id: 'old-id',
          path: '/work/a/note.md',
          ext: 'md',
          name: 'note.md',
          is_folder: false,
          matches: [],
          relative_path: 'note.md',
        },
      ],
    })
    const restored = createSearchStore('/work/a').getState()
    expect(restored).toMatchObject({
      searchKeyword: 'hello',
      caseSensitive: true,
      activeIndex: 3,
      activeMatch: { path: '/work/a/note.md', line: 8, startColumn: 4 },
      hasSearched: true,
      expandedPaths: { '/work/a/note.md': false },
      resultList: [],
    })
    expect(createSearchStore('/work/b').getState().searchKeyword).toBe('')
    expect(localStorage.getItem(workspaceStorageKey('search', '/work/a'))).not.toContain('old-id')
  })

  it('keeps an unsubmitted search draft without requesting an automatic search', () => {
    createSearchStore('/draft').getState().setSearchState({ searchKeyword: 'draft' })
    expect(createSearchStore('/draft').getState()).toMatchObject({
      searchKeyword: 'draft',
      hasSearched: false,
    })
  })

  it('remembers a fully collapsed tree and separates Windows workspace aliases from other workspaces', () => {
    createExplorerStateStore('C:\\Work').getState().setExpandedPaths([])
    expect(createExplorerStateStore('c:/work').getState().expandedPaths).toEqual([])
    expect(createExplorerStateStore('c:/other').getState().expandedPaths).toBeUndefined()
  })

  it('isolates document positions by file, group and mode, and rejects corrupt coordinates', () => {
    const position = {
      scrollTop: 440,
      scrollLeft: 0,
      selection: { kind: 'source' as const, anchor: 3, head: 8 },
    }
    createEditorResumeStore('/file.md', 'left', 'source').getState().save(position)
    expect(createEditorResumeStore('/file.md', 'left', 'source').getState().resume).toEqual(
      position,
    )
    expect(createEditorResumeStore('/file.md', 'right', 'source').getState().resume).toBeUndefined()
    expect(createEditorResumeStore('/file.md', 'left', 'edit').getState().resume).toBeUndefined()
    const store = createEditorResumeStore('/broken.md', '', 'edit')
    localStorage.setItem(
      store.persist.getOptions().name!,
      JSON.stringify({ version: 1, state: { resume: { scrollTop: -10, scrollLeft: 0 } } }),
    )
    expect(createEditorResumeStore('/broken.md', '', 'edit').getState().resume).toBeUndefined()
  })
})
