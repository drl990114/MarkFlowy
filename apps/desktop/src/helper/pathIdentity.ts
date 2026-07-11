const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/
const WINDOWS_UNC_PATH = /^\\\\/

/**
 * Produces a stable in-process key without assuming every POSIX volume is
 * case-insensitive. Physical aliases still require a backend file identity.
 */
export function getPathIdentityKey(path: string): string {
  const isWindowsPath = WINDOWS_ABSOLUTE_PATH.test(path) || WINDOWS_UNC_PATH.test(path)
  const separatorNormalized = isWindowsPath ? path.replace(/\\/g, '/') : path
  const duplicateSeparatorsRemoved = separatorNormalized.replace(/\/{2,}/g, '/')
  const trailingSeparatorRemoved =
    duplicateSeparatorsRemoved.length > 1
      ? duplicateSeparatorsRemoved.replace(/\/+$/, '')
      : duplicateSeparatorsRemoved

  return isWindowsPath ? trailingSeparatorRemoved.toLowerCase() : trailingSeparatorRemoved
}
