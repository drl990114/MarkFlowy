import type { DeferredLatestPublisherOptions } from './deferredLatestPublisher'

const SMALL_DOCUMENT_TIMING = { wait: 50, maxWait: 250 }
const LARGE_DOCUMENT_TIMING = { wait: 250, maxWait: 1000 }

export function getEditorSnapshotTiming(documentSize: number): DeferredLatestPublisherOptions {
  // Serialization traverses the entire document. Give repeated structural edits
  // time to coalesce; explicit save/export/unmount still flush synchronously.
  return documentSize >= 512 * 1024 ? LARGE_DOCUMENT_TIMING : SMALL_DOCUMENT_TIMING
}
