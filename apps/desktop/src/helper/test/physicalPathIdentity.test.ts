import { describe, expect, it, vi } from 'vitest'
import {
  findFilesReferringToPath,
  findPathCollisions,
  memoizeSameFileResolver,
} from '../physicalPathIdentity'

describe('findFilesReferringToPath', () => {
  it('uses an injectable physical identity resolver for POSIX aliases', async () => {
    const sameFile = vi.fn(
      async (_targetPath: string, candidatePath: string) => candidatePath === '/workspace/Foo.md',
    )
    const candidates = [
      {
        id: 'alias',
        kind: 'file' as const,
        name: 'Foo.md',
        path: '/workspace/Foo.md',
      },
      {
        id: 'other',
        kind: 'file' as const,
        name: 'other.md',
        path: '/workspace/other.md',
      },
    ]

    await expect(
      findFilesReferringToPath('/workspace/foo.md', candidates, sameFile),
    ).resolves.toEqual([candidates[0]])
  })

  it('deduplicates candidate ids before resolving identity', async () => {
    const sameFile = vi.fn(async () => true)
    const candidate = {
      id: 'same-id',
      kind: 'file' as const,
      name: 'target.md',
      path: '/workspace/target.md',
    }

    await findFilesReferringToPath('/workspace/target.md', [candidate, candidate], sameFile)

    expect(sameFile).toHaveBeenCalledOnce()
  })

  it('memoizes physical identity checks within one reservation', async () => {
    const resolver = vi.fn(async () => true)
    const memoized = memoizeSameFileResolver(resolver)

    await expect(memoized('/target', '/candidate')).resolves.toBe(true)
    await expect(memoized('/target', '/candidate')).resolves.toBe(true)

    expect(resolver).toHaveBeenCalledOnce()
  })

  it('protects but does not replace a distinct hardlink entry', async () => {
    const hardlink = {
      id: 'hardlink',
      kind: 'file' as const,
      name: 'hardlink.md',
      path: '/workspace/hardlink.md',
    }

    await expect(
      findPathCollisions('/workspace/target.md', [hardlink], async () => ({
        sameDirectoryEntry: false,
        sameFile: true,
      })),
    ).resolves.toEqual({ protectedFiles: [hardlink], replaceFiles: [] })
  })

  it('protects and replaces a casing alias of the target entry', async () => {
    const alias = {
      id: 'alias',
      kind: 'file' as const,
      name: 'Target.md',
      path: '/workspace/Target.md',
    }

    await expect(
      findPathCollisions('/workspace/target.md', [alias], async () => ({
        sameDirectoryEntry: true,
        sameFile: true,
      })),
    ).resolves.toEqual({ protectedFiles: [alias], replaceFiles: [alias] })
  })
})
