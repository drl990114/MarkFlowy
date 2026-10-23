const TEMPORARY_WORKSPACE_KEY = '__temporary_workspace__'

export function getAskWorkspaceKey(rootPath?: string | null): string {
  if (!rootPath?.trim()) return TEMPORARY_WORKSPACE_KEY

  const normalized = rootPath.trim().replace(/\\/g, '/').replace(/\/+$/, '') || '/'
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized
}
