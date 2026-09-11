import { getPathIdentityKey } from '@/helper/pathIdentity'

/** Separate keys prevent windows belonging to different workspaces overwriting each other. */
export function workspaceStorageKey(feature: string, workspace: string) {
  return `mf:desktop:${feature}:${encodeURIComponent(getPathIdentityKey(workspace))}`
}
