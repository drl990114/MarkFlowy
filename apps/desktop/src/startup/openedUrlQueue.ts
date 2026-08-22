export interface OpenedUrlQueue {
  drain: () => Promise<void>
  enqueue: (urls: string[]) => Promise<void>
}

export const createOpenedUrlQueue = (
  handleBatch: (urls: string[]) => Promise<void>,
): OpenedUrlQueue => {
  const scheduledUrls = new Set<string>()
  let tail: Promise<void> = Promise.resolve()

  const enqueue = (urls: string[]) => {
    const batch = [...new Set(urls)].filter((url) => {
      if (scheduledUrls.has(url)) return false
      scheduledUrls.add(url)
      return true
    })
    if (batch.length === 0) return tail

    const execution = tail.then(() => handleBatch(batch))
    const settled = execution.finally(() => {
      batch.forEach((url) => scheduledUrls.delete(url))
    })
    // A failed native-open batch must not poison future batches. The caller
    // still receives `settled` and can surface the failure.
    tail = settled.catch(() => undefined)
    return settled
  }

  const drain = async () => {
    for (;;) {
      const currentTail = tail
      await currentTail
      if (currentTail === tail) return
    }
  }

  return { drain, enqueue }
}
