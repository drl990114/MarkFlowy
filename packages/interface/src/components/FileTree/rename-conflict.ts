export interface RenameConflictOptions {
  /** Current path of the node being renamed. */
  currentPath: string
  /** Path the node would have after the rename. */
  candidatePath: string
  fileExists: (path: string) => Promise<boolean>
  pathsReferToSameDirectoryEntry: (path1: string, path2: string) => Promise<boolean>
}

/**
 * Whether renaming `currentPath` to `candidatePath` would collide with a
 * different existing file.
 *
 * On case-insensitive filesystems, a case-only rename
 * like `s` -> `S` makes `fileExists(candidatePath)` return
 * true because the candidate resolves to the node itself. That is not a
 * conflict, so the collision is only real when the two paths are not aliases
 * of the same directory entry. Directory-entry identity (rather than plain
 * inode identity) is used so a hard link at the candidate path still counts
 * as a conflict.
 */
export async function hasRenameConflict(options: RenameConflictOptions): Promise<boolean> {
  const { currentPath, candidatePath, fileExists, pathsReferToSameDirectoryEntry } = options

  if (currentPath === candidatePath) return false
  if (!(await fileExists(candidatePath))) return false
  return !(await pathsReferToSameDirectoryEntry(currentPath, candidatePath))
}
