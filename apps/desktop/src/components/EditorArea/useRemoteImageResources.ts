import { createRemoteImageResources } from '@/helper/remoteImageResources'
import { useEffect, useMemo } from 'react'
import { EditorInstanceLifecycle } from './editorInstanceLifecycle'

export const useRemoteImageResources = (fileId: string) => {
  const { resources, lifecycle } = useMemo(
    () => ({ resources: createRemoteImageResources(), lifecycle: new EditorInstanceLifecycle() }),
    // A reused component must give the next file a fresh resource lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileId],
  )

  useEffect(() => {
    lifecycle.mount(fileId)
    return () => {
      // Reuse the editor's deferred cleanup for StrictMode effect replay. Each
      // pane owns a scope; shared downloads survive while any pane uses them.
      lifecycle.unmount(fileId, resources.dispose)
    }
  }, [fileId, lifecycle, resources])

  return resources
}
