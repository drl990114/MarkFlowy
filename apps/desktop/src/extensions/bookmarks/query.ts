import type { Bookmark, BookmarkViewConfig, PendingBookmarkRemoval } from './types'

export interface BookmarkGroup {
  id: string
  kind: 'tag' | 'untagged'
  tag?: string
  bookmarks: Bookmark[]
}

const collators = new Map<string, Intl.Collator>()

function getCollator(language: string): Intl.Collator {
  const locale = language === 'cn' ? 'zh-CN' : language === 'frFR' ? 'fr-FR' : language
  const cached = collators.get(locale)
  if (cached) return cached
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  collators.set(locale, collator)
  return collator
}

function compareIdentity(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}

type BookmarkComparator = (left: Bookmark, right: Bookmark) => number

function getComparator(sort: BookmarkViewConfig['sort'], collator: Intl.Collator) {
  const comparators: Record<BookmarkViewConfig['sort']['field'], BookmarkComparator> = {
    title: (left, right) => collator.compare(left.title, right.title),
    createdAt: (left, right) => left.createdAt - right.createdAt,
  }
  const direction = sort.direction === 'asc' ? 1 : -1
  const compareField = comparators[sort.field]
  return (left: Bookmark, right: Bookmark) =>
    direction * compareField(left, right) ||
    collator.compare(left.title, right.title) ||
    compareIdentity(left.target.path, right.target.path) ||
    compareIdentity(left.id, right.id)
}

export function selectVisibleBookmarks(
  items: readonly Bookmark[],
  pendingRemovals: Readonly<Record<string, PendingBookmarkRemoval>>,
): Bookmark[] {
  return items.filter((item) => !Object.hasOwn(pendingRemovals, item.id))
}

export function collectBookmarkTags(items: readonly Bookmark[]): string[] {
  return [...new Set(items.flatMap((item) => item.tags))]
}

/** View order and grouping never change the persisted library or its items. */
export function queryBookmarks(
  source: readonly Bookmark[],
  config: BookmarkViewConfig,
  language: string,
): { items: Bookmark[]; groups: BookmarkGroup[] } {
  const collator = getCollator(language)
  const items = [...source].sort(getComparator(config.sort, collator))
  if (config.groupBy === 'none') return { items, groups: [] }

  const tags = new Map<string, BookmarkGroup>()
  const untagged: BookmarkGroup = { id: 'untagged', kind: 'untagged', bookmarks: [] }
  for (const item of items) {
    if (!item.tags.length) untagged.bookmarks.push(item)
    for (const tag of new Set(item.tags)) {
      const group = tags.get(tag) ?? {
        id: `tag:${tag}`,
        kind: 'tag' as const,
        tag,
        bookmarks: [],
      }
      group.bookmarks.push(item)
      tags.set(tag, group)
    }
  }
  const groups = [...tags.entries()]
    .sort(([left], [right]) => collator.compare(left, right) || compareIdentity(left, right))
    .map(([, group]) => group)
  if (untagged.bookmarks.length) groups.push(untagged)
  return { items, groups }
}
