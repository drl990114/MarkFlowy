import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, { moveFileObjectsByPathPrefix, setFileObject } from '@/helper/files'
import useFileTextDirectionStore, {
  FILE_TEXT_DIRECTION_STORAGE_KEY,
  getFileTextDirectionKey,
} from './useFileTextDirectionStore'

const first = { id: 'first', path: '/notes/first.md', name: 'first.md', kind: 'file' as const }
const second = { ...first, id: 'second', path: '/notes/second.md' }
const direction = (file: { id: string; path?: string }) =>
  useFileTextDirectionStore.getState().directions[getFileTextDirectionKey(file.id, file.path)]
beforeEach(() => {
  useFileTextDirectionStore.setState({ directions: {} })
  localStorage.clear()
  useFileCacheStore.setState({
    entries: {},
    pathEntries: {},
    contentEntries: {},
    metadataRevision: 0,
  })
})
afterEach(() => vi.restoreAllMocks())

describe('file text direction preferences', () => {
  it('persists per path across reopen and treats auto as an explicit override', async () => {
    const { setDirection } = useFileTextDirectionStore.getState()
    setDirection(first, 'rtl')
    setDirection(second, 'auto')
    const saved = localStorage.getItem(FILE_TEXT_DIRECTION_STORAGE_KEY)!
    useFileTextDirectionStore.setState({ directions: {} })
    localStorage.setItem(FILE_TEXT_DIRECTION_STORAGE_KEY, saved)
    await useFileTextDirectionStore.persist.rehydrate()
    expect(direction({ ...first, id: 'reopened' })).toBe('rtl')
    expect(direction(second)).toBe('auto')
    setDirection(first, undefined)
    expect(direction(first)).toBeUndefined()
    expect(direction(second)).toBe('auto')
    expect(
      JSON.parse(localStorage.getItem(FILE_TEXT_DIRECTION_STORAGE_KEY)!).state.directions,
    ).toEqual({
      'path:/notes/second.md': 'auto',
    })
  })

  it('isolates drafts and transfers their preference on the first successful save', () => {
    const draft = { ...first, path: undefined }
    setFileObject(draft.id, draft)
    useFileTextDirectionStore.getState().setDirection(draft, 'rtl')
    expect(direction(draft)).toBe('rtl')
    expect(direction({ id: 'another-draft' })).toBeUndefined()
    expect(
      JSON.parse(localStorage.getItem(FILE_TEXT_DIRECTION_STORAGE_KEY)!).state.directions,
    ).toEqual({})
    setFileObject(first.id, first)
    expect(direction(first)).toBe('rtl')
    expect(direction(draft)).toBeUndefined()
    expect(
      JSON.parse(localStorage.getItem(FILE_TEXT_DIRECTION_STORAGE_KEY)!).state.directions,
    ).toEqual({
      'path:/notes/first.md': 'rtl',
    })
  })

  it('follows file and folder renames, including closed files', () => {
    setFileObject(first.id, first)
    const { setDirection } = useFileTextDirectionStore.getState()
    setDirection(first, 'rtl')
    setDirection(second, 'ltr')
    const renamed = { ...first, name: 'renamed.md', path: '/notes/renamed.md' }
    setFileObject(first.id, renamed)
    expect(direction(renamed)).toBe('rtl')
    expect(direction(first)).toBeUndefined()
    moveFileObjectsByPathPrefix('/notes', '/moved')
    expect(direction({ ...renamed, path: '/moved/renamed.md' })).toBe('rtl')
    expect(direction({ ...second, path: '/moved/second.md' })).toBe('ltr')
    expect(direction(second)).toBeUndefined()
  })

  it('normalizes Windows aliases while keeping distinct POSIX paths isolated', () => {
    const { setDirection } = useFileTextDirectionStore.getState()
    setDirection({ id: 'windows', path: 'C:\\Notes\\Mixed.md' }, 'rtl')
    expect(direction({ id: 'alias', path: 'c:/notes/mixed.md' })).toBe('rtl')
    setDirection(first, 'ltr')
    expect(direction({ ...first, path: '/Notes/first.md' })).toBeUndefined()
    setDirection({ id: 'sibling', path: '/notes-other/sibling.md' }, 'auto')
    useFileTextDirectionStore.getState().rebasePaths('/notes', '/moved')
    expect(direction({ id: 'sibling', path: '/notes-other/sibling.md' })).toBe('auto')
  })

  it('ignores invalid persisted values and draft identities on rehydrate', async () => {
    localStorage.setItem(
      FILE_TEXT_DIRECTION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          directions: {
            'path:/valid.md': 'rtl',
            'path:/bad.md': 'bad',
            'path:': 'auto',
            'draft:stale': 'ltr',
          },
        },
      }),
    )
    await useFileTextDirectionStore.persist.rehydrate()
    expect(useFileTextDirectionStore.getState().directions).toEqual({ 'path:/valid.md': 'rtl' })
  })

  it('keeps the live preference usable when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    expect(() => useFileTextDirectionStore.getState().setDirection(first, 'rtl')).not.toThrow()
    expect(direction(first)).toBe('rtl')
  })
})
