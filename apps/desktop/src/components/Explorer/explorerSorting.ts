import type { IFile } from '@/helper/filesys'
import type { ExplorerSortDirection } from '@/stores/useExplorerStateStore'

const names = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const isDirectory = (file: IFile) =>
  file.kind === 'dir' || file.kind === 'pending_new_folder' || file.kind === 'pending_edit_folder'

export function createExplorerComparator(direction: ExplorerSortDirection) {
  const order = direction === 'desc' ? -1 : 1
  return (left: IFile, right: IFile): number => {
    const leftDirectory = isDirectory(left)
    const rightDirectory = isDirectory(right)
    if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1
    return order * names.compare(left.name, right.name)
  }
}
