import { describe, expect, it, vi } from 'vitest'
import { collectBookmarkTags, queryBookmarks, selectVisibleBookmarks } from './query'
import type { Bookmark, BookmarkViewConfig } from './types'

const bookmark = (id: string, title: string, createdAt = 1, tags: string[] = []): Bookmark => ({
  id,
  title,
  target: { kind: 'localFile', path: `/notes/${id}.md` },
  tags,
  createdAt,
})

const config = (
  field: BookmarkViewConfig['sort']['field'] = 'title',
  direction: BookmarkViewConfig['sort']['direction'] = 'asc',
  groupBy: BookmarkViewConfig['groupBy'] = 'none',
): BookmarkViewConfig => ({ sort: { field, direction }, groupBy })

describe('bookmark queries', () => {
  const first = bookmark('first', 'Note 2', 30)
  const second = bookmark('second', 'Note 10', 10)
  const third = bookmark('third', 'Note 1', 20)
  const source = Object.freeze([first, second, third])

  it.each([
    ['title', 'asc', ['third', 'first', 'second']],
    ['title', 'desc', ['second', 'first', 'third']],
    ['createdAt', 'asc', ['second', 'third', 'first']],
    ['createdAt', 'desc', ['first', 'third', 'second']],
  ] as const)('supports %s %s without changing library order', (field, direction, ids) => {
    const result = queryBookmarks(source, config(field, direction), 'en')
    expect(result.items.map((item) => item.id)).toEqual(ids)
    expect(result.groups).toEqual([])
    expect(source).toEqual([first, second, third])
  })

  it('breaks equal times by ascending title, then equal names by exact path and ID', () => {
    const items = [
      bookmark('b', 'Éclair'),
      bookmark('a', 'eclair'),
      bookmark('c', 'ECLAIR'),
      bookmark('d', 'Zebra'),
    ]
    expect(
      queryBookmarks(items, config('createdAt', 'desc'), 'en').items.map(({ id }) => id),
    ).toEqual(['a', 'b', 'c', 'd'])
    const samePath = items.slice(0, 3).map((item) => ({
      ...item,
      target: { ...item.target, path: '/same/path' },
    }))
    for (const direction of ['asc', 'desc'] as const) {
      expect(
        queryBookmarks(samePath, config('title', direction), 'en').items.map(({ id }) => id),
      ).toEqual(['a', 'b', 'c'])
    }
  })

  it('places each multi-tag bookmark in every group and keeps untagged identity separate', () => {
    const items = [
      bookmark('both', 'Item 10', 1, ['Work', 'Personal', 'Work']),
      bookmark('single', 'Item 2', 2, ['Work']),
      bookmark('literal', 'Other', 1, ['未分类']),
      bookmark('none', 'No tag'),
    ]
    const { groups } = queryBookmarks(items, config('title', 'asc', 'tag'), 'cn')
    const work = groups.find((group) => group.tag === 'Work')!
    expect(work.bookmarks.map(({ id }) => id)).toEqual(['single', 'both'])
    expect(groups.find((group) => group.tag === 'Personal')?.bookmarks).toEqual([items[0]])
    expect(groups.at(-1)).toMatchObject({ id: 'untagged', kind: 'untagged', bookmarks: [items[3]] })
    expect(groups.find((group) => group.tag === '未分类')?.id).toBe('tag:未分类')
    expect(items[0].tags).toEqual(['Work', 'Personal', 'Work'])
  })

  it('sorts group names naturally ascending independently of item sort and insertion order', () => {
    const items = [
      bookmark('one', 'One', 1, ['Tag 10', 'work', 'Work', 'Tag 2']),
      bookmark('two', 'Two', 2, ['Tag 2']),
    ]
    const result = queryBookmarks(items, config('createdAt', 'desc', 'tag'), 'en')
    expect(result.groups.map((group) => group.tag)).toEqual(['Tag 2', 'Tag 10', 'Work', 'work'])
    expect(result.groups[0].bookmarks.map(({ id }) => id)).toEqual(['two', 'one'])
    expect(queryBookmarks([...items].reverse(), config('createdAt', 'desc', 'tag'), 'en')).toEqual(
      result,
    )
  })

  it('maps application locales and caches collators while recalculating each query', () => {
    const OriginalCollator = Intl.Collator
    const spy = vi.spyOn(Intl, 'Collator').mockImplementation(function createCollator(...args) {
      return new OriginalCollator(...args)
    })
    const french = [bookmark('z', 'Zèbre'), bookmark('e', 'École 2'), bookmark('e10', 'école 10')]
    try {
      expect(queryBookmarks(french, config(), 'frFR').items.map(({ id }) => id)).toEqual([
        'e',
        'e10',
        'z',
      ])
      queryBookmarks(french, config(), 'frFR')
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('fr-FR', { numeric: true, sensitivity: 'base' })
      const chinese = [bookmark('zhang', '张'), bookmark('a', '阿')]
      expect(queryBookmarks(chinese, config(), 'cn').items.map(({ id }) => id)).toEqual([
        'a',
        'zhang',
      ])
      for (const [language, names] of [
        ['ja', ['あ 2', 'あ 10']],
        ['ko', ['노트 2', '노트 10']],
      ] as const) {
        const items = [bookmark('ten', names[1]), bookmark('two', names[0])]
        expect(queryBookmarks(items, config(), language).items.map(({ id }) => id)).toEqual([
          'two',
          'ten',
        ])
      }
    } finally {
      spy.mockRestore()
    }
  })

  it('immediately derives new order and tags from an edited immutable snapshot', () => {
    const original = [bookmark('a', 'A', 1, ['old']), bookmark('b', 'B', 2, ['old'])]
    const edited = [original[0], { ...original[1], title: '0', tags: ['new'] }]
    expect(queryBookmarks(edited, config(), 'en').items.map(({ id }) => id)).toEqual(['b', 'a'])
    expect(collectBookmarkTags(edited)).toEqual(['old', 'new'])
    expect(collectBookmarkTags(original)).toEqual(['old'])
  })

  it('hides pending removals without removing authority or treating inherited properties as IDs', () => {
    const items = [bookmark('hidden', 'Hidden'), bookmark('constructor', 'Constructor')]
    const visible = selectVisibleBookmarks(items, {
      hidden: { bookmark: items[0], expectedRevision: 1, phase: 'undoable' },
    })
    expect(visible).toEqual([items[1]])
    expect(items).toHaveLength(2)
  })
})
