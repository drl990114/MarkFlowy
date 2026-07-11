interface SaveAsCollisionCandidates {
  cachedTargetId?: string
  pathTargetIds?: string[]
  sourceId: string
  treeTargetId?: string
}

export function getSaveAsCollisionIds({
  cachedTargetId,
  pathTargetIds = [],
  sourceId,
  treeTargetId,
}: SaveAsCollisionCandidates): string[] {
  return Array.from(
    new Set([cachedTargetId, treeTargetId, ...pathTargetIds].filter((id): id is string => !!id)),
  ).filter((id) => id !== sourceId)
}

export function hasDirtySaveAsCollision(
  collisionIds: string[],
  isDirty: (fileId: string) => boolean,
): boolean {
  return collisionIds.some((fileId) => isDirty(fileId))
}
