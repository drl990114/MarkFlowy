import { getFileObjectByPath } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import type { Bookmark } from './types'

/** Opening a target belongs to the Desktop host, not to the bookmark repository. */
export function openBookmark(bookmark: Bookmark): void {
  const file =
    getFileObjectByPath(bookmark.target.path) ??
    createFile({ name: bookmark.title, path: bookmark.target.path })

  const editor = useEditorStore.getState()
  editor.addOpenedFile(file.id)
  editor.setActiveId(file.id)
}
