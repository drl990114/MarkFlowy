import { describe, expect, it, vi } from 'vitest'

import { hasRenameConflict } from '../../../../../packages/interface/src/components/FileTree/rename-conflict'

describe('hasRenameConflict', () => {
  it('returns false when the path is unchanged', async () => {
    const fileExists = vi.fn().mockResolvedValue(true)
    const pathsReferToSameDirectoryEntry = vi.fn().mockResolvedValue(true)

    await expect(
      hasRenameConflict({
        currentPath: '/docs/Javascript',
        candidatePath: '/docs/Javascript',
        fileExists,
        pathsReferToSameDirectoryEntry,
      }),
    ).resolves.toBe(false)

    expect(fileExists).not.toHaveBeenCalled()
    expect(pathsReferToSameDirectoryEntry).not.toHaveBeenCalled()
  })

  it('returns false when the candidate path does not exist', async () => {
    const fileExists = vi.fn().mockResolvedValue(false)
    const pathsReferToSameDirectoryEntry = vi.fn()

    await expect(
      hasRenameConflict({
        currentPath: '/docs/Javascript',
        candidatePath: '/docs/TypeScript',
        fileExists,
        pathsReferToSameDirectoryEntry,
      }),
    ).resolves.toBe(false)

    expect(pathsReferToSameDirectoryEntry).not.toHaveBeenCalled()
  })

  it('returns false for a case-only rename that resolves to the same directory entry', async () => {
    // Windows/macOS case-insensitive filesystems: "JavaScript" resolves to the
    // existing "Javascript" directory, so fileExists reports a collision even
    // though it is the node itself.
    const fileExists = vi.fn().mockResolvedValue(true)
    const pathsReferToSameDirectoryEntry = vi.fn().mockResolvedValue(true)

    await expect(
      hasRenameConflict({
        currentPath: 'D:\\docs\\Javascript',
        candidatePath: 'D:\\docs\\JavaScript',
        fileExists,
        pathsReferToSameDirectoryEntry,
      }),
    ).resolves.toBe(false)

    expect(pathsReferToSameDirectoryEntry).toHaveBeenCalledWith(
      'D:\\docs\\Javascript',
      'D:\\docs\\JavaScript',
    )
  })

  it('returns false for a case-only rename of a file (not just directories)', async () => {
    // Same case-insensitive filesystem behavior applies to files: renaming
    // javascript.md -> JavaScript.md resolves to the file itself.
    const fileExists = vi.fn().mockResolvedValue(true)
    const pathsReferToSameDirectoryEntry = vi.fn().mockResolvedValue(true)

    await expect(
      hasRenameConflict({
        currentPath: 'D:\\docs\\javascript.md',
        candidatePath: 'D:\\docs\\JavaScript.md',
        fileExists,
        pathsReferToSameDirectoryEntry,
      }),
    ).resolves.toBe(false)
  })

  it('returns true when a different file already occupies the candidate path', async () => {
    // Case-sensitive filesystems (Linux): renaming foo -> FOO while a separate
    // FOO exists must still be reported as a conflict to avoid overwriting it.
    // A hard link at the candidate path is also a different directory entry.
    const fileExists = vi.fn().mockResolvedValue(true)
    const pathsReferToSameDirectoryEntry = vi.fn().mockResolvedValue(false)

    await expect(
      hasRenameConflict({
        currentPath: '/docs/Javascript',
        candidatePath: '/docs/JavaScript',
        fileExists,
        pathsReferToSameDirectoryEntry,
      }),
    ).resolves.toBe(true)
  })

  it('reduces to a plain existence check for an empty currentPath (new-file creation)', async () => {
    // New nodes have no path yet; there is no "self" to exclude. The desktop
    // backend returns false from paths_refer_to_same_directory_entry when
    // either path does not exist, so any existing candidate is a conflict.
    const fileExists = vi.fn().mockResolvedValue(true)
    const pathsReferToSameDirectoryEntry = vi.fn().mockResolvedValue(false)

    await expect(
      hasRenameConflict({
        currentPath: '',
        candidatePath: '/docs/JavaScript',
        fileExists,
        pathsReferToSameDirectoryEntry,
      }),
    ).resolves.toBe(true)

    expect(pathsReferToSameDirectoryEntry).toHaveBeenCalledWith('', '/docs/JavaScript')
  })
})
