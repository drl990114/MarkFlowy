import { invoke } from '@tauri-apps/api/core'
import { isRecord } from '@/stores/persistStorage'
import type { BookmarkLibrary, BookmarkLibraryResult, BookmarkMutation } from './types'

export const BOOKMARK_LIBRARY_CHANGED_EVENT = 'bookmark-library-changed'

export class BookmarkError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'BookmarkError'
    this.code = code
  }
}

export function normalizeBookmarkError(error: unknown): BookmarkError {
  if (error instanceof BookmarkError) return error
  if (isRecord(error) && typeof error.code === 'string' && typeof error.message === 'string') {
    return new BookmarkError(error.code, error.message)
  }
  const message = error instanceof Error ? error.message : String(error)
  return new BookmarkError('unknown', message)
}

export async function readBookmarkLibrary(): Promise<BookmarkLibraryResult> {
  try {
    return await invoke<BookmarkLibraryResult>('get_bookmark_library')
  } catch (error) {
    throw normalizeBookmarkError(error)
  }
}

export async function writeBookmarkMutation(
  mutation: BookmarkMutation,
  expectedRevision: number,
): Promise<BookmarkLibrary> {
  try {
    return await invoke<BookmarkLibrary>('mutate_bookmark_library', { expectedRevision, mutation })
  } catch (error) {
    throw normalizeBookmarkError(error)
  }
}
