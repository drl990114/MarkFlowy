const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/
const WINDOWS_UNC_PATH = /^\\\\/

const normalizePath = (path: string) => {
  const windows = WINDOWS_ABSOLUTE_PATH.test(path) || WINDOWS_UNC_PATH.test(path)
  const normalized = (windows ? path.replace(/\\/g, '/') : path).replace(/\/{2,}/g, '/')
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

/** Rebase a file or descendant without confusing siblings or Windows path aliases. */
export function rebaseFilePath(
  path: string,
  oldRootPath: string,
  newRootPath: string,
): string | undefined {
  const key = getPathIdentityKey(path)
  const rootKey = getPathIdentityKey(oldRootPath)
  if (key === rootKey) return newRootPath
  const prefix = rootKey.endsWith('/') ? rootKey : `${rootKey}/`
  if (!key.startsWith(prefix)) return undefined
  const windows = WINDOWS_ABSOLUTE_PATH.test(newRootPath) || WINDOWS_UNC_PATH.test(newRootPath)
  const separator = windows && newRootPath.includes('\\') ? '\\' : '/'
  const root = newRootPath.replace(windows ? /[\\/]+$/ : /\/+$/, '')
  const suffix = normalizePath(path).slice(prefix.length)
  return `${root}${separator}${separator === '\\' ? suffix.replace(/\//g, '\\') : suffix}`
}

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
