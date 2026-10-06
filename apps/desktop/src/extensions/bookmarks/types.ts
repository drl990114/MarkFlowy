export type BookmarkTarget = {
  kind: 'localFile'
  path: string
}

export interface Bookmark {
  id: string
  title: string
  target: BookmarkTarget
  tags: string[]
  /** Unix milliseconds, assigned once by the repository. */
  createdAt: number
}

export interface BookmarkLibrary {
  schemaVersion: 1
  revision: number
  items: Bookmark[]
}

export interface BookmarkViewConfig {
  groupBy: 'none' | 'tag'
  sort: {
    field: 'title' | 'createdAt'
    direction: 'asc' | 'desc'
  }
}

export type BookmarkMutation =
  | { type: 'create'; input: Pick<Bookmark, 'title' | 'target' | 'tags'> }
  | { type: 'update'; id: string; changes: Pick<Bookmark, 'title' | 'tags'> }
  | { type: 'delete'; id: string }

export interface BookmarkMigrationWarning {
  code: 'cleanupFailed' | 'legacyConflict'
  message: string
}

export interface BookmarkLibraryResult {
  library: BookmarkLibrary
  warning: BookmarkMigrationWarning | null
}

export interface PendingBookmarkRemoval {
  bookmark: Bookmark
  expectedRevision: number
  phase: 'undoable' | 'committing'
  timeoutId?: ReturnType<typeof setTimeout>
}
