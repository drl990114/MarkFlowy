import { create } from 'zustand'

export const useWorkspaceOpenError = create<{ path?: string; error?: unknown }>(() => ({}))
export const clearWorkspaceOpenError = () =>
  useWorkspaceOpenError.setState({ path: undefined, error: undefined })
