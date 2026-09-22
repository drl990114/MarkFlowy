import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/helper/logger'

export interface FileSearchRequest {
  query: { dir: string; name_text: string; contents_text: string }
  options: { content_case_sensitive?: boolean; file_exclude_patterns?: string }
}

export type FileSearchScope = 'global' | 'quick_open'
let generation = 0
const aborted = () => new DOMException('Search canceled.', 'AbortError')

/** Request generations survive renderer reloads and order cancel-before-start IPC. */
export async function searchFiles<T>(
  request: FileSearchRequest,
  scope: FileSearchScope,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw aborted()
  const requestId = (generation = Math.max(generation + 1, Date.now() * 1000))
  const cancel = () => {
    void invoke('cancel_file_search', { requestId, scope }).catch((error: unknown) =>
      logger.error('Failed to cancel file search', error),
    )
  }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    const result = await invoke<T>('search_files_async', { ...request, requestId, scope })
    if (signal?.aborted) throw aborted()
    return result
  } catch (error) {
    if (signal?.aborted) throw aborted()
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}
