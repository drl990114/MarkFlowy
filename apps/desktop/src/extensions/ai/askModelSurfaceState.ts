import type { OllamaDiscoveryStatus } from './ollamaDiscovery'

export type AskModelSurfaceStatus = 'ready' | 'loading' | 'error' | 'blocked'

interface ResolveAskModelSurfaceStatusParams {
  hasReadyModel: boolean
  ollamaStatus: OllamaDiscoveryStatus
}

/**
 * Keep the thread mounted whenever the catalog has a usable alternative so the
 * model selector remains reachable. Ollama discovery states only replace the
 * thread when there is no model that can currently be selected.
 */
export function resolveAskModelSurfaceStatus({
  hasReadyModel,
  ollamaStatus,
}: ResolveAskModelSurfaceStatusParams): AskModelSurfaceStatus {
  if (hasReadyModel) return 'ready'
  if (ollamaStatus === 'loading') return 'loading'
  if (ollamaStatus === 'error') return 'error'
  return 'blocked'
}
