import { FILE_MUTATION_QUEUE_KEY, type SavePathCoordinator } from './savePathCoordinator'

export interface SaveAsCollisionSet {
  protectedIds: string[]
  replaceIds: string[]
}

interface ReservedSaveAsParams {
  applyReservationUpdate: (update: () => void) => void
  collectCollisions: () => SaveAsCollisionSet | Promise<SaveAsCollisionSet>
  collectPostWriteReplaceIds: () => string[]
  coordinator: SavePathCoordinator
  isDirty: (fileId: string) => boolean
  onUnexpectedDirty?: (fileIds: string[]) => void
  ownerFileId: string
  path: string
  replaceCollisions: (collisionIds: string[]) => void
  reservationKey?: string
  prepareWrite?: () => Promise<void>
  syncProtectedAliases?: (fileIds: string[]) => void
  write: () => Promise<boolean>
}

const unique = (ids: string[]) => Array.from(new Set(ids))
const mergeCollisions = (...collisions: SaveAsCollisionSet[]): SaveAsCollisionSet => ({
  protectedIds: unique(collisions.flatMap(({ protectedIds }) => protectedIds)),
  replaceIds: unique(collisions.flatMap(({ replaceIds }) => replaceIds)),
})

/**
 * The operation can fail only before the durable write. Once writing succeeds,
 * exact target entries are replaced and clean physical aliases are synchronized.
 */
export async function runReservedSaveAs({
  applyReservationUpdate,
  collectCollisions,
  collectPostWriteReplaceIds,
  coordinator,
  isDirty,
  onUnexpectedDirty,
  ownerFileId,
  path,
  prepareWrite,
  replaceCollisions,
  reservationKey = FILE_MUTATION_QUEUE_KEY,
  syncProtectedAliases,
  write,
}: ReservedSaveAsParams): Promise<boolean> {
  return coordinator.runExclusive(reservationKey, ownerFileId, async (lease) => {
    applyReservationUpdate(() => lease.activate(path))
    await prepareWrite?.()

    const initialCollisions = await collectCollisions()
    applyReservationUpdate(() => lease.protectFileIds(initialCollisions.protectedIds))
    applyReservationUpdate(() => lease.enableOtherEditorBarrier())

    const verifiedCollisions = mergeCollisions(initialCollisions, await collectCollisions())
    applyReservationUpdate(() => lease.protectFileIds(verifiedCollisions.protectedIds))

    if (verifiedCollisions.protectedIds.some((fileId) => isDirty(fileId))) return false
    if (!(await write())) return false

    const replaceIds = unique([...verifiedCollisions.replaceIds, ...collectPostWriteReplaceIds()])
    const unexpectedDirtyIds = replaceIds.filter((fileId) => isDirty(fileId))
    if (unexpectedDirtyIds.length > 0) {
      onUnexpectedDirty?.(unexpectedDirtyIds)
      return false
    }

    const replaceIdSet = new Set(replaceIds)
    const cleanAliasIds = verifiedCollisions.protectedIds.filter(
      (fileId) => !replaceIdSet.has(fileId) && !isDirty(fileId),
    )
    syncProtectedAliases?.(cleanAliasIds)
    replaceCollisions(replaceIds)
    return true
  })
}
