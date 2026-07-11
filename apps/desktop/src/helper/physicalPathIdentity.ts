import type { IFile } from '@/helper/filesys'
import { invoke } from '@tauri-apps/api/core'
import { getPathIdentityKey } from './pathIdentity'

export type SameFileResolver = (firstPath: string, secondPath: string) => Promise<boolean>
export interface PathRelation {
  sameDirectoryEntry: boolean
  sameFile: boolean
}
export type PathRelationResolver = (firstPath: string, secondPath: string) => Promise<PathRelation>

export const pathsReferToSameFile: SameFileResolver = async (firstPath, secondPath) => {
  if (getPathIdentityKey(firstPath) === getPathIdentityKey(secondPath)) return true

  try {
    return await invoke<boolean>('paths_refer_to_same_file', {
      path1: firstPath,
      path2: secondPath,
    })
  } catch {
    // The backend command may be unavailable on older builds. Preserve POSIX
    // casing instead of guessing that the underlying volume is insensitive.
    return false
  }
}

export function memoizeSameFileResolver(resolver: SameFileResolver): SameFileResolver {
  const cache = new Map<string, Promise<boolean>>()

  return (firstPath, secondPath) => {
    const key = `${firstPath}\0${secondPath}`
    let result = cache.get(key)
    if (!result) {
      result = resolver(firstPath, secondPath)
      cache.set(key, result)
    }
    return result
  }
}

export const comparePathRelation: PathRelationResolver = async (firstPath, secondPath) => {
  if (getPathIdentityKey(firstPath) === getPathIdentityKey(secondPath)) {
    return { sameDirectoryEntry: true, sameFile: true }
  }

  try {
    const [sameFile, sameDirectoryEntry] = await Promise.all([
      invoke<boolean>('paths_refer_to_same_file', { path1: firstPath, path2: secondPath }),
      invoke<boolean>('paths_refer_to_same_directory_entry', {
        path1: firstPath,
        path2: secondPath,
      }),
    ])
    return { sameDirectoryEntry, sameFile }
  } catch {
    return { sameDirectoryEntry: false, sameFile: false }
  }
}

export function memoizePathRelationResolver(resolver: PathRelationResolver): PathRelationResolver {
  const cache = new Map<string, Promise<PathRelation>>()

  return (firstPath, secondPath) => {
    const key = `${firstPath}\0${secondPath}`
    let result = cache.get(key)
    if (!result) {
      result = resolver(firstPath, secondPath)
      cache.set(key, result)
    }
    return result
  }
}

export async function findPathCollisions(
  targetPath: string,
  candidates: IFile[],
  compare: PathRelationResolver = comparePathRelation,
): Promise<{ protectedFiles: IFile[]; replaceFiles: IFile[] }> {
  const protectedFiles: IFile[] = []
  const replaceFiles: IFile[] = []
  const uniqueCandidates = Array.from(
    new Map(candidates.filter((file) => !!file.path).map((file) => [file.id, file])).values(),
  )

  for (let index = 0; index < uniqueCandidates.length; index += 16) {
    const batch = uniqueCandidates.slice(index, index + 16)
    const relations = await Promise.all(
      batch.map(async (file) => ({ file, relation: await compare(targetPath, file.path!) })),
    )

    relations.forEach(({ file, relation }) => {
      if (relation.sameFile) protectedFiles.push(file)
      if (relation.sameDirectoryEntry) replaceFiles.push(file)
    })
  }

  return { protectedFiles, replaceFiles }
}

export async function findFilesReferringToPath(
  targetPath: string,
  candidates: IFile[],
  sameFile: SameFileResolver = pathsReferToSameFile,
): Promise<IFile[]> {
  const matches: IFile[] = []
  const uniqueCandidates = Array.from(
    new Map(candidates.filter((file) => !!file.path).map((file) => [file.id, file])).values(),
  )

  // Save As is rare, but bounded batches avoid issuing thousands of filesystem
  // identity calls at once for a large workspace.
  for (let index = 0; index < uniqueCandidates.length; index += 16) {
    const batch = uniqueCandidates.slice(index, index + 16)
    const batchMatches = await Promise.all(
      batch.map(async (file) => ((await sameFile(targetPath, file.path!)) ? file : undefined)),
    )
    matches.push(...batchMatches.filter((file): file is IFile => !!file))
  }

  return matches
}
