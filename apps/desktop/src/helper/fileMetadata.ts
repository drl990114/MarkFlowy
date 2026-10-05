import type { IFile } from '@/helper/filesys'

/** Tree nodes and path indexes must not retain document bodies. */
export function toFileMetadata(file: IFile): IFile {
  const children = file.children?.map(toFileMetadata)
  const changedChildren = children?.some((child, index) => child !== file.children?.[index])
  if (!('content' in file) && !changedChildren) return file
  const { content: _content, ...metadata } = file
  return changedChildren ? { ...metadata, children } : metadata
}
